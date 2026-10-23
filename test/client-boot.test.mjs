// Boot contract for the client half.
//
// The browser half was never executed in a real Harness before 0.2.0, and the
// first attempt failed because `apply` used a service it had not declared in
// `inject`. This test closes that hole without a DOM harness: it evaluates the
// built bundle in Node, materialises the plugin with a module table stub, and
// calls `apply` against a context that throws exactly like Cordis does when an
// undeclared service is touched.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const source = readFileSync(join(root, 'client.js'), 'utf8')

const react = {
  createElement: () => null,
  useState: (value) => [value, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
  Fragment: 'Fragment',
}

function evaluateBundle() {
  let factory
  const win = { __ModuleLoader__: { load: (mod) => { factory = mod.factory } } }
  const tag = { dataset: {}, textContent: '', parentNode: null }
  const doc = {
    createElement: () => tag,
    head: { appendChild: () => {} },
  }
  const require = (specifier) => {
    if (specifier === 'react') return react
    throw new Error('unexpected module request: ' + specifier)
  }
  new Function('window', 'document', 'require', source)(win, doc, require)
  assert.equal(typeof factory, 'function', 'bundle must register a factory')
  const module = factory(require)
  assert.equal(typeof module.apply, 'function', 'client module must export apply')
  return module
}

/**
 * A context that only exposes declared services, like Cordis's inject fence.
 * `available` adds services that exist in the container but are not declared in
 * `inject`; they stay reachable through `ctx.get(name)` and `ctx.inject([...])`.
 */
function cordisLikeContext(declared, available = {}) {
  const registrations = []
  const effects = []
  const provided = { ...available }
  const services = {
    effect(effect) {
      effects.push(effect)
      return effect()
    },
    locale: {
      register: () => () => {},
      bind: () => (key) => key,
    },
    slots: {
      inject: (_owner, callback) => callback(),
      register: (options, component) => {
        registrations.push({ options, component })
      },
    },
  }
  const serviceOf = (name) => (name in provided ? provided[name] : services[name])
  const target = {
    effect: services.effect,
    get: (name) => {
      const service = serviceOf(name)
      return service === undefined ? null : service
    },
    inject: (deps, callback) => {
      // Cordis starts the child fiber only once every dependency is provided.
      if (!deps.every((name) => serviceOf(name) !== undefined)) return () => {}
      return callback(cordisLikeContext([...new Set([...declared, ...deps])], provided).ctx)
    },
  }
  for (const name of declared) target[name] = serviceOf(name)
  const ctx = new Proxy(target, {
    get(object, property) {
      if (typeof property === 'symbol') return object[property]
      if (!(property in object)) {
        throw new Error('cannot get property "' + String(property) + '" without inject')
      }
      return object[property]
    },
  })
  return { ctx, registrations, effects }
}

/** Minimal shortcuts service: records commands and serves a live catalog. */
function shortcutService() {
  const commands = []
  const rows = []
  const listeners = new Set()
  return {
    commands,
    register(command) {
      commands.push(command)
      return () => {
        const at = commands.indexOf(command)
        if (at !== -1) commands.splice(at, 1)
      }
    },
    catalog: {
      getSnapshot: () => rows,
      subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
    publish(next) {
      rows.splice(0, rows.length, ...next)
      for (const listener of [...listeners]) listener()
    },
  }
}

/** Minimal layout service: one active main panel plus the calls it received. */
function layoutService(activePanelId = null) {
  const calls = []
  const state = { activePanelId }
  return {
    calls,
    selectPanel(panelId) {
      calls.push(panelId)
      state.activePanelId = panelId
    },
    panelInfo: {
      getSnapshot: () => ({ activePanelId: state.activePanelId }),
      subscribe: () => () => {},
    },
  }
}

test('the client plugin declares every service its apply touches', () => {
  const module = evaluateBundle()
  assert.ok(Array.isArray(module.inject), 'client module must export inject')
  assert.ok(module.inject.includes('slots'), 'slots must be declared')
  assert.ok(module.inject.includes('locale'), 'locale must be declared (apply registers dictionaries)')
})

test('apply materialises against a Cordis-like context without throwing', () => {
  const module = evaluateBundle()
  const { ctx, registrations } = cordisLikeContext(module.inject)

  assert.doesNotThrow(() => module.apply(ctx))

  assert.equal(registrations.length, 2, 'exactly one launcher and one panel registration')
  const names = registrations.map((entry) => entry.options.name).sort()
  assert.deepEqual(names, ['main', 'sidebar.panellist'])
  const panel = registrations.find((entry) => entry.options.name === 'main')
  const launcher = registrations.find((entry) => entry.options.name === 'sidebar.panellist')
  assert.equal(panel.options.key, 'git-tree')
  assert.equal(launcher.options.id, 'git-tree')
  assert.equal(typeof launcher.component, 'function')
  assert.equal(typeof panel.component, 'function')
})

test('apply registers its dictionaries with the locale service', () => {
  const module = evaluateBundle()
  const registered = []
  const services = {
    effect: (effect) => effect(),
    locale: { register: (ns, dicts) => { registered.push({ ns, dicts }); return () => {} }, bind: () => (key) => key },
    slots: { inject: (_owner, callback) => callback(), register: () => {} },
  }
  const target = {}
  for (const name of module.inject) target[name] = services[name]
  target.effect = services.effect
  module.apply(target)
  assert.equal(registered.length, 1)
  assert.equal(registered[0].ns, 'dsh-git-tree')
  assert.ok(registered[0].dicts.en && registered[0].dicts.zh)
})

// ── keyboard shortcut (0.11.0) ─────────────────────────────────────────────
//
// The shortcut rides an optional Harness service. These tests pin the two
// halves that matter: the command shape the app validates (one wrong default
// makes registration throw), and the guarantee that a Harness without the
// service still gets a working panel.

function applyWith(available = {}) {
  const module = evaluateBundle()
  const warnings = []
  const originalWarn = console.warn
  console.warn = (...args) => warnings.push(args.join(' '))
  try {
    const { ctx, registrations } = cordisLikeContext(module.inject, available)
    const thrown = (() => {
      try {
        module.apply(ctx)
        return null
      } catch (error) {
        return error
      }
    })()
    return { module, ctx, registrations, warnings, thrown }
  } finally {
    console.warn = originalWarn
  }
}

test('the shortcuts service stays optional, so an older Harness still loads the panel', () => {
  const module = evaluateBundle()
  assert.ok(!module.inject.includes('shortcuts'), 'shortcuts must not be a hard inject dependency')

  const withoutService = applyWith()
  assert.equal(withoutService.thrown, null, 'apply must not throw without the service')
  assert.equal(withoutService.registrations.length, 2, 'launcher and panel still register')
})

test('the panel registers one global toggle command with the agreed defaults', () => {
  const shortcuts = shortcutService()
  const layout = layoutService(null)
  const { thrown } = applyWith({ shortcuts, layout })
  assert.equal(thrown, null)
  assert.equal(shortcuts.commands.length, 1)

  const command = shortcuts.commands[0]
  assert.equal(command.id, 'panel.git-tree.toggle')
  assert.deepEqual(command.defaults['desktop:macos'], { code: 'KeyV', modifiers: ['primary', 'shift'] })
  assert.deepEqual(command.defaults['desktop:windows'], { code: 'KeyV', modifiers: ['primary', 'shift'] })
  assert.deepEqual(command.defaults['web:macos'], { code: 'KeyV', modifiers: ['primary', 'shift'] })
  assert.deepEqual(command.defaults['web:windows'], { code: 'KeyV', modifiers: ['primary', 'shift'] })
  assert.equal(command.defaults['desktop:linux'], undefined, 'Linux rejects primary+KeyV as reserved')
  assert.equal(command.defaults['web:linux'], undefined)
  // Text fields are included: closing the panel focuses the composer, and the
  // second press has to reopen it there too (desktop ignores regions anyway).
  assert.deepEqual(command.regions, ['page', 'editable', 'terminal'])
  assert.deepEqual(command.modals, [])
  assert.ok(command.aliases.includes('source control'), 'the alias list is searchable in Settings')
  assert.equal(typeof command.label(), 'string')
})

test('the command opens the panel, and closes it when it is already open', () => {
  const shortcuts = shortcutService()
  const layout = layoutService(null)
  applyWith({ shortcuts, layout })

  const command = shortcuts.commands[0]
  assert.equal(command.resolve({}).status, 'handled')
  command.resolve({}).run()
  assert.deepEqual(layout.calls, ['git-tree'], 'first press opens the panel')

  command.resolve({}).run()
  assert.deepEqual(layout.calls, ['git-tree', null], 'second press returns to the conversation')

  // A panel that is not the active one is opened, never toggled off.
  layout.selectPanel('files')
  command.resolve({}).run()
  assert.deepEqual(layout.calls, ['git-tree', null, 'files', 'git-tree'])
})

test('a rejected registration degrades to no shortcut instead of a broken panel', () => {
  const shortcuts = shortcutService()
  shortcuts.register = () => {
    throw new Error('Conflicting shortcut defaults: panel.git-tree.toggle and workspace.files (web:macos)')
  }
  const { thrown, registrations, warnings } = applyWith({ shortcuts, layout: layoutService(null) })
  assert.equal(thrown, null, 'a reserved/conflicting default must never break apply')
  assert.equal(registrations.length, 2, 'the panel keeps working')
  assert.ok(
    warnings.some((line) => line.includes('keyboard shortcut')),
    'the rejection is reported once, not swallowed silently',
  )
})

test('an unwired or throwing shortcuts service leaves the toggle inert', () => {
  const layout = layoutService(null)
  // register() works but the service has no catalog: keys stay null.
  const shortcuts = { register: () => () => {} }
  const { thrown } = applyWith({ shortcuts, layout })
  assert.equal(thrown, null)
  assert.deepEqual(layout.calls, [])
})

test('keycaps come from the live catalog, and disappear when unbound', () => {
  const shortcuts = shortcutService()
  const { module } = applyWith({ shortcuts, layout: layoutService(null) })

  assert.equal(module.shortcutKeys(shortcuts), null, 'no published row yet')
  shortcuts.publish([{ id: 'panel.git-tree.toggle', keys: ['⌘', '⇧', 'V'] }])
  assert.deepEqual(module.shortcutKeys(shortcuts), ['⌘', '⇧', 'V'])
  assert.deepEqual(module.keycapParts(['⌘', '⇧', 'V']), ['⌘', '⇧', 'V'])
  assert.deepEqual(module.keycapParts(['Ctrl', '+', 'Shift', '+', 'V']), ['Ctrl', 'Shift', 'V'])

  shortcuts.publish([{ id: 'panel.git-tree.toggle', keys: [] }])
  assert.equal(module.shortcutKeys(shortcuts), null, 'an unbound command renders no badge')
  assert.equal(module.shortcutKeys(null), null)
  assert.equal(module.shortcutKeys({}), null)
})

test('a panel-owned overlay holds the shortcut still', () => {
  const shortcuts = shortcutService()
  const layout = layoutService(null)
  const { module } = applyWith({ shortcuts, layout })

  const command = shortcuts.commands[0]
  const release = module.holdShortcut()
  const held = command.resolve({})
  assert.equal(held.status, 'blocked', 'consumed but inert while an overlay is open')
  assert.equal(held.run, undefined)
  assert.deepEqual(layout.calls, [], 'an open dialog (or AI preview) owns the keyboard')

  release()
  release()
  command.resolve({}).run()
  assert.deepEqual(layout.calls, ['git-tree'], 'after the overlay closes the toggle works again')

  // The preview path is the one that would lose work: a second hold is additive.
  const first = module.holdShortcut()
  const second = module.holdShortcut()
  first()
  assert.equal(command.resolve({}).status, 'blocked', 'still held by the second overlay')
  second()
  command.resolve({}).run()
  assert.deepEqual(layout.calls, ['git-tree', null])
})

test('togglePanel closes only the panel it owns', () => {
  const layout = layoutService('files')
  const { module } = applyWith({})
  assert.equal(module.togglePanel(layout), 'open')
  assert.deepEqual(layout.calls, ['git-tree'])
  assert.equal(module.togglePanel(layout), 'close')
  assert.deepEqual(layout.calls, ['git-tree', null])
  assert.equal(module.togglePanel(null), 'none', 'a missing layout service is not an error')
})
