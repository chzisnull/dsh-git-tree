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
// The panel itself lives in `components/Workspace`; this entry only wires the
// plugin into the slot registry.

import { h } from './react'
import { EN, NS, ZH } from './locale'
import { CSS } from './styles'
import { Workspace } from './components/Workspace'
import type { AnyProps, ClientCtx } from './types'

/** Panel id: the `main` key and the `sidebar.panellist` entry id must match. */
const PANEL_ID = 'git-tree'

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

  // 3. sidebar launcher: an icon row whose id equals the main panel key.
  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      { name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: () => t('panel'), locale: NS },
      GitTreeIcon,
    ),
  )

  // 4. the panel itself: root-scoped keyed `main` entry, full-height.
  ctx.slots.inject('main', () =>
    ctx.slots.register(
      { name: 'main', key: PANEL_ID, locale: NS, inject: () => ({ t }) },
      Workspace,
    ),
  )
}
