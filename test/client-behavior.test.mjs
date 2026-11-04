// Execute the shipped client with controllable host responses and just the hooks
// its components use. No DOM, network, real timers, or additional dependencies.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const t = (key) => key
const noop = () => {}
const event = () => ({ clientX: 12, clientY: 24, key: 'Enter', preventDefault: noop, stopPropagation: noop })
const ref = (name) => ({ name, oid: 'abc', upstream: '', committedAt: 1, subject: '', current: false })
const entry = (path) => ({ path, x: '.', y: 'M', kind: 'changed', staged: false, unstaged: true, conflicted: false })
const status = (entries = [], extra = {}) => ({
  ok: true, cwd: '/repo', repoRoot: '/repo', branch: 'main', oid: 'abc',
  remotes: [], identity: { name: 'Ada', email: 'ada@example.test' },
  counts: { staged: 0, unstaged: entries.length, conflicted: 0 }, entries, ...extra,
})
const refs = (extra = {}) => ({ ok: true, branches: [], tags: [], remotes: [], remoteNames: [], ...extra })
const commit = (sha) => ({ sha, subject: sha, author: 'Ada', date: '2026-01-01', lane: 0, parentLanes: [], refs: [] })
const history = (...shas) => ({ ok: true, commits: shas.map(commit), laneCount: 1, hasMore: false })
const detail = (sha, paths = []) => ({ ok: true, sha, subject: sha, files: paths.map((path) => ({ path, status: 'modified' })) })
const diff = (path, text = path) => ({ ok: true, path, text, files: [] })

function nodes(tree, predicate) {
  if (tree == null || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap((node) => nodes(node, predicate))
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return ''
  if (Array.isArray(tree)) return tree.map(text).join(' ')
  return typeof tree === 'object' ? text(tree.props?.children) : String(tree)
}
const hasClass = (name) => (node) => node.props?.className?.split(' ').includes(name)

function client(testContext, focused = false) {
  let active
  const mounted = []
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]))
  const cell = (initial) => {
    assert.ok(active, 'hooks must run inside a mounted component')
    const index = active.cursor++
    return active.cells[index] ??= initial()
  }
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    Fragment: 'Fragment', memo: (component) => component,
    useState(initial) {
      const owner = active
      const state = cell(() => ({ value: typeof initial === 'function' ? initial() : initial }))
      return [state.value, (next) => {
        const value = typeof next === 'function' ? next(state.value) : next
        if (!Object.is(value, state.value)) { state.value = value; owner.dirty = true }
      }]
    },
    useRef: (value) => cell(() => ({ current: value })),
    useMemo(compute, deps) {
      const memo = cell(() => ({}))
      if (!sameDeps(memo.deps, deps)) { memo.value = compute(); memo.deps = deps }
      return memo.value
    },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps) },
    useEffect(effect, deps) {
      const saved = cell(() => ({}))
      if (!sameDeps(saved.deps, deps)) {
        saved.deps = deps
        active.effects.push(() => { saved.cleanup?.(); saved.cleanup = effect() })
      }
    },
  }
  function mount(component, props = {}) {
    const owner = { cells: [], cursor: 0, effects: [], dirty: true, tree: null,
      render() {
        for (let turns = 0; owner.dirty; turns++) {
          assert.ok(turns < 40, 'component must settle after effects')
          owner.dirty = false
          owner.cursor = 0
          active = owner
          try { owner.tree = component(props) } finally { active = null }
          for (const effect of owner.effects.splice(0)) effect()
        }
        return owner.tree
      },
    }
    mounted.push(owner)
    owner.render()
    return owner
  }
  const requests = []
  const copied = []
  const timers = new Map()
  let timerId = 0
  const fetch = (url, options = {}) => {
    const parsed = new URL(url, 'http://client.test/')
    const route = parsed.pathname.replace('/api/git-tree/', '')
    const request = { route, params: Object.fromEntries(parsed.searchParams), options, done: false }
    requests.push(request)
    return new Promise((resolve, reject) => {
      request.respond = (payload) => { request.done = true; resolve({ json: async () => payload }) }
      request.reject = (error) => { request.done = true; reject(error) }
      if (route === 'ai/models') request.respond({ ok: true, groups: [], failures: [], active: null })
      if (route === 'workspaces') request.respond({ ok: true, workspaces: [] })
      if (route === 'fetch') request.respond({ ok: false }) // no automatic follow-up status read
      if (route === 'repositories/open') request.respond({ ok: true })
    })
  }
  const dom = { addEventListener: noop, removeEventListener: noop }
  const win = { ...dom, __ModuleLoader__: { load: (mod) => { factory = mod.factory } } }
  const doc = { ...dom, head: { appendChild: noop }, createElement: () => ({ dataset: {} }), hasFocus: () => focused }
  const require = (name) => { assert.equal(name, 'react'); return react }
  let factory
  // The bundle remains unchanged on disk; only the test's factory exposes these components.
  const instrumented = source.replace('return module.exports;',
    'return { ...module.exports, Workspace, RefRail, HistoryView, TopBar, StatusView, ContextMenu, ConfirmDialog };')
  assert.notEqual(instrumented, source, 'bundle factory return must be instrumentable')
  new Function('window', 'document', 'require', 'fetch', 'navigator', 'setTimeout', 'clearTimeout', 'localStorage', instrumented)(
    win, doc, require, fetch, { clipboard: { writeText: async (value) => { copied.push(value) } } },
    (run, ms) => { timers.set(++timerId, { run, ms }); return timerId },
    (id) => timers.delete(id), { getItem: () => null, setItem: noop },
  )
  const module = factory(require)
  const flush = async () => {
    // Flush the fetch -> json -> component await chain, rendering between turns.
    for (let i = 0; i < 16; i++) {
      await Promise.resolve()
      for (const owner of mounted) owner.render()
    }
  }
  testContext.after(() => {
    for (const owner of mounted) for (const saved of owner.cells) saved.cleanup?.()
  })
  return {
    module, mount, requests, copied, timers, flush,
    pending(route, params = {}) {
      const request = requests.find((item) => !item.done && item.route === route &&
        Object.entries(params).every(([key, value]) => item.params[key] === value))
      assert.ok(request, `expected pending ${route} ${JSON.stringify(params)}`)
      return request
    },
  }
}

