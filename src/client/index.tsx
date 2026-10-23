// dsh-git-tree — client half entry (browser artifact source).
//
// This file is bundled by `build.mjs` (esbuild, CJS) and wrapped in the DSH
// module-loader factory. Inside the wrapper, `require` is the browser module
// table of the running Harness; `react` is one of its frozen entries, so no
// React installation or import is needed (and none is allowed).
//
// The panel occupies the layout's root-scoped `main` keyed slot under the key
// `git-tree`; the sidebar icon registered into `sidebar.panellist` with the
// same id is the launcher (`ctx.layout.selectPanel` runs inside the window
// chrome when that row is clicked). Both slot ids and that pairing are
// documented in the shipped layout/sidebar READMEs and verified against
// `dsh-client-ui-layout/lib/client.js` and `dsh-client-ui-sidebar/lib/client.js`.
//
// Visible copy goes through the Client locale service (`ctx.locale`), and every
// color comes from a `--dsw-*` theme token so the panel inherits light/dark.
// The panel itself lives in `components/Workspace`; this entry wires the plugin
// into the slot registry and registers the one keyboard command that opens or
// closes the panel (the command shape and the guards live in `shortcut.ts`).

import { h } from './react'
import { EN, NS, ZH } from './locale'
import { CSS } from './styles'
import { Workspace } from './components/Workspace'
import {
  PANEL_ID,
  SHORTCUT_ID,
  bindShortcut,
  serviceOf,
  shortcutHeld,
  shortcutKeys,
  shortcutsOf,
  subscribeShortcut,
  togglePanel,
} from './shortcut'
import type { AnyProps, ClientCtx, Translate } from './types'

// The panel id lives in `shortcut.ts` so the launcher, the `main` key and the
// keyboard command all read one constant.

// ── sidebar launcher icon ──────────────────────────────────────────────────

/** Root-scoped `sidebar.panellist` entry: the sidebar passes `{ size, active }`. */
function GitTreeIcon(props: AnyProps): any {
  const size = typeof props.size === 'number' ? props.size : 16
  const active = props.active === true
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      'aria-hidden': 'true',
      focusable: 'false',
      style: { display: 'block', opacity: active ? 1 : 0.86 },
    },
    h('path', {
      d: 'M4 2.75v6.1a2.75 2.75 0 0 0 2.75 2.75h2.6',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.4,
      strokeLinecap: 'round',
    }),
    h('circle', { cx: 4, cy: 2.6, r: 1.55, fill: 'currentColor' }),
    h('circle', { cx: 11.6, cy: 11.6, r: 1.55, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 }),
    h('circle', { cx: 6.9, cy: 11.6, r: 1.55, fill: 'currentColor' }),
  )
}

// ── plugin body ────────────────────────────────────────────────────────────

/**
 * Browser half entry point. `inject` lets Cordis defer `apply` until the slot
 * registry exists; `ctx.slots.inject(ownerKey, …)` then waits for the owning
 * packages' slot declarations instead of racing them.
 */
export const inject = ['slots', 'locale']

export function apply(ctx: ClientCtx): void {
  // 1. stylesheet owned by this plugin: unloaded with it (no document.body append).
  ctx.effect(() => {
    if (typeof document === 'undefined') return () => {}
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-git-tree'
    tag.textContent = CSS
    document.head.appendChild(tag)
    return () => {
      if (tag.parentNode) tag.parentNode.removeChild(tag)
    }
  }, 'dsh-git-tree: styles')

  // 2. dictionaries + bound translator (resolved text follows locale changes).
  ctx.effect(() => ctx.locale.register(NS, { en: EN, zh: ZH }), 'dsh-git-tree: dictionaries')
  const t = ctx.locale.bind(NS)

  // 3. keyboard command. The shortcuts service is optional on purpose: it is
  //    not part of `inject`, so a Harness that predates it (or one where the
  //    registration is rejected as reserved/conflicting) still loads the panel.
  ctx.effect(() => {
    try {
      if (typeof ctx.inject === 'function') {
        // Wait for the service instead of racing it: the child fiber only runs
        // once `shortcuts` is provided.
        ctx.inject(['shortcuts'], (child) => wireShortcut(child, t))
      } else {
        wireShortcut(ctx, t)
      }
    } catch (error) {
      console.warn('[dsh-git-tree] keyboard shortcut unavailable:', error)
    }
    return () => bindShortcut(null)
  }, 'dsh-git-tree: shortcut')

  // 4. sidebar launcher: an icon row whose id equals the main panel key.
  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      { name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: () => t('panel'), locale: NS },
      GitTreeIcon,
    ),
  )

  // 5. the panel itself: root-scoped keyed `main` entry, full-height. The
  //    active locale id rides along so an AI-written commit message follows the
  //    language the panel is actually showing.
  ctx.slots.inject('main', () =>
    ctx.slots.register(
      { name: 'main', key: PANEL_ID, locale: NS, inject: () => ({ t, locale: () => activeLocale(ctx) }) },
      Workspace,
    ),
  )
}

