// Unit contract for the extracted host modules.
//
// Ticket #2 requires the git runner and the porcelain parser to be importable
// in plain Node, without a DSH context. These tests pin that seam and the two
// behaviors the route tests do not inspect directly: the exact child-process
// shape handed to `ctx.subprocess` and the parser's record vocabulary.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execGit, git } from '../src/host/git.js'
import { parsePorcelainV2 } from '../src/host/porcelain.js'

const STATUS_FIXTURE = [
  '# branch.oid 0123456789abcdef',
  '# branch.head main',
  '# branch.upstream origin/main',
  '# branch.ab +2 -1',
  '1 .M N... 100644 100644 100644 aaaaaaa bbbbbbb src/components/App.tsx',
  '1 M. N... 100644 100644 100644 aaaaaaa bbbbbbb src/main.ts',
  '2 R. N... 100644 100644 100644 aaaaaaa bbbbbbb R100 docs/new name.md',
  '? docs/untracked.md',
  '! scratch/ignored.log',
].join('\0') + '\0'

function fakeSubprocess({ exitCode = 0, stdout = '', stderr = '' } = {}) {
  const spawns = []
  return {
    spawns,
    async resolveExecutable(command) {
      assert.equal(command, 'git')
      return '/usr/local/bin/git'
    },
    spawn(options) {
      spawns.push(options)
      return {
        done: Promise.resolve({ exitCode, signal: null }),
        collected: {
          stdout: { readFrom: () => ({ text: stdout, lossy: false }) },
          stderr: { readFrom: () => ({ text: stderr, lossy: false }) },
        },
      }
    },
  }
}

test('porcelain parser understands v2 records in plain Node', () => {
  const parsed = parsePorcelainV2(STATUS_FIXTURE)

  assert.equal(parsed.oid, '0123456789abcdef')
  assert.equal(parsed.branch, 'main')
  assert.equal(parsed.upstream, 'origin/main')
  assert.equal(parsed.ahead, 2)
  assert.equal(parsed.behind, 1)
  assert.equal(parsed.truncated, false)
  assert.deepEqual(parsed.entries, [
    { path: 'src/components/App.tsx', x: '.', y: 'M', kind: 'changed' },
    { path: 'src/main.ts', x: 'M', y: '.', kind: 'changed' },
    { path: 'docs/new name.md', x: 'R', y: '.', kind: 'renamed' },
    { path: 'docs/untracked.md', x: '?', y: '?', kind: 'untracked' },
    { path: 'scratch/ignored.log', x: '!', y: '!', kind: 'ignored' },
  ])
})

test('porcelain parser caps the entry list and reports truncation', () => {
  const records = []
  for (let index = 0; index < 5005; index += 1) records.push('? file-' + String(index) + '.txt')
  const parsed = parsePorcelainV2(records.join('\0') + '\0')

  assert.equal(parsed.entries.length, 5000)
  assert.equal(parsed.truncated, true)
  assert.equal(parsed.entries[4999].path, 'file-4999.txt')
})

test('git runner spawns argv directly, with the scrubbed git environment', async () => {
  const subprocess = fakeSubprocess({ stdout: 'status text' })
  const signal = new AbortController().signal

  const result = await execGit(subprocess, ['status', '--porcelain=v2'], '/tmp/workspace', {
    maxBytes: 1234,
    signal,
  })

  assert.deepEqual(result, { code: 0, out: 'status text', err: '' })
  assert.equal(subprocess.spawns.length, 1)
  const spawn = subprocess.spawns[0]
  assert.deepEqual(spawn.argv, ['/usr/local/bin/git', 'status', '--porcelain=v2'])
  assert.equal(spawn.cwd, '/tmp/workspace')
  assert.equal(spawn.env.GIT_TERMINAL_PROMPT, '0')
  assert.equal(spawn.env.GIT_OPTIONAL_LOCKS, '0')
  assert.equal(spawn.env.GIT_CONFIG_COUNT, '0')
  assert.equal(spawn.stdio.stdin, 'ignore')
  assert.deepEqual(spawn.stdio.stdout, { maxBytes: 1234 })
  assert.equal(spawn.signal, signal)
})

test('git helper rejects a failed command with git stderr as the message', async () => {
  const subprocess = fakeSubprocess({ exitCode: 128, stderr: 'fatal: not a git repository\n' })

  await assert.rejects(
    () => git(subprocess, ['status'], '/tmp/workspace'),
    (error) => error.code === 'git-failed' && error.message === 'fatal: not a git repository',
  )
})