async function workspace(tc, entries = [], focused = false, initialRefs = refs()) {
  const app = client(tc, focused)
  const shell = app.mount(app.module.Workspace, { t })
  const props = (name) => {
    shell.render()
    const found = nodes(shell.tree, (node) => node.type === app.module[name])[0]
    assert.ok(found, `${name} must be rendered`)
    return found.props
  }
  app.pending('status').respond(status(entries))
  app.pending('refs').respond(initialRefs)
  await app.flush()
  return { ...app, shell, props }
}

function railProps(payload, calls = []) {
  return { status: status(), refs: payload, view: 'history', t, onView: noop, onCreate: noop,
    onOpenRef: (record, kind) => calls.push(['open', record.name, kind]),
    onCheckout: (name) => calls.push(['checkout', name]), onMerge: (name) => calls.push(['merge', name]),
    onCopyRef: (name) => calls.push(['copy', name]), onRename: noop,
    onDelete: (name) => calls.push(['delete', name]), onForceDelete: (name) => calls.push(['force-delete', name]),
    onDeleteRemote: (record) => calls.push(['delete-remote', record.name, record.oid]),
    onContextMenu: (record, kind) => calls.push(['menu', record.name, kind]),
  }
}

function rowIn(app, rail, name) {
  const element = nodes(rail.tree, (node) => node.props?.record?.name === name)[0]
  assert.ok(element, `reference row ${name} must be visible`)
  return app.mount(element.type, element.props)
}

test('remote refs preserve configured names and only offer history, copy and confirmed deletion', async (tc) => {
  const app = client(tc)
  const calls = []
  // /refs already filters symbolic HEAD on the host; no synthetic HEAD row here.
  const payload = refs({ remoteNames: ['origin', '上游', '上游/团队'], remotes: [ref('origin/feature/a'), ref('上游/团队/修复/界面')] })
  const rail = app.mount(app.module.RefRail, railProps(payload, calls))
  const remoteRows = nodes(rail.tree, (node) => node.props?.kind === 'remote' && node.props.record)
  assert.deepEqual(remoteRows.map((node) => node.props.record.name), payload.remotes.map((record) => record.name))
  for (const name of payload.remoteNames) {
    assert.ok(text(rail.tree).includes(name) || nodes(rail.tree, (node) => node.props?.title === name).length,
      `configured remote group ${name} is labelled`)
  }
  assert.equal(nodes(rail.tree, (node) => node.props?.record?.name.endsWith('/HEAD')).length, 0)
  const groups = nodes(rail.tree, (node) => node.type === 'details')
  assert.equal(groups.length, payload.remoteNames.length)
  assert.ok(groups.every((group) => group.props.open === true), 'remote groups start expanded')
  const group = groups.find((group) => text(nodes(group, (node) => node.type === 'summary')).includes('上游/团队'))
  assert.ok(nodes(group, (node) => node.props?.record?.name === '上游/团队/修复/界面').length,
    'remote names containing slashes use the longest configured prefix')
  const row = rowIn(app, rail, '上游/团队/修复/界面')
  assert.equal(text(nodes(row.tree, hasClass('dgt-rail-name'))), '修复/界面')
  row.tree.props.onClick(event())
  row.tree.props.onKeyDown(event())
  row.tree.props.onDoubleClick?.(event())
  row.tree.props.onContextMenu(event())
  assert.deepEqual(calls, [
    ['open', '上游/团队/修复/界面', 'remote'], ['open', '上游/团队/修复/界面', 'remote'],
    ['menu', '上游/团队/修复/界面', 'remote'],
  ])
  nodes(row.tree, hasClass('dgt-rail-more'))[0].props.onClick(event())
  row.render()
  const menu = nodes(row.tree, hasClass('dgt-menu'))[0]
  assert.ok(menu, 'remote overflow opens')
  const buttons = nodes(menu, (node) => node.type === 'button')
  assert.deepEqual(buttons.map(text).sort(), ['copyRefName', 'history', 'deleteRemoteBranch'].sort())
  buttons.find((button) => text(button) === 'history').props.onClick(event())
  assert.deepEqual(calls.at(-1), ['open', '上游/团队/修复/界面', 'remote'])
  // Reopen after history closes the popover, then exercise copy too.
  row.render()
  nodes(row.tree, hasClass('dgt-rail-more'))[0].props.onClick(event())
  row.render()
  nodes(row.tree, (node) => node.type === 'button' && text(node) === 'copyRefName')[0].props.onClick(event())
  assert.deepEqual(calls.at(-1), ['copy', '上游/团队/修复/界面'])
  row.render()
  nodes(row.tree, hasClass('dgt-rail-more'))[0].props.onClick(event())
  row.render()
  const remove = nodes(row.tree, (node) => node.type === 'button' && text(node) === 'deleteRemoteBranch')[0]
  assert.equal(remove.props['data-danger'], true, 'remote delete is visually dangerous')
  remove.props.onClick(event())
  assert.deepEqual(calls.at(-1), ['delete-remote', '上游/团队/修复/界面', 'abc'])
})

