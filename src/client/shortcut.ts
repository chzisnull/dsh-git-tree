// Keyboard shortcut wiring for the panel.
//
// The Harness ships a client shortcuts service (0.2.1+) that owns global
// commands: registered commands appear in Settings → Keyboard shortcuts, can be
// rebound by the user, and are matched before editors, terminals and modals on
// the desktop shell. Everything here is therefore defensive:
//
//   * the service is looked up optionally (`ctx.get('shortcuts')`) instead of
//     being declared in `inject`, so a Harness without it still loads the panel;
//   * `register` can legitimately throw (reserved combination, conflicting
//     default, duplicate id) and that must degrade to "no shortcut", never to a
//     broken plugin;
//   * panel-owned overlays hold the shortcut still, because the desktop shell
//     dispatches bound commands ahead of modal controls.
//
// The panel components read the current keycaps through the tiny store below,
// so a rebind in Settings updates the toolbar badge and the empty-state hint
// without a reload.

import { React } from './react'

/** Panel id shared by the `sidebar.panellist` launcher and the `main` slot. */
export const PANEL_ID = 'git-tree'

/** Command id registered with the shortcuts service. */
export const SHORTCUT_ID = 'panel.git-tree.toggle'

/** What the panel can say about the panel toggle. */
export type ShortcutState = {
  /** One entry per keycap of the binding the shell will actually deliver. */
  caps: string[]
  /**
   * `bound`: the command has a working binding.
   * `unbound`: the command exists but has none (cleared, or disabled by a
   *   conflict) — the panel points at Settings instead of showing keys.
   * `unavailable`: this Harness has no shortcuts service at all; say nothing.
   */
  status: 'bound' | 'unbound' | 'unavailable'
}

const UNAVAILABLE: ShortcutState = { caps: [], status: 'unavailable' }

/** What the client entry publishes for the panel components. */
export interface ShortcutBridge {
  /** Current binding state of our command. */
  state: () => ShortcutState
  /** Re-read the state when the shortcut catalog changes. */
  subscribe: (listener: () => void) => () => void
  /** Toggle the panel the same way the keyboard command does. */
  toggle: () => void
}

let bridge: ShortcutBridge | null = null
const bridgeListeners = new Set<() => void>()

/** Publish (or clear) the bridge wired by the client entry. */
export function bindShortcut(next: ShortcutBridge | null): void {
  bridge = next
  // The child fiber that waits for the service can bind after a panel mounted;
  // tell the mounted badges to re-read instead of showing a stale "no keys".
  for (const listener of [...bridgeListeners]) {
    try {
      listener()
    } catch {
      /* one broken subscriber must not stop the rest */
    }
  }
}

// ── overlay guard ─────────────────────────────────────────────────────────

let holds = 0

/**
 * Keep the shortcut from acting while a panel-owned overlay is open.
 * @returns release function; calling it twice is harmless.
 */
export function holdShortcut(): () => void {
  holds += 1
  let released = false
  return () => {
    if (released) return
    released = true
    holds = Math.max(0, holds - 1)
  }
}

/** Whether a panel-owned overlay currently owns the keyboard. */
export function shortcutHeld(): boolean {
  return holds > 0
}

// ── service access ────────────────────────────────────────────────────────

/** Optional service lookup; never throws on a Harness without it. */
export function serviceOf(ctx: any, name: string): any | null {
  try {
    if (!ctx || typeof ctx.get !== 'function') return null
    const service = ctx.get(name)
    return service ?? null
  } catch {
    return null
  }
}

/** The shortcuts service, or null when this Harness does not provide it. */
export function shortcutsOf(ctx: any): any | null {
  const service = serviceOf(ctx, 'shortcuts')
  return service && typeof service.register === 'function' ? service : null
}

/**
 * Read the state of our command from the live catalog. A binding the service
 * has disabled (`issue`, or a conflict with another command) counts as unbound:
 * showing its keycaps would advertise a combination that cannot fire.
 */
export function shortcutState(shortcuts: any): ShortcutState {
  if (!shortcuts) return UNAVAILABLE
  try {
    const catalog = shortcuts.catalog ? shortcuts.catalog : null
    if (!catalog || typeof catalog.getSnapshot !== 'function') return UNAVAILABLE
    const rows = catalog.getSnapshot()
    if (!Array.isArray(rows)) return UNAVAILABLE
    const row = rows.find((entry: any) => entry && entry.id === SHORTCUT_ID)
    if (!row) return { caps: [], status: 'unbound' }
    if (row.issue !== null && row.issue !== undefined) return { caps: [], status: 'unbound' }
    if (Array.isArray(row.conflicts) && row.conflicts.length > 0) return { caps: [], status: 'unbound' }
    const caps = keycapParts(Array.isArray(row.keys) ? row.keys.map((key: unknown) => String(key)) : null)
    return caps.length === 0 ? { caps: [], status: 'unbound' } : { caps, status: 'bound' }
  } catch {
    return UNAVAILABLE
  }
}

/** Subscribe to catalog changes; the service hands us a store. */
export function subscribeShortcut(shortcuts: any, listener: () => void): () => void {
  try {
    const catalog = shortcuts && shortcuts.catalog ? shortcuts.catalog : null
    if (catalog && typeof catalog.subscribe === 'function') {
      const unsubscribe = catalog.subscribe(listener)
      return typeof unsubscribe === 'function' ? unsubscribe : () => {}
    }
  } catch {
    /* fall through to the no-op disposer */
  }
  return () => {}
}

/**
 * Toggle this plugin's panel through the layout service: close it when it is the
 * active main panel, open it otherwise (the sidebar launcher keeps working too).
 * @returns what happened, for tests; layout errors never escape.
 */
export function togglePanel(layout: any): 'open' | 'close' | 'none' {
  if (!layout || typeof layout.selectPanel !== 'function') return 'none'
  try {
    const info = layout.panelInfo && typeof layout.panelInfo.getSnapshot === 'function'
      ? layout.panelInfo.getSnapshot()
      : null
    if (info && info.activePanelId === PANEL_ID) {
      layout.selectPanel(null)
      return 'close'
    }
    layout.selectPanel(PANEL_ID)
    return 'open'
  } catch {
    return 'none'
  }
}

// ── panel-side reads ──────────────────────────────────────────────────────

function readState(): ShortcutState {
  try {
    return bridge ? bridge.state() : UNAVAILABLE
  } catch {
    return UNAVAILABLE
  }
}

/**
 * The toggle's state for the panel, following live rebinds. The bridge may
 * appear after the panel mounted (the service starts in a child fiber), so a
 * late bind re-subscribes to the catalog instead of only refreshing once.
 */
export function useShortcutState(): ShortcutState {
  const [state, setState] = React.useState<ShortcutState>(() => readState())
  React.useEffect(() => {
    let offCatalog = () => {}
    const refresh = () => setState(readState())
    const sync = () => {
      refresh()
      offCatalog()
      offCatalog = bridge ? bridge.subscribe(refresh) : () => {}
    }
    sync()
    bridgeListeners.add(sync)
    return () => {
      bridgeListeners.delete(sync)
      offCatalog()
    }
  }, [])
  return state
}

/** Toggle the panel from a click; silently does nothing when unwired. */
export function togglePanelFromUi(): void {
  try {
    if (bridge) bridge.toggle()
  } catch {
    /* the panel keeps working; only the button is inert */
  }
}

/** Split keycaps into separate caps (`Ctrl`, `+` entries dropped). */
export function keycapParts(keys: string[] | null): string[] {
  if (!Array.isArray(keys)) return []
  return keys.filter((key) => key !== '+' && key !== ' + ' && key !== '')
}


