// Merge-conflict seam: the marker parser, the file guards that decide what may
// be rewritten, and the four routes that show, resolve, apply, revert and stage
// a conflicted file. No Harness, no real git, no network: `apply()` runs over a
// fake context whose subprocess answers by argv.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../index.js'
import {
  countConflictBlocks,
  hasConflictMarkers,
  parseConflictText,
  validateResolvedText,
} from '../src/host/conflict.js'

// Keep the tests off the real DSH home: the saved commit-message model lives
// there and would otherwise leak into the route resolution.
const HOME = mkdtempSync(join(tmpdir(), 'dgt-conflict-home-'))
process.env.DSH_HOME = HOME
process.on('exit', () => rmSync(HOME, { recursive: true, force: true }))

const CONFLICTED = `line1
<<<<<<< HEAD
from-main
=======
from-feature
>>>>>>> feature
line3
`

const MERGED_DIFF = `diff --git a/app.txt b/app.txt
index 1111111..2222222 100644
--- a/app.txt
+++ b/app.txt
@@ -1,7 +1,3 @@
 line1
-<<<<<<< HEAD
-from-main
-=======
-from-feature
->>>>>>> feature
+from-main-and-feature
 line3
`

function fakeContext({ root, llm, handler }) {
  const routes = []
  const spawns = []
  const services = {
    sandboxPolicy: { workspaceRoot: root },
    subprocess: {
      async resolveExecutable(command) {
        assert.equal(command, 'git')
        return '/usr/local/bin/git'
      },
      spawn({ argv, cwd }) {
        spawns.push({ argv, cwd })
        const result = handler ? handler(argv) : { exitCode: 0, stdout: '', stderr: '' }
        return {
          done: Promise.resolve({ exitCode: result.exitCode ?? 0, signal: null }),
          collected: {
            stdout: { readFrom: () => ({ text: result.stdout ?? '', lossy: false }) },
            stderr: { readFrom: () => ({ text: result.stderr ?? '', lossy: false }) },
          },
        }
      },
    },
  }
  if (llm) {
    services.llm = llm
    services.agentDefaultModel = { currentSelection: () => ({ provider: 'deepseek-account', model: 'deepseek-flash' }) }
  }
  return {
    routes,
    spawns,
    connection: { fetch: { register: (route) => { routes.push(route); return () => {} } } },
    get: (service) => services[service],
  }
}

function request(path, { method = 'POST', body } = {}) {
  return {
    url: 'https://dsh.internal' + path,
    method,
    signal: undefined,
    json: async () => {
      if (body === undefined) throw new Error('no body')
      return JSON.parse(JSON.stringify(body))
    },
  }
}

async function call(ctx, path, options) {
  const route = ctx.routes.find((item) => item.path === path.split('?')[0])
  assert.ok(route, 'route not registered: ' + path)
  const response = await route.fetch(request(path, options))
  return { response, body: await response.json() }
}

function fixture(contents = CONFLICTED) {
  const root = mkdtempSync(join(tmpdir(), 'dgt-conflict-'))
  writeFileSync(join(root, 'app.txt'), contents)
  return root
}

function unmergedHandler(extra = () => ({ exitCode: 0, stdout: '' })) {
  return (argv) => {
    const command = argv[1]
    if (command === 'ls-files') return { exitCode: 0, stdout: '100644 aaa 1\tapp.txt\u0000' }
    if (command === 'symbolic-ref') return { exitCode: 0, stdout: 'main\n' }
    if (command === 'diff') return { exitCode: 1, stdout: MERGED_DIFF }
    return extra(argv)
  }
}

test('the marker parser splits ours, base and theirs and keeps the labels', () => {
  const diff3 = `a
<<<<<<< HEAD
mine
||||||| merged common ancestors
base
=======
yours
>>>>>>> feature
b
`
  const parsed = parseConflictText(diff3)
  assert.equal(parsed.blocks, 1)
  assert.deepEqual(parsed.labels, { ours: 'HEAD', theirs: 'feature' })
  assert.equal(parsed.ours, 1)
  assert.equal(parsed.theirs, 1)
  assert.equal(parsed.base, 1)
  assert.deepEqual(
    parsed.lines.map((line) => line.kind),
    ['context', 'marker-start', 'ours', 'marker-base', 'base', 'marker-sep', 'theirs', 'marker-end', 'context'],
  )
  assert.equal(parsed.lines[8].text, 'b')
})

test('a file without markers is all context and counts no blocks', () => {
  const parsed = parseConflictText('one\ntwo\n')
  assert.equal(parsed.blocks, 0)
  assert.equal(parsed.lines.length, 2)
  assert.ok(parsed.lines.every((line) => line.kind === 'context'))
  assert.equal(hasConflictMarkers('one\ntwo\n'), false)
  assert.equal(countConflictBlocks('<<<<<<< a\nx\n=======\ny\n>>>>>>> b\n'), 1)
})

test('resolved text must be non-empty, marker-free and within budget', () => {
  assert.equal(validateResolvedText('').code, 'empty-content')
  assert.equal(validateResolvedText('   \n').code, 'empty-content')
  assert.equal(validateResolvedText(CONFLICTED).code, 'markers-present')
  assert.equal(validateResolvedText('x'.repeat(600 * 1024)).code, 'too-large')
  const ok = validateResolvedText('merged\n')
  assert.equal(ok.ok, true)
  assert.equal(ok.text, 'merged\n')
})