test('tag right-click reaches its callback without throwing', (tc) => {
  const app = client(tc)
  const calls = []
  const rail = app.mount(app.module.RefRail, railProps(refs({ tags: [ref('发布/v1')] }), calls))
  const row = rowIn(app, rail, '发布/v1')
  assert.doesNotThrow(() => row.tree.props.onContextMenu(event()))
  assert.deepEqual(calls, [['menu', '发布/v1', 'tag']])
})

test('remote click requests the exact scope and its context menu adds only dangerous delete', async (tc) => {
  const app = await workspace(tc)
  const record = ref('上游/团队/修复/界面')
  app.props('RefRail').onOpenRef(record, 'remote')
  await app.flush()
  assert.equal(app.pending('history').params.scope, 'remote:' + record.name)
  assert.equal(app.props('HistoryView').scope, 'remote:' + record.name)
  app.props('RefRail').onContextMenu(record, 'remote', event())
  app.shell.render()
  const menu = app.props('ContextMenu').state
  assert.deepEqual(menu.items.filter((item) => !item.divider).map((item) => item.label).sort(), ['copyRefName', 'history', 'deleteRemoteBranch'].sort())
  assert.equal(menu.items.find((item) => item.label === 'deleteRemoteBranch').danger, true)
  await menu.items.find((item) => item.label === 'copyRefName').onSelect()
  assert.deepEqual(app.copied, [record.name])
  assert.equal(app.requests.filter((request) => request.route === 'checkout').length, 0)
})

test('status signature follows remote configuration and committer identity', (tc) => {
  const app = client(tc)
  const base = status()
  const signature = app.module.statusSignature(base)
  assert.equal(app.module.statusSignature(structuredClone(base)), signature)
  for (const change of [
    { remotes: ['origin'] }, { identity: { name: 'Grace', email: base.identity.email } },
    { identity: { ...base.identity, email: 'new@example.test' } }, { identity: null },
  ]) assert.notEqual(app.module.statusSignature({ ...base, ...change }), signature, JSON.stringify(change))
})

test('a slower working-tree diff cannot replace the latest selection', async (tc) => {
  const a = entry('a.js'), b = entry('b.js')
  const app = await workspace(tc, [a, b])
  const old = app.pending('diff', { path: a.path }) // auto-selected first file
  app.props('StatusView').onSelect(b, 'unstaged')
  const current = app.pending('diff', { path: b.path })
  current.respond(diff(b.path, 'newest'))
  await app.flush()
  old.respond(diff(a.path, 'stale'))
  await app.flush()
  assert.equal(app.props('StatusView').diffSelection.entry.path, b.path)
  assert.equal(app.props('StatusView').diff.text, 'newest')
})

test('an obsolete diff error/finally cannot clear a newer loading state', async (tc) => {
  const a = entry('a.js'), b = entry('b.js')
  const app = await workspace(tc, [a, b])
  const old = app.pending('diff', { path: a.path })
  app.props('StatusView').onSelect(b, 'unstaged')
  old.reject(new Error('obsolete diff failure'))
  await app.flush()
  assert.equal(app.props('StatusView').diff, null)
  assert.equal(app.props('StatusView').diffLoading, true)
  app.pending('diff', { path: b.path }).respond(diff(b.path))
  await app.flush()
  assert.equal(app.props('StatusView').diffLoading, false)
})

