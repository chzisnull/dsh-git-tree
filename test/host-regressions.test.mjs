// Real, isolated Git regressions for host paths, remote browsing and conflict writes.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../index.js'
import { readConflictFile } from '../src/host/conflict.js'
import { git, runProcess } from '../src/host/git.js'

const settingsHome = realpathSync.native(mkdtempSync(join(tmpdir(), 'dgt-host-settings-')))
const originalDshHome = process.env.DSH_HOME
process.env.DSH_HOME = settingsHome
after(() => {
  rmSync(settingsHome, { recursive: true, force: true })
  if (originalDshHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = originalDshHome
})

// Global trace2 integrations can keep writing notes after a test removes its repo.
const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_COUNT: '0' }
delete gitEnv.GIT_TRACE2_EVENT

function runGit(root, ...args) {
  return execFileSync('git', args, { cwd: root, env: gitEnv, encoding: 'utf8', stdio: 'pipe' })
}

function repository(t) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dgt-host-regression-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  runGit(root, 'init', '-q', '-b', 'main')
  runGit(root, 'config', 'user.name', 'Regression Test')
  runGit(root, 'config', 'user.email', 'regression@example.test')
  runGit(root, 'config', 'core.hooksPath', join(root, 'no-hooks'))
  return root
}

function write(root, path, text) {
  mkdirSync(join(root, path, '..'), { recursive: true })
  writeFileSync(join(root, path), text)
}

function commit(root, message) {
  runGit(root, 'add', '-A')
  runGit(root, 'commit', '-qm', message)
  return runGit(root, 'rev-parse', 'HEAD').trim()
}

