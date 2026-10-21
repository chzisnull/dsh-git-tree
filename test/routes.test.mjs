// Host-half route contract: what the plugin registers and how it refuses
// unsafe input. No git and no Harness needed — `apply()` is driven by a fake
// context, and the handlers answer from a fake subprocess.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply, inject, name } from '../index.js'

const WORKSPACE = '/tmp/fake-workspace'

const STATUS_FIXTURE = [
  '# branch.oid 0123456789abcdef',
  '# branch.head main',
  '# branch.upstream origin/main',
  '# branch.ab +2 -1',
  '1 .M N... 100644 100644 100644 aaaaaaa bbbbbbb src/components/App.tsx',
  '1 M. N... 100644 100644 100644 aaaaaaa bbbbbbb src/main.ts',
  '? docs/new-note.md',
].join('\0') + '\0'

function fakeContext(overrides = {}) {
  const routes = []
  const spawns = []
  const services = {
    sandboxPolicy: { workspaceRoot: WORKSPACE },
    subprocess: {
      async resolveExecutable(cmd) {
        if (cmd !== 'git') throw new Error('unexpected executable')
        return '/usr/local/bin/git'
      },
      spawn({ argv, cwd }) {
        spawns.push({ argv, cwd })
        const stdout = argv[1] === 'rev-parse' ? WORKSPACE + '\n' : STATUS_FIXTURE
        return {
          done: Promise.resolve({ exitCode: 0, signal: null }),
          collected: {
            stdout: { readFrom: () => ({ text: stdout, lossy: false }) },
            stderr: { readFrom: () => ({ text: '', lossy: false }) },
          },
        }
      },
    },
    ...overrides,
  }
  return {
    routes,
    spawns,
    connection: { fetch: { register: (route) => { routes.push(route); return () => {} } } },
    get: (service) => services[service],
  }
}

function request(path) {
  return { url: 'https://dsh.internal' + path, signal: undefined }
}

function routeFor(ctx, path) {
  const route = ctx.routes.find((item) => item.path === path)
  assert.ok(route, 'route not registered: ' + path)
  return route
}

test('host plugin declares its name and hard service dependencies', () => {
  assert.equal(name, 'dsh-git-tree')
  assert.deepEqual(inject, ['connection', 'subprocess'])
})

test('apply registers two authenticated exact Fetch routes', () => {
  const ctx = fakeContext()
  apply(ctx)
  assert.equal(ctx.routes.length, 2)
  for (const route of ctx.routes) {
    assert.deepEqual(route.methods, ['GET'])
    assert.equal(route.requestBody, 'buffered')
    assert.equal(route.kind, undefined, 'connection.fetch routes take no kind')
  }
  assert.deepEqual(ctx.routes.map((r) => r.path).sort(), ['/api/git-tree/diff', '/api/git-tree/status'])
})

test('status route parses porcelain v2 into branch and entries', async () => {
  const ctx = fakeContext()
  apply(ctx)
  const response = await routeFor(ctx, '/api/git-tree/status').fetch(request('/api/git-tree/status'))
  const body = await response.json()

  assert.equal(body.ok, true)
  assert.equal(body.branch, 'main')
  assert.equal(body.upstream, 'origin/main')
  assert.equal(body.ahead, 2)
  assert.equal(body.behind, 1)
  assert.equal(body.repoRoot, WORKSPACE)
  assert.equal(body.entries.length, 3)
  assert.deepEqual(body.entries[0], { path: 'src/components/App.tsx', x: '.', y: 'M', kind: 'changed' })
  assert.deepEqual(body.entries[2], { path: 'docs/new-note.md', x: '?', y: '?', kind: 'untracked' })

  const statusCall = ctx.spawns.find((call) => call.argv[1] === 'status')
  assert.ok(statusCall, 'status must be spawned')
  assert.ok(statusCall.argv.includes('--porcelain=v2'))
  assert.equal(statusCall.cwd, WORKSPACE)
})

test('diff route puts a `--` separator before the path', async () => {
  const ctx = fakeContext()
  apply(ctx)
  await routeFor(ctx, '/api/git-tree/diff').fetch(request('/api/git-tree/diff?path=src/main.ts'))
  const diffCall = ctx.spawns.find((call) => call.argv[1] === 'diff')
  assert.ok(diffCall, 'diff must be spawned')
  const dashDash = diffCall.argv.indexOf('--')
  assert.ok(dashDash > 0, 'diff argv must contain --')
  assert.equal(diffCall.argv[dashDash + 1], 'src/main.ts')
  assert.ok(diffCall.argv.includes('--no-color'))
  assert.ok(!diffCall.argv.includes('--cached'), 'unstaged diff must not pass --cached')
})

test('diff route rejects traversal, absolute and option-shaped paths', async () => {
  const ctx = fakeContext()
  apply(ctx)
  const route = routeFor(ctx, '/api/git-tree/diff')
  const cases = ['../etc/passwd', '/etc/passwd', '-rf', 'src/../../secret']
  for (const bad of cases) {
    const response = await route.fetch(request('/api/git-tree/diff?path=' + encodeURIComponent(bad)))
    const body = await response.json()
    assert.equal(body.ok, false, 'must refuse ' + bad)
    assert.equal(body.code, 'bad-request', 'must classify ' + bad + ' as bad-request')
  }
  assert.equal(ctx.spawns.length, 0, 'no git process may run for a rejected path')
})

test('a cwd outside the workspace is refused', async () => {
  const ctx = fakeContext()
  apply(ctx)
  const response = await routeFor(ctx, '/api/git-tree/status').fetch(
    request('/api/git-tree/status?cwd=' + encodeURIComponent('/etc')),
  )
  const body = await response.json()
  assert.equal(body.ok, false)
  assert.equal(body.code, 'outside-workspace')
  assert.equal(ctx.spawns.length, 0)
})

test('missing subprocess degrades instead of throwing', async () => {
  const ctx = fakeContext({ subprocess: undefined })
  apply(ctx)
  const response = await routeFor(ctx, '/api/git-tree/status').fetch(request('/api/git-tree/status'))
  const body = await response.json()
  assert.equal(body.ok, false)
  assert.equal(body.code, 'subprocess-unavailable')
})