test('repository switch clears the rail and ignores old refs and diff responses', async (tc) => {
  const app = client(tc)
  const shell = app.mount(app.module.Workspace, { t })
  const props = (name) => nodes(shell.render(), (node) => node.type === app.module[name])[0].props
  app.pending('status').respond(status([entry('old.js')]))
  await app.flush()
  const oldRefs = app.pending('refs')
  const oldDiff = app.pending('diff')
  props('TopBar').onSelectWorkspace('/new')
  await app.flush()
  assert.equal(props('RefRail').refs, null, 'old repository refs clear immediately')
  app.pending('status', { cwd: '/new' }).respond(status([], { cwd: '/new', repoRoot: '/new' }))
  app.pending('refs', { cwd: '/new' }).respond(refs({ branches: [ref('new-branch')] }))
  await app.flush()
  oldRefs.respond(refs({ branches: [ref('old-branch')] }))
  oldDiff.respond(diff('old.js'))
  await app.flush()
  assert.deepEqual(props('RefRail').refs.branches.map((item) => item.name), ['new-branch'])
  assert.equal(props('StatusView').diff, null)
  assert.equal(props('StatusView').diffLoading, false)
})

test('manual refresh reloads the selected diff even when status fields are unchanged', async (tc) => {
  const a = entry('a.js')
  const app = await workspace(tc, [a])
  app.pending('diff').respond(diff(a.path, 'before edit'))
  await app.flush()
  app.props('TopBar').onRefresh()
  app.pending('status').respond(status([a]))
  await app.flush()
  app.pending('refs').respond(refs())
  await app.flush()
  app.pending('diff', { path: a.path }).respond(diff(a.path, 'after edit'))
  await app.flush()
  assert.equal(app.props('StatusView').diff.text, 'after edit')
})

test('history scope changes ignore stale results and stale errors', async (tc) => {
  const app = await workspace(tc, [], false, refs({ remoteNames: ['origin'], remotes: [ref('origin/feature/a')] }))
  app.props('RefRail').onView('history')
  await app.flush()
  const old = app.pending('history', { scope: 'all' })
  app.props('HistoryView').onScope('remote:origin/feature/a')
  await app.flush()
  const current = app.pending('history', { scope: 'remote:origin/feature/a' })
  old.reject(new Error('obsolete history failure'))
  await app.flush()
  assert.equal(app.props('HistoryView').loading, true)
  assert.equal(app.props('HistoryView').error, '')
  current.respond(history('new'))
  await app.flush()
  assert.deepEqual(app.props('HistoryView').commits.map((item) => item.sha), ['new'])
  app.props('HistoryView').onScope('tag:v1')
  await app.flush()
  const prior = app.pending('history', { scope: 'tag:v1' })
  app.props('HistoryView').onScope('current')
  await app.flush()
  app.pending('history', { scope: 'current' }).respond(history('current'))
  await app.flush()
  prior.respond(history('stale'))
  await app.flush()
  assert.deepEqual(app.props('HistoryView').commits.map((item) => item.sha), ['current'])
})

test('old repository history cannot populate the new repository', async (tc) => {
  const app = await workspace(tc)
  app.props('RefRail').onView('history')
  await app.flush()
  const old = app.pending('history')
  app.props('TopBar').onSelectWorkspace('/new')
  await app.flush()
  app.props('RefRail').onView('history')
  await app.flush()
  app.pending('history', { cwd: '/new' }).respond(history('new-repo'))
  await app.flush()
  old.respond(history('old-repo'))
  await app.flush()
  assert.deepEqual(app.props('HistoryView').commits.map((item) => item.sha), ['new-repo'])
})

test('commit detail and its automatic diff follow the selected SHA', async (tc) => {
  const app = await workspace(tc)
  app.props('RefRail').onView('history')
  await app.flush()
  app.pending('history').respond(history('a', 'b', 'c'))
  await app.flush()
  app.props('HistoryView').onSelect(commit('a'))
  await app.flush()
  const old = app.pending('commit-info', { sha: 'a' })
  app.props('HistoryView').onSelect(commit('b'))
  await app.flush()
  app.pending('commit-info', { sha: 'b' }).respond(detail('b', ['b.js']))
  await app.flush()
  const oldFile = app.pending('diff', { commit: 'b' })
  old.respond(detail('a', ['a.js']))
  await app.flush()
  assert.equal(app.props('HistoryView').detail.sha, 'b')
  assert.equal(app.requests.some((request) => request.route === 'diff' && request.params.commit === 'a'), false,
    'obsolete detail must not launch another file diff')
  app.props('HistoryView').onSelect(commit('c'))
  await app.flush()
  app.pending('commit-info', { sha: 'c' }).respond(detail('c', ['c.js']))
  await app.flush()
  app.pending('diff', { commit: 'c' }).respond(diff('c.js', 'current commit'))
  await app.flush()
  oldFile.respond(diff('b.js', 'obsolete commit'))
  await app.flush()
  assert.equal(app.props('HistoryView').selectedSha, 'c')
  assert.equal(app.props('HistoryView').fileDiff.text, 'current commit')
})

