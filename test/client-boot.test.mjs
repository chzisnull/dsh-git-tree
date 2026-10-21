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

/** A context that only exposes declared services, like Cordis's inject fence. */
function cordisLikeContext(declared) {
  const registrations = []
  const effects = []
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
  const target = {}
  for (const name of declared) target[name] = services[name]
  target.effect = services.effect
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