/**
 * Publish the keycap bridge and register the toggle command against a context
 * that already provides the shortcuts service. Every failure stays local: the
 * divider between "the panel works" and "the panel works with a shortcut".
 */
function wireShortcut(host: ClientCtx, t: Translate): void {
  const shortcuts = shortcutsOf(host)
  if (!shortcuts) return

  bindShortcut({
    keys: () => shortcutKeys(shortcuts),
    subscribe: (listener) => subscribeShortcut(shortcuts, listener),
    toggle: () => {
      togglePanel(serviceOf(host, 'layout'))
    },
  })

  let dispose: unknown = null
  try {
    dispose = shortcuts.register({
      id: SHORTCUT_ID,
      label: () => t('shortcutOpen'),
      aliases: ['git', 'git panel', 'source control', 'scm', 'toggle git panel'],
      defaults: {
        'desktop:macos': { code: 'KeyV', modifiers: ['primary', 'shift'] },
        'desktop:windows': { code: 'KeyV', modifiers: ['primary', 'shift'] },
        'web:macos': { code: 'KeyV', modifiers: ['primary', 'shift'] },
        'web:windows': { code: 'KeyV', modifiers: ['primary', 'shift'] },
      },
      // The toggle works from text fields too: closing the panel hands focus to
      // the conversation composer, and a second press must still reopen it.
      // Desktop dispatch ignores regions anyway; this keeps Web identical. The
      // price is the browser's paste-as-plain-text on the bound combination,
      // which the user can move in Settings → Keyboard shortcuts.
      regions: ['page', 'editable', 'terminal'],
      modals: [],
      resolve: () => {
        // A panel-owned overlay owns the keyboard until it closes. `blocked`
        // is the service's word for "consumed, but do nothing": the press must
        // not fall through and turn into a paste behind the dialog.
        if (shortcutHeld()) return { status: 'blocked', reason: 'panel-overlay' }
        return {
          status: 'handled',
          run: () => {
            togglePanel(serviceOf(host, 'layout'))
          },
        }
      },
    })
  } catch (error) {
    console.warn('[dsh-git-tree] keyboard shortcut rejected:', error)
  }

  const release = () => {
    try {
      if (typeof dispose === 'function') (dispose as () => void)()
    } catch {
      /* disposing a rejected registration never throws, but stay quiet */
    }
    bindShortcut(null)
  }
  if (typeof host.effect === 'function') host.effect(() => release, 'dsh-git-tree: shortcut disposal')
}

// The shortcut helpers are exported from the artifact as well: the boot-contract
// test evaluates this bundle in Node and exercises the toggle without a DOM.
export { holdShortcut, keycapParts, shortcutKeys, togglePanel } from './shortcut'

/** Active UI locale id (`zh`, `en`, …), read from the live locale snapshot. */
function activeLocale(ctx: ClientCtx): string {
  try {
    const localeCtx = ctx.locale as unknown as { getSnapshot?: () => { active?: string } }
    const snapshot = typeof localeCtx.getSnapshot === 'function' ? localeCtx.getSnapshot() : null
    if (snapshot && typeof snapshot.active === 'string' && snapshot.active) return snapshot.active
  } catch {
    /* older locale service: fall through to the browser default */
  }
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') return navigator.language
  return 'en'
}