test('commit-file selection ignores a slower sibling file diff', async (tc) => {
  const app = await workspace(tc)
  app.props('RefRail').onView('history')
  await app.flush()
  app.pending('history').respond(history('a'))
  await app.flush()
  app.props('HistoryView').onSelect(commit('a'))
  await app.flush()
  app.pending('commit-info', { sha: 'a' }).respond(detail('a', ['one.js', 'two.js']))
  await app.flush()
  const old = app.pending('diff', { path: 'one.js', commit: 'a' })
  app.props('HistoryView').onSelectFile('two.js')
  old.reject(new Error('obsolete file diff failure'))
  await app.flush()
  assert.equal(app.props('HistoryView').fileDiff, null)
  assert.equal(app.props('HistoryView').fileDiffLoading, true)
  app.pending('diff', { path: 'two.js', commit: 'a' }).respond(diff('two.js', 'selected file'))
  await app.flush()
  assert.equal(app.props('HistoryView').selectedFile, 'two.js')
  assert.equal(app.props('HistoryView').fileDiff.text, 'selected file')
})

test('remote history keeps its scope chip, ref chip, and clear action', (tc) => {
  const app = client(tc)
  const record = commit('abc')
  record.refs = [{ kind: 'remote', name: 'origin/修复/界面' }]
  let cleared = 0
  const view = app.mount(app.module.HistoryView, {
    commits: [record], laneCount: 1, hasMore: false, loading: false, error: '', scope: 'remote:origin/修复/界面',
    mode: 'history', query: '', author: '', path: '', selectedSha: '', detail: null, detailLoading: false,
    detailError: '', selectedFile: '', fileDiff: null, fileDiffLoading: false, t,
    onClearScope: () => cleared++, onScope: noop, onSelect: noop, onLoadMore: noop,
    onSelectFile: noop, onParent: noop, onContextMenu: noop,
  })
  const scope = nodes(view.tree, hasClass('dgt-scope'))[0]
  assert.ok(scope, 'remote scope has a visible chip')
  assert.ok(text(scope).includes('origin/修复/界面'))
  assert.ok(!text(scope).includes('remote:'), 'scope prefix is not displayed')
  const chip = nodes(view.tree, hasClass('dgt-refchip'))[0]
  assert.equal(chip.props['data-kind'], 'remote')
  assert.equal(text(chip), 'origin/修复/界面')
  nodes(scope, (node) => node.type === 'button')[0].props.onClick(event())
  assert.equal(cleared, 1)
})

test('remote rail distinguishes loading, no remotes, and an unfetched configured remote', (tc) => {
  const app = client(tc)
  for (const [payload, expected, absent] of [
    [null, 'loading', 'noRemotes'],
    [refs(), 'noRemotes', 'noRemoteBranches'],
    [refs({ remoteNames: ['origin'] }), 'noRemoteBranches', 'noRemotes'],
  ]) {
    const rail = app.mount(app.module.RefRail, railProps(payload))
    assert.ok(text(rail.tree).includes(expected), expected)
    assert.ok(!text(rail.tree).includes(absent), absent + ' must not describe this state')
  }
  const fallback = railProps(null)
  fallback.status.remotes = ['origin']
  // A legacy host without remoteNames still provides the configured names via status.
  fallback.refs = { ok: true, branches: [], tags: [], remotes: [] }
  const rail = app.mount(app.module.RefRail, fallback)
  assert.ok(nodes(rail.tree, (node) => node.type === 'summary' && text(node).includes('origin')).length)
  assert.ok(text(rail.tree).includes('remoteSnapshot'))
})

test('same-repository refs refresh ignores older snapshots and preserves the last snapshot on error', async (tc) => {
  const app = await workspace(tc)
  app.props('TopBar').onRefresh()
  app.pending('status').respond(status())
  await app.flush()
  const old = app.pending('refs')
  app.props('TopBar').onRefresh()
  app.pending('status').respond(status())
  await app.flush()
  const current = app.requests.findLast((request) => request.route === 'refs' && !request.done)
  assert.notEqual(current, old, 'each manual refresh reads refs')
  current.respond(refs({ remoteNames: ['origin'], remotes: [ref('origin/new')] }))
  await app.flush()
  old.respond(refs({ remoteNames: ['origin'], remotes: [ref('origin/old')] }))
  await app.flush()
  assert.deepEqual(app.props('RefRail').refs.remotes.map((record) => record.name), ['origin/new'])
  app.props('TopBar').onRefresh()
  app.pending('status').respond(status())
  await app.flush()
  app.pending('refs').respond({ ok: false, error: 'refs unavailable' })
  await app.flush()
  assert.deepEqual(app.props('RefRail').refs.remotes.map((record) => record.name), ['origin/new'])
  const rail = app.mount(app.module.RefRail, app.props('RefRail'))
  assert.ok(text(rail.tree).includes('refs unavailable'), 'failed refs reads have a visible error')
  assert.ok(!text(rail.tree).includes('noRemotes'), 'an error does not masquerade as no remotes')
})