test('the diff route answers an unmerged path with the conflicted file, not "no diff"', async () => {
  const root = fixture()
  const ctx = fakeContext({ root, handler: unmergedHandler() })
  apply(ctx)
  const { body } = await call(ctx, '/api/git-tree/diff?path=app.txt', { method: 'GET' })
  assert.equal(body.ok, true)
  assert.equal(body.conflicted, true)
  assert.equal(body.side, 'conflicted')
  assert.equal(body.conflict.blocks, 1)
  assert.equal(body.conflict.lines[1].kind, 'marker-start')
  assert.equal(body.text, CONFLICTED)
  // and the ordinary unified-diff path was never attempted
  assert.equal(ctx.spawns.some((spawn) => spawn.argv[1] === 'diff' && !spawn.argv.includes('--no-index')), false)
  rmSync(root, { recursive: true, force: true })
})

test('apply writes the reviewed file and refuses markers or a clean path', async () => {
  const root = fixture()
  const ctx = fakeContext({ root, handler: unmergedHandler() })
  apply(ctx)
  const applied = await call(ctx, '/api/git-tree/conflict/apply', {
    body: { path: 'app.txt', content: 'merged\n' },
  })
  assert.equal(applied.body.ok, true)
  assert.equal(readFileSync(join(root, 'app.txt'), 'utf8'), 'merged\n')

  const markers = await call(ctx, '/api/git-tree/conflict/apply', {
    body: { path: 'app.txt', content: CONFLICTED },
  })
  assert.equal(markers.body.ok, false)
  assert.equal(markers.body.code, 'markers-present')

  const notConflicted = fakeContext({
    root,
    handler: (argv) => (argv[1] === 'ls-files' ? { exitCode: 0, stdout: '' } : { exitCode: 0, stdout: '' }),
  })
  apply(notConflicted)
  const refused = await call(notConflicted, '/api/git-tree/conflict/apply', {
    body: { path: 'app.txt', content: 'merged\n' },
  })
  assert.equal(refused.body.ok, false)
  assert.equal(refused.body.code, 'not-conflicted')
  rmSync(root, { recursive: true, force: true })
})

test('revert restores the conflicted copy and mark-resolved stages without markers', async () => {
  const root = fixture('merged without markers\n')
  const ctx = fakeContext({ root, handler: unmergedHandler() })
  apply(ctx)

  const reverted = await call(ctx, '/api/git-tree/conflict/revert', { body: { path: 'app.txt' } })
  assert.equal(reverted.body.ok, true)
  const checkout = ctx.spawns.find((spawn) => spawn.argv[1] === 'checkout')
  assert.deepEqual(checkout.argv.slice(1), ['checkout', '--merge', '--', 'app.txt'])

  const staged = await call(ctx, '/api/git-tree/conflict/mark-resolved', { body: { path: 'app.txt' } })
  assert.equal(staged.body.ok, true)
  const add = ctx.spawns.find((spawn) => spawn.argv[1] === 'add')
  assert.deepEqual(add.argv.slice(1), ['add', '--', 'app.txt'])

  writeFileSync(join(root, 'app.txt'), CONFLICTED)
  const stillMarked = await call(ctx, '/api/git-tree/conflict/mark-resolved', { body: { path: 'app.txt' } })
  assert.equal(stillMarked.body.ok, false)
  assert.equal(stillMarked.body.code, 'markers-present')
  rmSync(root, { recursive: true, force: true })
})

test('resolve returns the merged file plus a preview diff and writes nothing', async () => {
  const root = fixture()
  const llm = {
    listProviders: () => [{ id: 'deepseek-account', name: 'DeepSeek Account' }],
    listModels: async () => [{ id: 'deepseek-flash', name: 'DeepSeek V4.1 Flash' }],
    stream: (options) => {
      assert.match(options.system, /合并冲突/)
      assert.match(options.messages[0].content[0].text, /<<<FILE/)
      return (async function* () {
        yield { type: 'text-delta', index: 0, text: '```\nline1\nfrom-main-and-feature\nline3\n```' }
        yield { type: 'finish', reason: { kind: 'stop' } }
      })()
    },
  }
  const ctx = fakeContext({ root, llm, handler: unmergedHandler() })
  apply(ctx)
  const { body } = await call(ctx, '/api/git-tree/conflict/resolve', { body: { path: 'app.txt' } })
  assert.equal(body.ok, true)
  assert.equal(body.content, 'line1\nfrom-main-and-feature\nline3\n')
  assert.equal(body.diff.files.length, 1)
  assert.equal(body.diff.stats.additions, 1)
  assert.equal(body.diff.stats.deletions, 5)
  assert.equal(readFileSync(join(root, 'app.txt'), 'utf8'), CONFLICTED, 'resolve must not write the file')
  assert.equal(body.provider, 'deepseek-account')
  rmSync(root, { recursive: true, force: true })
})

test('resolve refuses a model answer that still carries markers', async () => {
  const root = fixture()
  const llm = {
    listProviders: () => [{ id: 'deepseek-account', name: 'DeepSeek Account' }],
    listModels: async () => [{ id: 'deepseek-flash', name: 'DeepSeek V4.1 Flash' }],
    stream: () =>
      (async function* () {
        yield { type: 'text-delta', index: 0, text: CONFLICTED }
        yield { type: 'finish', reason: { kind: 'stop' } }
      })(),
  }
  const ctx = fakeContext({ root, llm, handler: unmergedHandler() })
  apply(ctx)
  const { body } = await call(ctx, '/api/git-tree/conflict/resolve', { body: { path: 'app.txt' } })
  assert.equal(body.ok, false)
  assert.equal(body.code, 'markers-present')
  assert.equal(readFileSync(join(root, 'app.txt'), 'utf8'), CONFLICTED)
  rmSync(root, { recursive: true, force: true })
})