function subprocess() {
  const children = []
  return {
    children,
    resolveExecutable: async (command) => command === 'node' ? process.execPath : command,
    spawn({ argv, cwd, env, signal, stdio }) {
      const child = spawn(argv[0], argv.slice(1), { cwd, env: { ...gitEnv, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
      const output = { stdout: [], stderr: [] }
      child.stdout.on('data', (bytes) => output.stdout.push(bytes))
      child.stderr.on('data', (bytes) => output.stderr.push(bytes))
      const abort = () => child.kill('SIGTERM')
      if (signal?.aborted) abort()
      else signal?.addEventListener('abort', abort, { once: true })
      const done = new Promise((resolve, reject) => {
        child.on('error', reject)
        child.on('close', (exitCode, childSignal) => {
          signal?.removeEventListener('abort', abort)
          resolve({ exitCode, signal: childSignal })
        })
      })
      children.push({ child, done, argv, cwd })
      return {
        done,
        collected: Object.fromEntries(['stdout', 'stderr'].map((side) => [side, {
          readFrom: () => {
            const bytes = Buffer.concat(output[side])
            return { text: bytes.toString('utf8'), lossy: bytes.length > (stdio[side]?.maxBytes ?? Infinity) }
          },
        }])),
      }
    },
  }
}

function context(root, { workspaceRoot = root, llm } = {}) {
  const routes = []
  const services = {
    sandboxPolicy: { workspaceRoot },
    subprocess: subprocess(),
    llm,
    agentDefaultModel: { currentSelection: () => ({ provider: 'test', model: 'test' }) },
  }
  const ctx = {
    routes,
    connection: { fetch: { register: (route) => { routes.push(route); return () => {} } } },
    get: (name) => services[name],
  }
  apply(ctx)
  return ctx
}

async function call(ctx, route, { body, cwd } = {}) {
  const url = new URL('https://dsh.internal/api/git-tree/' + route)
  if (cwd) url.searchParams.set('cwd', cwd)
  const handler = ctx.routes.find((entry) => entry.path === url.pathname)
  const response = await handler.fetch({
    url: url.href,
    method: body ? 'POST' : 'GET',
    json: async () => body,
  })
  return { status: response.status, ...await response.json() }
}

function model(resolve = () => 'resolved\n') {
  return {
    listProviders: () => [{ id: 'test' }],
    listModels: async () => [{ id: 'test' }],
    stream: () => (async function* () {
      yield { type: 'text-delta', text: await resolve() }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })(),
  }
}

function conflictedRepository(t, markerSize = 11) {
  const root = repository(t)
  write(root, '.gitattributes', '* conflict-marker-size=' + markerSize + '\n')
  write(root, 'sub/a*.txt', 'base\n')
  write(root, 'sub/abc.txt', 'neighbor\n')
  commit(root, 'base')
  runGit(root, 'checkout', '-qb', 'topic')
  write(root, 'sub/a*.txt', 'theirs\n')
  commit(root, 'theirs')
  runGit(root, 'checkout', '-q', 'main')
  write(root, 'sub/a*.txt', 'ours\n')
  commit(root, 'ours')
  return root
}

test('discard and tracked remove act on exact root-relative files, including special names', async (t) => {
  const root = repository(t)
  const names = ['sub/a*.txt', 'sub/abc.txt', 'sub/:(glob)*.txt', 'sub/-dash', 'sub/~tilde', 'sub/back\\slash', 'sub/名字\n\t.txt', 'sub/sub/a*.txt', 'folder/child.txt']
  for (const path of names) write(root, path, 'original\n')
  commit(root, 'initial')
  for (const path of names) write(root, path, 'changed\n')
  const ctx = context(root)
  const cwd = join(root, 'sub')
  const selected = names.filter((path) => path.startsWith('sub/') && !['sub/abc.txt', 'sub/sub/a*.txt'].includes(path))
  assert.equal((await call(ctx, 'discard', { cwd, body: { paths: selected } })).ok, true)
  for (const path of selected) assert.equal(readFileSync(join(root, path), 'utf8'), 'original\n', path)
  assert.equal(readFileSync(join(root, 'sub/abc.txt'), 'utf8'), 'changed\n')
  assert.equal(readFileSync(join(root, 'sub/sub/a*.txt'), 'utf8'), 'changed\n')

  write(root, 'sub/a*.txt', 'staged\n')
  runGit(root, '--literal-pathspecs', 'add', '--', 'sub/a*.txt')
  write(root, 'sub/a*.txt', 'later\n')
  assert.equal((await call(ctx, 'discard', { cwd, body: { paths: ['sub/a*.txt'], side: 'staged' } })).ok, true)
  assert.equal(runGit(root, 'show', ':sub/a*.txt'), 'original\n')
  assert.equal(readFileSync(join(root, 'sub/a*.txt'), 'utf8'), 'original\n')

  for (const route of ['discard', 'remove']) {
    const refused = await call(ctx, route, { cwd, body: { paths: ['sub/a*.txt', 'folder'] } })
    assert.equal(refused.status, 400)
    assert.equal(existsSync(join(root, 'sub/a*.txt')), true)
  }
  rmSync(join(root, 'folder'), { recursive: true })
  assert.equal((await call(ctx, 'remove', { body: { paths: ['folder'] } })).status, 400, 'a missing tracked directory is still not a file')
  assert.equal((await call(ctx, 'remove', { cwd, body: { paths: selected } })).ok, true)
  for (const path of selected) assert.equal(existsSync(join(root, path)), false, path)
  for (const path of ['sub/abc.txt', 'sub/sub/a*.txt']) assert.equal(existsSync(join(root, path)), true)
})

test('diff, history path and AI selection use authorized repoRoot and literal filenames', async (t) => {
  const root = repository(t)
  write(root, 'sub/a*.txt', 'selected base\n')
  write(root, 'sub/abc.txt', 'neighbor base\n')
  write(root, 'sub/sub/a*.txt', 'nested base\n')
  commit(root, 'initial')
  write(root, 'sub/a*.txt', 'selected commit\n')
  const selectedSha = commit(root, 'selected history')
  write(root, 'sub/abc.txt', 'neighbor commit\n')
  commit(root, 'neighbor history')
  write(root, 'sub/sub/a*.txt', 'nested commit\n')
  commit(root, 'nested history')
  write(root, 'sub/a*.txt', 'selected working tree\n')
  write(root, 'sub/abc.txt', 'neighbor working tree\n')
  const llm = model()
  let prompt
  const stream = llm.stream
  llm.stream = (options) => { prompt = options.messages[0].content[0].text; return stream(options) }
  const ctx = context(root, { llm })
  const cwd = join(root, 'sub')
  const diff = await call(ctx, 'diff?path=' + encodeURIComponent('sub/a*.txt'), { cwd })
  assert.equal(diff.ok, true)
  assert.match(diff.text, /selected working tree/)
  assert.doesNotMatch(diff.text, /neighbor working tree/)
  const history = await call(ctx, 'history?path=' + encodeURIComponent('sub/a*.txt'), { cwd })
  assert.equal(history.ok, true)
  assert.equal(history.commits[0].sha, selectedSha)
  assert.ok(!history.commits.some((entry) => entry.subject === 'neighbor history' || entry.subject === 'nested history'))
  const generated = await call(ctx, 'commit-message', { cwd, body: { files: [{ path: 'sub/a*.txt', status: 'M' }] } })
  assert.equal(generated.ok, true)
  assert.match(prompt, /selected working tree/)
  assert.doesNotMatch(prompt, /neighbor working tree/)

  const restricted = context(root, { workspaceRoot: cwd, llm })
  for (const [route, body] of [
    ['diff?path=sub/a*.txt'], ['history?path=sub/a*.txt'],
    ['commit-message', { files: [{ path: 'sub/a*.txt' }] }],
    ['discard', { paths: ['sub/a*.txt'] }], ['remove', { paths: ['sub/a*.txt'] }],
    ['conflict/resolve', { path: 'sub/a*.txt' }],
    ['conflict/apply', { path: 'sub/a*.txt', content: 'resolved\n', sourceHash: 'a'.repeat(64) }],
    ['conflict/revert', { path: 'sub/a*.txt' }], ['conflict/mark-resolved', { path: 'sub/a*.txt' }],
  ]) {
    const denied = await call(restricted, route, { body })
    assert.equal(denied.status, 403, route + ': ' + JSON.stringify(denied))
    assert.equal(denied.code, 'outside-workspace')
  }
})

test('commit-info preserves Unicode, tabs, newlines, backslashes and rename paths', async (t) => {
  const root = repository(t)
  const oldPath = '旧名\t\n\\.txt'
  const newPath = '新名\n\t\\.txt'
  write(root, oldPath, 'rename me\n')
  commit(root, 'initial')
  renameSync(join(root, oldPath), join(root, newPath))
  write(root, '新增\t\n\\.txt', 'new\n')
  const sha = commit(root, 'rename and add')
  const info = await call(context(root), 'commit-info?sha=' + sha)
  assert.equal(info.ok, true)
  assert.deepEqual(info.files.sort((a, b) => a.status.localeCompare(b.status)), [
    { status: 'added', path: '新增\t\n\\.txt' },
    { status: 'renamed', path: newPath, origPath: oldPath },
  ])
})

test('remote browse keeps exact namespace, remote-only commits, configured names and symref filtering', async (t) => {
  const root = repository(t)
  write(root, 'file', 'base\n')
  const base = commit(root, 'base')
  runGit(root, 'checkout', '-qb', 'temporary')
  write(root, 'file', 'remote only\n')
  const remoteSha = commit(root, 'remote-only commit')
  runGit(root, 'checkout', '-q', 'main')
  runGit(root, 'branch', '-D', 'temporary')
  runGit(root, 'branch', 'origin/topic', base)
  runGit(root, 'tag', 'origin/topic', base)
  runGit(root, 'remote', 'add', 'origin', 'https://example.invalid/origin.git')
  runGit(root, 'remote', 'add', 'team/review', 'https://example.invalid/review.git')
  runGit(root, 'remote', 'add', 'empty', 'https://example.invalid/empty.git')
  runGit(root, 'update-ref', 'refs/remotes/origin/topic', remoteSha)
  runGit(root, 'update-ref', 'refs/remotes/team/review/deep/topic', remoteSha)
  runGit(root, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/topic')
  runGit(root, 'symbolic-ref', 'refs/remotes/origin/alias', 'refs/remotes/origin/topic')
  const ctx = context(root)
  const before = runGit(root, 'status', '--porcelain=v2', '-z')
  const refs = await call(ctx, 'refs')
  assert.equal(refs.ok, true)
  assert.deepEqual(refs.remoteNames, ['empty', 'origin', 'team/review'])
  assert.deepEqual(refs.remotes.map((entry) => entry.name), ['origin/topic', 'team/review/deep/topic'])
  for (const name of refs.remotes.map((entry) => entry.name)) {
    const history = await call(ctx, 'history?scope=' + encodeURIComponent('remote:' + name))
    assert.equal(history.ok, true)
    assert.equal(history.commits[0].sha, remoteSha)
    assert.ok(history.commits[0].refs.some((ref) => ref.kind === 'remote' && ref.name === name))
  }
  const local = await call(ctx, 'history?scope=branch:origin/topic')
  assert.equal(local.commits[0].sha, base)
  const all = await call(ctx, 'history')
  assert.ok(all.commits.some((entry) => entry.sha === remoteSha))
  const info = await call(ctx, 'commit-info?sha=' + remoteSha)
  assert.ok(info.refs.some((entry) => entry.kind === 'remote' && entry.name === 'origin/topic'))
  assert.ok(info.refs.some((entry) => entry.name === 'origin/HEAD'), 'history decorations preserve ref names without guessing whether they are symbolic')
  runGit(root, 'symbolic-ref', '--delete', 'refs/remotes/origin/HEAD')
  runGit(root, 'update-ref', 'refs/remotes/origin/HEAD', remoteSha)
  assert.ok((await call(ctx, 'refs')).remotes.some((entry) => entry.name === 'origin/HEAD'), 'a real remote branch named HEAD remains browsable')
  assert.ok((await call(ctx, 'commit-info?sha=' + remoteSha)).refs.some((entry) => entry.name === 'origin/HEAD'))
  assert.equal((await call(ctx, 'history?scope=nonsense')).status, 400)
  assert.equal((await call(ctx, 'history?scope=remote:origin/missing')).code, 'unknown-remote-ref')
  assert.equal((await call(ctx, 'history?scope=remote:../escape')).status, 400)
  runGit(root, 'checkout', '--detach', '-q', base)
  assert.ok((await call(ctx, 'history')).commits.some((entry) => entry.sha === remoteSha))
  assert.equal(runGit(root, 'status', '--porcelain=v2', '-z'), before)
  const children = ctx.get('subprocess').children
  assert.ok(!children.some(({ argv }) => ['fetch', 'pull', 'push', 'checkout', 'merge'].includes(argv[1])))

  // An unborn local branch must not hide existing remote-tracking history.
  runGit(root, 'symbolic-ref', 'HEAD', 'refs/heads/unborn')
  assert.ok((await call(ctx, 'history')).commits.some((entry) => entry.sha === remoteSha))
})

test('real merge stdout diagnostics and configurable conflict markers reach the routes', async (t) => {
  for (const size of [3, 11]) {
    const root = conflictedRepository(t, size)
    const ctx = context(root)
    const merge = await call(ctx, 'merge', { body: { branch: 'topic' } })
    assert.equal(merge.status, 409)
    assert.equal(merge.code, 'merge-conflict', JSON.stringify(merge))
    const diff = await call(ctx, 'diff?path=' + encodeURIComponent('sub/a*.txt'), { cwd: join(root, 'sub') })
    assert.equal(diff.conflict.blocks, 1)
    assert.deepEqual(diff.conflict.labels, { ours: 'HEAD', theirs: 'topic' })
    assert.equal(diff.conflict.ours, 1)
    assert.equal(diff.conflict.theirs, 1)
    assert.equal((await call(ctx, 'conflict/mark-resolved', { body: { path: 'sub/a*.txt' } })).code, 'markers-present')
    const noCommit = await call(ctx, 'commit', { body: { message: 'unresolved' } })
    assert.equal(noCommit.code, 'conflicts-present')
  }
  const root = repository(t)
  write(root, 'file', 'base\n')
  commit(root, 'base')
  assert.equal((await call(context(root), 'commit', { body: { message: 'empty' } })).code, 'nothing-to-commit')
})

test('conflict source hashes bind raw bytes, path and repository and block edits during generation', async (t) => {
  const root = conflictedRepository(t)
  const other = conflictedRepository(t)
  for (const repo of [root, other]) {
    try { runGit(repo, 'merge', '--no-edit', 'topic') } catch { /* expected conflict */ }
  }
  const path = 'sub/a*.txt'
  const ctx = context(root, { llm: model() })
  const cwd = join(root, 'sub')
  const source = readFileSync(join(root, path))
  const proposal = await call(ctx, 'conflict/resolve', { cwd, body: { path } })
  assert.equal(proposal.ok, true, JSON.stringify(proposal))
  assert.match(proposal.sourceHash, /^[0-9a-f]{64}$/)
  assert.equal(readFileSync(join(root, path)).equals(source), true, 'preview must not write')
  assert.equal((await call(ctx, 'conflict/apply', { body: { path, content: proposal.content } })).status, 400)
  const crossRepo = await call(context(other), 'conflict/apply', { body: { path, content: proposal.content, sourceHash: proposal.sourceHash } })
  assert.equal(crossRepo.code, 'stale-source')
  assert.equal(readFileSync(join(other, path)).equals(source), true)

  // Even bytes that UTF-8 decoding turns into the same replacement character differ.
  writeFileSync(join(root, path), Buffer.concat([source, Buffer.from([0x80])]))
  const firstRawHash = readConflictFile(root, path).sourceHash
  writeFileSync(join(root, path), Buffer.concat([source, Buffer.from([0x81])]))
  assert.notEqual(readConflictFile(root, path).sourceHash, firstRawHash)
  const stale = await call(ctx, 'conflict/apply', { body: { path, content: proposal.content, sourceHash: proposal.sourceHash } })
  assert.equal(stale.status, 409)
  assert.equal(stale.code, 'stale-source')
  writeFileSync(join(root, path), source)

  const blob = runGit(root, 'rev-parse', 'HEAD:sub/a*.txt').trim()
  write(root, 'sub/other.txt', source)
  execFileSync('git', ['update-index', '--index-info'], {
    cwd: root, input: [1, 2, 3].map((stage) => `100644 ${blob} ${stage}\tsub/other.txt\n`).join(''),
  })
  assert.equal((await call(ctx, 'conflict/apply', { body: { path: 'sub/other.txt', content: proposal.content, sourceHash: proposal.sourceHash } })).code, 'stale-source')

  const applied = await call(ctx, 'conflict/apply', { cwd, body: { path, content: proposal.content, sourceHash: proposal.sourceHash } })
  assert.equal(applied.ok, true)
  assert.equal(readFileSync(join(root, path), 'utf8'), 'resolved\n')
  assert.equal((await call(ctx, 'conflict/apply', { cwd, body: { path, content: proposal.content, sourceHash: proposal.sourceHash } })).code, 'stale-source')
  const reverted = await call(ctx, 'conflict/revert', { cwd, body: { path } })
  assert.equal(reverted.ok, true)
  assert.match(readFileSync(join(root, path), 'utf8'), /<{11}/)

  const racing = context(root, { llm: model(() => {
    writeFileSync(join(root, path), 'manual edit while generating\n')
    return 'resolved\n'
  }) })
  assert.equal((await call(racing, 'conflict/resolve', { cwd, body: { path } })).code, 'stale-source')
  assert.equal(readFileSync(join(root, path), 'utf8'), 'manual edit while generating\n')
  assert.equal((await call(ctx, 'conflict/mark-resolved', { cwd, body: { path } })).ok, true)
  assert.equal(runGit(root, '--literal-pathspecs', 'ls-files', '-u', '--', path), '')
  assert.equal(runGit(root, 'show', ':sub/abc.txt'), 'neighbor\n')
})

test('process deadline aborts the actual child and preserves both Git diagnostic streams', async () => {
  const service = subprocess()
  const start = Date.now()
  await assert.rejects(
    runProcess(service, 'node', ['-e', 'setInterval(() => {}, 1000)'], tmpdir(), { timeoutMs: 80 }),
    (error) => error.code === 'node-timeout',
  )
  const outcome = await service.children[0].done
  assert.equal(outcome.signal, 'SIGTERM')
  assert.ok(Date.now() - start < 2000)

  const diagnostics = {
    resolveExecutable: async () => 'git',
    spawn: () => ({
      done: Promise.resolve({ exitCode: 1 }),
      collected: {
        stdout: { readFrom: () => ({ text: 'CONFLICT (content): Merge conflict in app.txt\n' }) },
        stderr: { readFrom: () => ({ text: 'warning: extra context\n' }) },
      },
    }),
  }
  await assert.rejects(git(diagnostics, ['merge'], tmpdir()), (error) =>
    /warning: extra context/.test(error.message) && /CONFLICT \(content\)/.test(error.message))
})

function bareRepository(t) {
  const bare = realpathSync.native(mkdtempSync(join(tmpdir(), 'dgt-host-bare-')))
  t.after(() => rmSync(bare, { recursive: true, force: true }))
  runGit(bare, 'init', '--bare', '-q')
  return bare
}

function remoteFixture(t, { remote = 'origin', branch = 'feature/topic', tracking = branch, refspec } = {}) {
  const root = repository(t)
  const bare = bareRepository(t)
  write(root, 'file', 'base\n')
  const oid = commit(root, 'base')
  runGit(root, 'remote', 'add', remote, bare)
  if (refspec) runGit(root, 'config', '--replace-all', 'remote.' + remote + '.fetch', refspec)
  runGit(root, 'push', remote, 'HEAD:refs/heads/' + branch)
  runGit(root, 'fetch', remote)
  return { root, bare, remote, branch, name: remote + '/' + tracking, oid, expectedOid: oid.slice(0, 7) }
}

test('local deletion requires a boolean force, preserves current and occupied branches', async (t) => {
  const root = repository(t)
  write(root, 'file', 'base\n')
  commit(root, 'base')
  runGit(root, 'checkout', '-qb', 'unmerged')
  write(root, 'file', 'unmerged\n')
  const oid = commit(root, 'unmerged')
  runGit(root, 'checkout', '-q', 'main')
  const ctx = context(root)
  assert.equal((await call(ctx, 'branch/delete', { body: { name: 'unmerged' } })).code, 'branch-not-merged')
  for (const force of ['true', 1, null, [], {}]) {
    const result = await call(ctx, 'branch/delete', { body: { name: 'unmerged', force } })
    assert.equal(result.status, 400)
    assert.equal(result.code, 'invalid-force')
  }
  assert.equal(runGit(root, 'rev-parse', 'refs/heads/unmerged').trim(), oid)
  assert.equal((await call(ctx, 'branch/delete', { body: { name: 'unmerged', force: true } })).ok, true)
  assert.equal(runGit(root, 'branch', '--list', 'unmerged'), '')
  assert.equal((await call(ctx, 'branch/delete', { body: { name: 'main', force: true } })).code, 'current-branch')
  runGit(root, 'branch', 'occupied')
  runGit(root, 'worktree', 'add', '-q', join(root, 'linked-worktree'), 'occupied')
  assert.equal((await call(ctx, 'branch/delete', { body: { name: 'occupied', force: true } })).code, 'branch-in-use')
  assert.notEqual(runGit(root, 'branch', '--list', 'occupied'), '')
})

test('remote deletion removes only the leased server branch and refreshes its tracking ref', async (t) => {
  const fixture = remoteFixture(t)
  const { root, bare, branch, name, expectedOid, oid } = fixture
  runGit(root, 'branch', branch)
  runGit(root, 'branch', name)
  runGit(root, 'push', 'origin', 'HEAD:refs/heads/keep')
  runGit(root, 'config', 'remote.origin.mirror', 'true')
  runGit(root, 'config', 'remote.origin.push', '+refs/heads/*:refs/heads/*')
  const ctx = context(root)
  const result = await call(ctx, 'branch/delete-remote', { body: { name, expectedOid } })
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(result.remote, 'origin')
  assert.equal(result.branch, branch)
  assert.equal(result.trackingRemoved, true)
  assert.equal(runGit(bare, 'for-each-ref', '--format=%(refname)', 'refs/heads/' + branch), '')
  assert.equal(runGit(bare, 'rev-parse', 'refs/heads/keep').trim(), oid)
  assert.equal(runGit(root, 'rev-parse', 'refs/heads/' + branch).trim(), oid)
  assert.equal(runGit(root, 'rev-parse', 'refs/heads/' + name).trim(), oid)
  assert.equal(runGit(root, 'for-each-ref', '--format=%(refname)', 'refs/remotes/' + name), '')
  const push = ctx.get('subprocess').children.find(({ argv }) => argv[1] === 'push')
  assert.ok(push.argv.includes('--force-with-lease=refs/heads/' + branch + ':' + oid))
  assert.deepEqual(push.argv.slice(-2), [bare, ':refs/heads/' + branch])
  assert.ok(!push.argv.includes('--force'))
})

test('remote delete lease rejects an update racing after preflight, preserving local cache', async (t) => {
  const { root, bare, name, expectedOid, branch, oid } = remoteFixture(t)
  write(root, 'file', 'updated on server\n')
  const newer = commit(root, 'newer')
  runGit(root, 'push', 'origin', 'HEAD:refs/heads/keep')
  const ctx = context(root)
  const service = ctx.get('subprocess')
  const actualSpawn = service.spawn
  let raced = false
  service.spawn = (options) => {
    if (options.argv[1] === 'push') {
      raced = true
      runGit(bare, 'update-ref', 'refs/heads/' + branch, newer)
    }
    return actualSpawn(options)
  }
  const result = await call(ctx, 'branch/delete-remote', { body: { name, expectedOid } })
  assert.equal(raced, true, 'the actual push lease must reject the race')
  assert.equal(result.status, 409)
  assert.equal(result.code, 'remote-stale', JSON.stringify(result))
  assert.equal(runGit(bare, 'rev-parse', 'refs/heads/' + branch).trim(), newer)
  assert.equal(runGit(root, 'rev-parse', 'refs/remotes/' + name).trim(), oid)

  // A changed local snapshot is rejected before contacting the server.
  runGit(root, 'update-ref', 'refs/remotes/' + name, newer)
  const fresh = context(root)
  assert.equal((await call(fresh, 'branch/delete-remote', { body: { name, expectedOid } })).code, 'remote-stale')
  assert.ok(!fresh.get('subprocess').children.some(({ argv }) => ['push', 'ls-remote'].includes(argv[1])))
})

test('protected or missing server branch is reported without deleting its local cache', async (t) => {
  const { root, bare, name, expectedOid, branch, oid } = remoteFixture(t)
  writeFileSync(join(bare, 'hooks', 'pre-receive'), '#!/bin/sh\necho "protected branch: deletion denied" >&2\nexit 1\n', { mode: 0o755 })
  const ctx = context(root)
  const rejected = await call(ctx, 'branch/delete-remote', { body: { name, expectedOid } })
  assert.equal(rejected.code, 'remote-delete-protected', JSON.stringify(rejected))
  assert.equal(runGit(bare, 'rev-parse', 'refs/heads/' + branch).trim(), oid)
  assert.equal(runGit(root, 'rev-parse', 'refs/remotes/' + name).trim(), oid)
  runGit(bare, 'update-ref', '-d', 'refs/heads/' + branch)
  const missing = await call(ctx, 'branch/delete-remote', { body: { name, expectedOid } })
  assert.equal(missing.status, 404)
  assert.equal(missing.code, 'remote-branch-missing')
  assert.equal(runGit(root, 'rev-parse', 'refs/remotes/' + name).trim(), oid)
})

test('remote delete honors slash names and exact nonstandard fetch mappings', async (t) => {
  for (const config of [
    { remote: 'team/review', branch: 'release/功能/topic', tracking: '功能/topic', refspec: '+refs/heads/release/*:refs/remotes/team/review/*' },
    { remote: 'origin', branch: 'server-branch', tracking: 'local-name', refspec: '+refs/heads/server-branch:refs/remotes/origin/local-name' },
  ]) {
    const { root, bare, remote, name, expectedOid, branch } = remoteFixture(t, config)
    if (remote.includes('/')) runGit(root, 'remote', 'add', 'team', bareRepository(t))
    const result = await call(context(root), 'branch/delete-remote', { body: { name, expectedOid } })
    assert.equal(result.ok, true, JSON.stringify(result))
    assert.equal(result.remote, remote)
    assert.equal(result.branch, branch)
    assert.equal(runGit(bare, 'for-each-ref', '--format=%(refname)', 'refs/heads/' + branch), '')
  }
})

test('remote delete rejects invalid snapshots, ambiguous mappings, aliases and multiple push servers', async (t) => {
  const { root, bare, name, expectedOid, branch, oid } = remoteFixture(t)
  const ctx = context(root)
  for (const body of [
    { name, expectedOid: '' }, { name, expectedOid: 'HEAD' }, { name, expectedOid: '--all' },
    { name: '../escape', expectedOid }, { name: '-origin/topic', expectedOid },
    { name: 'unknown/topic', expectedOid }, { name, expectedOid: null },
  ]) assert.equal((await call(ctx, 'branch/delete-remote', { body })).status, 400, JSON.stringify(body))
  assert.ok(!ctx.get('subprocess').children.some(({ argv }) => argv[1] === 'push'))
  assert.equal((await call(ctx, 'branch/delete-remote', { body: { name, expectedOid: '0'.repeat(40) } })).code, 'remote-stale')
  runGit(root, 'symbolic-ref', 'refs/remotes/origin/alias', 'refs/remotes/' + name)
  assert.equal((await call(ctx, 'branch/delete-remote', { body: { name: 'origin/alias', expectedOid } })).code, 'symbolic-remote-ref')
  for (const specs of [
    ['+refs/tags/*:refs/remotes/origin/*'],
    ['+refs/heads/*:refs/remotes/origin/*', '+refs/heads/other/*:refs/remotes/origin/*'],
    ['+refs/heads/*:refs/remotes/origin/*', '^refs/heads/feature/*'],
  ]) {
    runGit(root, 'config', '--unset-all', 'remote.origin.fetch')
    for (const spec of specs) runGit(root, 'config', '--add', 'remote.origin.fetch', spec)
    assert.equal((await call(ctx, 'branch/delete-remote', { body: { name, expectedOid } })).code, 'remote-mapping-unsupported')
  }
  runGit(root, 'config', '--replace-all', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*')
  const other = bareRepository(t)
  runGit(root, 'push', other, 'HEAD:refs/heads/' + branch)
  runGit(root, 'remote', 'set-url', '--add', '--push', 'origin', bare)
  runGit(root, 'remote', 'set-url', '--add', '--push', 'origin', other)
  assert.equal((await call(ctx, 'branch/delete-remote', { body: { name, expectedOid } })).code, 'multiple-push-urls')
  assert.equal(runGit(bare, 'rev-parse', 'refs/heads/' + branch).trim(), oid)
  assert.equal(runGit(other, 'rev-parse', 'refs/heads/' + branch).trim(), oid)
})

test('server delete remains successful and preserves a local ref changed before cleanup', async (t) => {
  const { root, bare, name, expectedOid, branch } = remoteFixture(t)
  write(root, 'file', 'new local snapshot\n')
  const newer = commit(root, 'new local snapshot')
  const ctx = context(root)
  const service = ctx.get('subprocess')
  const actualSpawn = service.spawn
  service.spawn = (options) => {
    if (options.argv[1] === 'update-ref') runGit(root, 'update-ref', 'refs/remotes/' + name, newer)
    return actualSpawn(options)
  }
  const result = await call(ctx, 'branch/delete-remote', { body: { name, expectedOid } })
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(result.trackingRemoved, false)
  assert.match(result.warning, /服务器分支已删除/)
  assert.equal(runGit(bare, 'for-each-ref', '--format=%(refname)', 'refs/heads/' + branch), '')
  assert.equal(runGit(root, 'rev-parse', 'refs/remotes/' + name).trim(), newer)
})