test('debounced search ignores an older query response', async (tc) => {
  const app = await workspace(tc)
  app.props('RefRail').onView('search')
  await app.flush()
  const search = async (query) => {
    app.props('HistoryView').onQuery(query)
    app.shell.render()
    const timer = [...app.timers.values()].find((timer) => timer.ms === 350)
    assert.ok(timer, 'search input is debounced')
    timer.run()
    await app.flush()
    return app.pending('history', { query })
  }
  const old = await search('before')
  const current = await search('after')
  current.respond(history('new-query'))
  await app.flush()
  old.respond(history('old-query'))
  await app.flush()
  assert.deepEqual(app.props('HistoryView').commits.map((record) => record.sha), ['new-query'])
})

test('obsolete detail errors do not clear the newer commit loading state', async (tc) => {
  const app = await workspace(tc)
  app.props('RefRail').onView('history')
  await app.flush()
  app.props('HistoryView').onSelect(commit('a'))
  await app.flush()
  const old = app.pending('commit-info', { sha: 'a' })
  app.props('HistoryView').onSelect(commit('b'))
  await app.flush()
  old.reject(new Error('obsolete detail failure'))
  await app.flush()
  assert.equal(app.props('HistoryView').detailError, '')
  assert.equal(app.props('HistoryView').detailLoading, true)
  app.pending('commit-info', { sha: 'b' }).respond(detail('b'))
  await app.flush()
  assert.equal(app.props('HistoryView').detail.sha, 'b')
})

test('old repository detail cannot populate the newly selected commit', async (tc) => {
  const app = await workspace(tc)
  app.props('RefRail').onView('history')
  await app.flush()
  app.props('HistoryView').onSelect(commit('old'))
  await app.flush()
  const old = app.pending('commit-info', { sha: 'old' })
  app.props('TopBar').onSelectWorkspace('/new')
  await app.flush()
  app.props('RefRail').onView('history')
  await app.flush()
  app.props('HistoryView').onSelect(commit('new'))
  await app.flush()
  app.pending('commit-info', { sha: 'new', cwd: '/new' }).respond(detail('new'))
  await app.flush()
  old.respond(detail('old', ['old.js']))
  await app.flush()
  assert.equal(app.props('HistoryView').detail.sha, 'new')
  assert.equal(app.requests.some((request) => request.route === 'diff' && request.params.commit === 'old'), false)
})

test('a watched status poll reloads the selected diff when only file contents changed', async (tc) => {
  const a = entry('a.js')
  const app = await workspace(tc, [a], true)
  app.pending('diff').respond(diff(a.path, 'before poll'))
  await app.flush()
  const tick = [...app.timers.values()].find((timer) => timer.ms === 0)
  assert.ok(tick, 'the watched panel schedules its poll')
  tick.run()
  app.pending('status').respond(status([a]))
  await app.flush()
  app.pending('diff', { path: a.path }).respond(diff(a.path, 'after poll'))
  await app.flush()
  assert.equal(app.props('StatusView').diff.text, 'after poll')
})

test('manual refresh reloads the active history scope and refs', async (tc) => {
  const app = await workspace(tc)
  app.props('RefRail').onOpenRef(ref('origin/main'), 'remote')
  await app.flush()
  app.pending('history').respond(history('before'))
  await app.flush()
  app.props('TopBar').onRefresh()
  app.pending('status').respond(status())
  await app.flush()
  app.pending('refs').respond(refs({ remoteNames: ['origin'], remotes: [ref('origin/main')] }))
  await app.flush()
  app.pending('history', { scope: 'remote:origin/main' }).respond(history('after'))
  await app.flush()
  assert.deepEqual(app.props('HistoryView').commits.map((record) => record.sha), ['after'])
})

test('clicking the same remote twice lets its in-flight history finish', async (tc) => {
  const record = ref('origin/topic')
  const app = await workspace(tc, [], false, refs({ remoteNames: ['origin'], remotes: [record] }))
  app.props('RefRail').onOpenRef(record, 'remote')
  await app.flush()
  const pending = app.pending('history', { scope: 'remote:origin/topic' })
  app.props('RefRail').onOpenRef(record, 'remote')
  await app.flush()
  pending.respond(history('topic-commit'))
  await app.flush()
  assert.deepEqual(app.props('HistoryView').commits.map((item) => item.sha), ['topic-commit'])
  assert.equal(app.props('HistoryView').loading, false)
})

