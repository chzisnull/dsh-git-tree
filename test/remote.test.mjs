// Fetch and pull seam: which remote a pull means, and what each git failure
// becomes. The route tests drive `apply()` over a fake subprocess; the pure
// functions are imported directly.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../index.js'
import { mapRemoteFailure, parseAheadBehind, resolvePullTarget, splitUpstream } from '../src/host/remote.js'

const WORKSPACE = '/tmp/fake-workspace'

function fakeContext({ handler }) {
  const routes = []
  const spawns = []
  const services = {
    sandboxPolicy: { workspaceRoot: WORKSPACE },
    subprocess: {
      async resolveExecutable(command) {
        assert.equal(command, 'git')
        return '/usr/local/bin/git'
      },
      spawn({ argv, cwd }) {
        spawns.push({ argv, cwd })
        const result = handler(argv)
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
  return {
    routes,
    spawns,
    connection: { fetch: { register: (route) => { routes.push(route); return () => {} } } },
    get: (service) => services[service],
  }
}

function request(path, body = {}) {
  return { url: 'https://dsh.internal' + path, method: 'POST', signal: undefined, json: async () => body }
}

async function call(ctx, path, body) {
  const route = ctx.routes.find((item) => item.path === path)
  assert.ok(route, 'route not registered: ' + path)
  const response = await route.fetch(request(path, body))
  return { response, body: await response.json() }
}

function handlerWith({ upstream = 'origin/main', originBranch = true, fetchFail = null, mergeFail = null } = {}) {
  return (argv) => {
    const command = argv[1]
    if (command === 'remote') return { exitCode: 0, stdout: 'origin\n' }
    if (command === 'symbolic-ref') return { exitCode: 0, stdout: 'main\n' }
    if (command === 'rev-parse') {
      if (argv.includes('@{u}')) {
        return upstream ? { exitCode: 0, stdout: upstream + '\n' } : { exitCode: 128, stderr: 'no upstream' }
      }
      if (argv.includes('--verify')) return originBranch ? { exitCode: 0, stdout: '' } : { exitCode: 1, stderr: '' }
      return { exitCode: 0, stdout: 'abc1234\n' }
    }
    if (command === 'rev-list') return { exitCode: 0, stdout: '2\n' }
    if (command === 'fetch') return fetchFail ?? { exitCode: 0, stdout: '' }
    if (command === 'merge') return mergeFail ?? { exitCode: 0, stdout: '' }
    return { exitCode: 0, stdout: '' }
  }
}

test('upstream splitting keeps branch slashes and refuses garbage', () => {
  assert.deepEqual(splitUpstream('origin/main'), { remote: 'origin', branch: 'main' })
  assert.deepEqual(splitUpstream('origin/feat/deep-branch'), { remote: 'origin', branch: 'feat/deep-branch' })
  assert.equal(splitUpstream(''), null)
  assert.equal(splitUpstream('origin'), null)
  assert.equal(splitUpstream('/main'), null)
})

test('a pull target is the upstream, else origin with the same name, else nothing', () => {
  const upstream = resolvePullTarget({ upstream: 'origin/main', current: 'main', remotes: ['origin'], originBranch: true })
  assert.deepEqual(upstream, { ok: true, remote: 'origin', remoteBranch: 'main', viaUpstream: true })

  const fallback = resolvePullTarget({ upstream: '', current: 'topic', remotes: ['origin'], originBranch: true })
  assert.deepEqual(fallback, { ok: true, remote: 'origin', remoteBranch: 'topic', viaUpstream: false })

  assert.equal(resolvePullTarget({ upstream: '', current: 'topic', remotes: ['origin'], originBranch: false }).code, 'no-upstream')
  assert.equal(resolvePullTarget({ upstream: '', current: 'topic', remotes: [], originBranch: true }).code, 'no-remote')
  assert.equal(
    resolvePullTarget({ upstream: 'upstream/main', current: 'main', remotes: ['origin'], originBranch: true }).code,
    'no-remote',
  )
})

test('failures map to the vocabulary the client already knows', () => {
  assert.equal(mapRemoteFailure('fetch', 'fatal: could not read Username for https://x').code, 'auth-failed')
  assert.equal(mapRemoteFailure('fetch', 'fatal: unable to access: Could not resolve host: github.com').code, 'network-failed')
  assert.equal(mapRemoteFailure('ff-only', 'fatal: Not possible to fast-forward, aborting.').code, 'diverged')
  assert.equal(mapRemoteFailure('merge', 'CONFLICT (content): Merge conflict in app.txt').code, 'merge-conflict')
  assert.equal(mapRemoteFailure('ff-only', 'error: Your local changes would be overwritten by merge.').code, 'dirty-worktree')
  assert.equal(mapRemoteFailure('fetch', 'CONFLICT (content)'), null)
  assert.deepEqual(parseAheadBehind('3\t5\n'), { ahead: 3, behind: 5 })
})

test('fetch runs against the tracked remote with prune', async () => {
  const ctx = fakeContext({ handler: handlerWith() })
  apply(ctx)
  const { body } = await call(ctx, '/api/git-tree/fetch')
  assert.equal(body.ok, true)
  const fetch = ctx.spawns.find((spawn) => spawn.argv[1] === 'fetch')
  assert.deepEqual(fetch.argv.slice(1), ['fetch', 'origin', '--prune'])
})

test('pull fetches then fast-forwards, and reports how many commits arrived', async () => {
  const ctx = fakeContext({ handler: handlerWith() })
  apply(ctx)
  const { body } = await call(ctx, '/api/git-tree/pull', {})
  assert.equal(body.ok, true)
  assert.equal(body.mode, 'ff-only')
  assert.equal(body.pulled, 2)
  assert.equal(body.upstream, 'origin/main')
  const commands = ctx.spawns.map((spawn) => spawn.argv.slice(1).join(' '))
  assert.ok(commands.includes('fetch origin --prune'))
  assert.ok(commands.includes('merge --ff-only origin/main'))
})

test('pull with mode=merge uses a merge commit instead of a fast-forward', async () => {
  const ctx = fakeContext({ handler: handlerWith() })
  apply(ctx)
  const { body } = await call(ctx, '/api/git-tree/pull', { mode: 'merge' })
  assert.equal(body.ok, true)
  assert.equal(body.mode, 'merge')
  const merge = ctx.spawns.find((spawn) => spawn.argv[1] === 'merge')
  assert.deepEqual(merge.argv.slice(1), ['merge', '--no-edit', 'origin/main'])
})

test('a diverged branch is reported as such instead of failing raw', async () => {
  const ctx = fakeContext({
    handler: handlerWith({ mergeFail: { exitCode: 1, stderr: 'fatal: Not possible to fast-forward, aborting.' } }),
  })
  apply(ctx)
  const { body } = await call(ctx, '/api/git-tree/pull', {})
  assert.equal(body.ok, false)
  assert.equal(body.code, 'diverged')
})

test('an overwritten local change and a conflicted merge keep their own codes', async () => {
  const dirty = fakeContext({
    handler: handlerWith({ mergeFail: { exitCode: 1, stderr: 'error: Your local changes to x would be overwritten' } }),
  })
  apply(dirty)
  assert.equal((await call(dirty, '/api/git-tree/pull', {})).body.code, 'dirty-worktree')

  const conflict = fakeContext({
    handler: handlerWith({ mergeFail: { exitCode: 1, stderr: 'CONFLICT (content): Merge conflict in src/app.ts' } }),
  })
  apply(conflict)
  assert.equal((await call(conflict, '/api/git-tree/pull', { mode: 'merge' })).body.code, 'merge-conflict')
})

test('without an upstream it pulls origin/<same branch>, else refuses', async () => {
  const fallback = fakeContext({ handler: handlerWith({ upstream: '', originBranch: true }) })
  apply(fallback)
  const pulled = await call(fallback, '/api/git-tree/pull', {})
  assert.equal(pulled.body.ok, true)
  assert.equal(pulled.body.viaUpstream, false)
  assert.equal(pulled.body.upstream, 'origin/main')

  const missing = fakeContext({ handler: handlerWith({ upstream: '', originBranch: false }) })
  apply(missing)
  const refused = await call(missing, '/api/git-tree/pull', {})
  assert.equal(refused.body.ok, false)
  assert.equal(refused.body.code, 'no-upstream')
})

test('no remote and a detached head are refused before anything runs', async () => {
  const noRemote = fakeContext({
    handler: (argv) => {
      if (argv[1] === 'remote') return { exitCode: 0, stdout: '' }
      if (argv[1] === 'symbolic-ref') return { exitCode: 0, stdout: 'main\n' }
      return { exitCode: 0, stdout: '' }
    },
  })
  apply(noRemote)
  assert.equal((await call(noRemote, '/api/git-tree/pull', {})).body.code, 'no-remote')
  assert.equal((await call(noRemote, '/api/git-tree/fetch')).body.code, 'no-remote')
  assert.equal(noRemote.spawns.some((spawn) => spawn.argv[1] === 'fetch'), false)

  const detached = fakeContext({
    handler: (argv) => {
      if (argv[1] === 'remote') return { exitCode: 0, stdout: 'origin\n' }
      if (argv[1] === 'symbolic-ref') return { exitCode: 1, stderr: '' }
      return { exitCode: 0, stdout: '' }
    },
  })
  apply(detached)
  const { body } = await call(detached, '/api/git-tree/pull', {})
  assert.equal(body.code, 'detached-head')
})

test('authentication failures on fetch are translated', async () => {
  const ctx = fakeContext({
    handler: handlerWith({ fetchFail: { exitCode: 128, stderr: "fatal: could not read Username for 'https://x': terminal prompts disabled" } }),
  })
  apply(ctx)
  const { body } = await call(ctx, '/api/git-tree/pull', {})
  assert.equal(body.code, 'auth-failed')
})
