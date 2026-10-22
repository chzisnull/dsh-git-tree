// Repository preferences seam: pin order first, then usage. The storage format,
// the ordering and the two small routes are all exercised here, with DSH_HOME
// pointed at a temp directory so no real preferences are touched.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../index.js'
import {
  normalisePrefs,
  orderWorkspaces,
  preferencesPath,
  readRepositoryPrefs,
  recordOpened,
  togglePinned,
} from '../src/host/repositories.js'

const HOME = mkdtempSync(join(tmpdir(), 'dgt-repo-prefs-'))
process.env.DSH_HOME = HOME
process.on('exit', () => rmSync(HOME, { recursive: true, force: true }))

const WORKSPACES = [
  { id: 'a', path: '/repos/alpha', title: 'alpha' },
  { id: 'b', path: '/repos/beta', title: 'beta' },
  { id: 'c', path: '/repos/gamma', title: 'gamma' },
]

function fakeContext() {
  const routes = []
  return {
    routes,
    connection: { fetch: { register: (route) => { routes.push(route); return () => {} } } },
    get: (service) => {
      if (service === 'workspaceRegistry') return { list: () => WORKSPACES }
      if (service === 'sandboxPolicy') return { workspaceRoot: '/repos/alpha' }
      return undefined
    },
  }
}

function request(path, body) {
  return {
    url: 'https://dsh.internal' + path,
    method: 'POST',
    signal: undefined,
    json: async () => {
      if (body === undefined) throw new Error('no body')
      return JSON.parse(JSON.stringify(body))
    },
  }
}

async function call(ctx, path, body) {
  const route = ctx.routes.find((item) => item.path === path)
  assert.ok(route, 'route not registered: ' + path)
  const response = await route.fetch(request(path, body))
  return { response, body: await response.json() }
}

test('pins keep their order and the rest sort by usage, then recency, then title', () => {
  const prefs = normalisePrefs({
    pinned: ['/repos/gamma'],
    opened: {
      '/repos/alpha': { count: 3, last: 100 },
      '/repos/beta': { count: 3, last: 200 },
      '/repos/gamma': { count: 9, last: 50 },
    },
  })
  const ordered = orderWorkspaces(WORKSPACES, prefs)
  assert.deepEqual(ordered.map((workspace) => workspace.title), ['gamma', 'beta', 'alpha'])
  assert.equal(ordered[0].pinned, true)
  assert.equal(ordered[0].openCount, 9)
  assert.equal(ordered[1].openCount, 3)
  assert.equal(ordered[2].pinned, false)
})

test('a pinned path that left the registry is skipped, its record kept', () => {
  const prefs = normalisePrefs({ pinned: ['/repos/gone', '/repos/beta'], opened: { '/repos/gone': { count: 4, last: 1 } } })
  const ordered = orderWorkspaces(WORKSPACES, prefs)
  assert.equal(ordered[0].title, 'beta')
  assert.equal(ordered.length, 3)
  assert.deepEqual(prefs.pinned, ['/repos/gone', '/repos/beta'], 'the stale pin survives for re-registration')
})

test('pinning toggles without disturbing the rest of the list', () => {
  const base = normalisePrefs({ pinned: ['/repos/alpha'] })
  const added = togglePinned(base, '/repos/beta', true)
  assert.deepEqual(added.pinned, ['/repos/alpha', '/repos/beta'])
  const removed = togglePinned(added, '/repos/alpha', false)
  assert.deepEqual(removed.pinned, ['/repos/beta'])
  const duplicate = togglePinned(togglePinned(base, '/repos/alpha', true), '/repos/alpha', true)
  assert.deepEqual(duplicate.pinned, ['/repos/alpha'], 'pinning twice does not duplicate')
})

test('opening counts up and stamps the time; broken files read as empty', () => {
  let prefs = normalisePrefs(null)
  prefs = recordOpened(prefs, '/repos/alpha', 1000)
  prefs = recordOpened(prefs, '/repos/alpha', 2000)
  assert.deepEqual(prefs.opened['/repos/alpha'], { count: 2, last: 2000 })
  mkdirSync(join(HOME, 'git-tree'), { recursive: true })
  writeFileSync(preferencesPath(), '{ not json')
  assert.deepEqual(readRepositoryPrefs(), { pinned: [], opened: {} })
})

test('the workspaces route returns pins and counts, and the two routes persist them', async () => {
  rmSync(join(HOME, 'git-tree'), { recursive: true, force: true })
  const ctx = fakeContext()
  apply(ctx)

  const pinned = await call(ctx, '/api/git-tree/repositories/pin', { path: '/repos/beta', pinned: true })
  assert.equal(pinned.body.ok, true)
  assert.deepEqual(pinned.body.pinnedPaths, ['/repos/beta'])

  const opened = await call(ctx, '/api/git-tree/repositories/open', { path: '/repos/alpha' })
  assert.equal(opened.body.openCount, 1)

  const workspaces = await call(ctx, '/api/git-tree/workspaces')
  assert.deepEqual(
    workspaces.body.workspaces.map((workspace) => [workspace.title, workspace.pinned, workspace.openCount]),
    [
      ['beta', true, 0],
      ['alpha', false, 1],
      ['gamma', false, 0],
    ],
  )
  const stored = JSON.parse(readFileSync(preferencesPath(), 'utf8'))
  assert.deepEqual(stored.pinned, ['/repos/beta'])
  assert.equal(stored.opened['/repos/alpha'].count, 1)

  const refused = await call(ctx, '/api/git-tree/repositories/pin', { path: '' })
  assert.equal(refused.body.ok, false)
  assert.equal(refused.body.code, 'invalid-path')
})