test('clicking the selected commit twice lets its in-flight detail finish', async (tc) => {
  const app = await workspace(tc)
  app.props('RefRail').onView('history')
  await app.flush()
  app.pending('history').respond(history('a'))
  await app.flush()
  app.props('HistoryView').onSelect(commit('a'))
  await app.flush()
  const pending = app.pending('commit-info', { sha: 'a' })
  app.props('HistoryView').onSelect(commit('a'))
  await app.flush()
  pending.respond(detail('a'))
  await app.flush()
  assert.equal(app.props('HistoryView').detail?.sha, 'a')
  assert.equal(app.props('HistoryView').detailLoading, false)
})

test('an AI response from the previous repository cannot overwrite the new draft', async (tc) => {
  const app = await workspace(tc, [entry('old.js')])
  app.props('StatusView').ai.onGenerate()
  const pending = app.pending('commit-message')
  app.props('TopBar').onSelectWorkspace('/new')
  await app.flush()
  app.pending('status', { cwd: '/new' }).respond(status([], { cwd: '/new', repoRoot: '/new' }))
  await app.flush()
  app.props('StatusView').onMessage('new repository draft')
  pending.respond({ ok: true, message: 'old repository generated message' })
  await app.flush()
  assert.equal(app.props('StatusView').message, 'new repository draft')
  assert.equal(app.props('StatusView').ai.busy, false)
  assert.equal(app.props('StatusView').actionError, '')
})

function confirmDeletion(app) {
  const props = app.props('ConfirmDialog')
  const dialog = app.mount(app.module.ConfirmDialog, props)
  if (props.confirmText) {
    nodes(dialog.tree, (node) => node.type === 'input')[0].props.onChange({ target: { value: props.confirmText } })
    dialog.render()
  }
  const submit = nodes(dialog.tree, (node) => node.type === 'button' && text(node) === props.submitLabel)[0]
  assert.equal(Boolean(submit.props.disabled), false)
  submit.props.onClick(event())
}

test('strong confirmation requires the exact full name and blocks Enter until it matches', (tc) => {
  const app = client(tc)
  const name = '上游/团队/修复/界面'
  let submitted = 0
  const props = { title: 'delete', body: name, submitLabel: 'confirm-delete', confirmText: name,
    busy: false, error: '', t, onCancel: noop, onConfirm: () => submitted++ }
  const dialog = app.mount(app.module.ConfirmDialog, props)
  const submit = () => nodes(dialog.tree, (node) => node.type === 'button' && text(node) === props.submitLabel)[0]
  const input = () => nodes(dialog.tree, (node) => node.type === 'input')[0]
  assert.equal(submit().props.disabled, true)
  for (const value of ['修复/界面', name + ' ', ' ' + name]) {
    input().props.onChange({ target: { value } })
    dialog.render()
    assert.equal(submit().props.disabled, true, JSON.stringify(value))
    input().props.onKeyDown?.(event())
  }
  assert.equal(submitted, 0)
  input().props.onChange({ target: { value: name } })
  dialog.render()
  assert.equal(submit().props.disabled, false)
  submit().props.onClick(event())
  assert.equal(submitted, 1)
  const busy = app.mount(app.module.ConfirmDialog, { ...props, busy: true })
  nodes(busy.tree, (node) => node.type === 'input')[0].props.onChange({ target: { value: name } })
  busy.render()
  assert.equal(nodes(busy.tree, (node) => node.type === 'button' && text(node) === props.submitLabel)[0].props.disabled, true)
})

test('local branch menus expose force delete and disable both deletion choices for the current branch', async (tc) => {
  const app = client(tc)
  const calls = []
  const current = { ...ref('main'), current: true }
  const rail = app.mount(app.module.RefRail, railProps(refs({ branches: [current, ref('topic')] }), calls))
  for (const name of ['main', 'topic']) {
    const row = rowIn(app, rail, name)
    nodes(row.tree, hasClass('dgt-rail-more'))[0].props.onClick(event())
    row.render()
    for (const label of ['deleteBranch', 'forceDeleteBranch']) {
      const button = nodes(row.tree, (node) => node.type === 'button' && text(node) === label)[0]
      assert.ok(button, label)
      assert.equal(Boolean(button.props.disabled), name === 'main')
      button.props.onClick(event())
    }
  }
  assert.deepEqual(calls, [['delete', 'topic'], ['force-delete', 'topic']])
  const shell = await workspace(tc)
  shell.props('RefRail').onContextMenu(current, 'branch', event())
  const actions = shell.props('ContextMenu').state.items
  for (const label of ['deleteBranch', 'forceDeleteBranch']) {
    assert.equal(actions.find((item) => item.label === label)?.disabled, true)
    assert.equal(actions.find((item) => item.label === label)?.danger, true)
  }
})

for (const kind of ['normal', 'force', 'remote']) {
  test(`${kind} deletion opens a confirmation and cancellation performs no mutation`, async (tc) => {
    const app = await workspace(tc)
    const record = ref('origin/修复/界面')
    const rail = app.props('RefRail')
    if (kind === 'remote') rail.onDeleteRemote(record)
    else if (kind === 'force') rail.onForceDelete(record.name)
    else rail.onDelete(record.name)
    const dialog = app.props('ConfirmDialog')
    assert.equal(dialog.confirmText, kind === 'normal' ? undefined : record.name)
    assert.equal(app.requests.some((request) => request.route.startsWith('branch/delete')), false)
    dialog.onCancel()
    await app.flush()
    assert.equal(nodes(app.shell.tree, (node) => node.type === app.module.ConfirmDialog).length, 0)
    assert.equal(app.requests.some((request) => request.route.startsWith('branch/delete')), false)
  })
}

for (const kind of ['force', 'remote']) {
  test(`${kind} confirmation cannot submit after switching repository`, async (tc) => {
    const app = await workspace(tc)
    const record = ref('origin/topic')
    if (kind === 'remote') app.props('RefRail').onDeleteRemote(record)
    else app.props('RefRail').onForceDelete(record.name)
    const old = app.props('ConfirmDialog')
    app.props('TopBar').onSelectWorkspace('/new')
    await app.flush()
    old.onConfirm()
    await app.flush()
    assert.equal(nodes(app.shell.tree, (node) => node.type === app.module.ConfirmDialog).length, 0)
    assert.equal(app.requests.some((request) => request.route.startsWith('branch/delete')), false)
  })

  test(`${kind} deletion failure keeps its confirmation and error visible`, async (tc) => {
    const app = await workspace(tc)
    const record = ref('origin/topic')
    if (kind === 'remote') app.props('RefRail').onDeleteRemote(record)
    else app.props('RefRail').onForceDelete(record.name)
    confirmDeletion(app)
    app.pending(kind === 'remote' ? 'branch/delete-remote' : 'branch/delete').respond({ ok: false, error: 'delete rejected' })
    await app.flush()
    assert.equal(app.props('ConfirmDialog').error, 'delete rejected')
    assert.equal(app.props('ConfirmDialog').busy, false)
    assert.equal(app.props('ConfirmDialog').confirmText, record.name)
  })
}

for (const [kind, scopeKind, expectedScope] of [
  ['remote', 'remote', 'all'], ['remote', 'branch', 'branch:origin/topic'],
  ['force', 'branch', 'all'], ['force', 'remote', 'remote:origin/topic'], ['normal', 'branch', 'all'],
]) {
  test(`${kind} deletion refreshes refs/history and preserves only a different ref kind (${scopeKind})`, async (tc) => {
    const record = { ...ref('origin/topic'), oid: 'a'.repeat(40) }
    const initial = refs({ remoteNames: ['origin'], branches: [record], remotes: [record] })
    const app = await workspace(tc, [], false, initial)
    app.props('RefRail').onOpenRef(record, scopeKind)
    await app.flush()
    app.pending('history').respond(history('before'))
    await app.flush()
    if (kind === 'remote') app.props('RefRail').onDeleteRemote(record)
    else if (kind === 'force') app.props('RefRail').onForceDelete(record.name)
    else app.props('RefRail').onDelete(record.name)
    assert.equal(app.requests.some((request) => request.route.startsWith('branch/delete')), false)
    confirmDeletion(app)
    const request = app.pending(kind === 'remote' ? 'branch/delete-remote' : 'branch/delete')
    assert.deepEqual(JSON.parse(request.options.body), kind === 'remote'
      ? { name: record.name, expectedOid: record.oid } : { name: record.name, force: kind === 'force' })
    request.respond({ ok: true })
    await app.flush()
    const remaining = refs({ remoteNames: ['origin'], branches: kind === 'remote' ? [record] : [], remotes: kind === 'remote' ? [] : [record] })
    const refreshed = new Set()
    for (let turn = 0; turn < 4; turn++) {
      for (const read of app.requests.filter((item) => !item.done && ['refs', 'status'].includes(item.route))) {
        refreshed.add(read.route)
        read.respond(read.route === 'refs' ? remaining : status())
      }
      await app.flush()
    }
    assert.deepEqual([...refreshed].sort(), ['refs', 'status'])
    assert.equal(app.props('HistoryView').scope, expectedScope)
    app.pending('history', { scope: expectedScope }).respond(history('after'))
    await app.flush()
    assert.deepEqual(app.props('HistoryView').commits.map((item) => item.sha), ['after'])
    assert.equal(nodes(app.shell.tree, (node) => node.type === app.module.ConfirmDialog).length, 0)
  })
}
