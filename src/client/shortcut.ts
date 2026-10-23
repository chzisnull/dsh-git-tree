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

/** What the client entry publishes for the panel components. */
export interface ShortcutBridge {
  /** Current keycaps for our command (`[]`/null when unbound or unavailable). */
  keys: () => string[] | null
  /** Re-read the keycaps when the shortcut catalog changes. */
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

/** Read the binding the catalog currently shows for our command. */
export function shortcutKeys(shortcuts: any): string[] | null {
  try {
    const catalog = shortcuts && shortcuts.catalog ? shortcuts.catalog : null
    if (!catalog || typeof catalog.getSnapshot !== 'function') return null
    const rows = catalog.getSnapshot()
    if (!Array.isArray(rows)) return null
    const row = rows.find((entry: any) => entry && entry.id === SHORTCUT_ID)
    if (!row || !Array.isArray(row.keys) || row.keys.length === 0) return null
    return row.keys.map((key: unknown) => String(key))
  } catch {
    return null
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

function readKeys(): string[] | null {
  try {
    return bridge ? bridge.keys() : null
  } catch {
    return null
  }
}

/** Keycaps to show for the toggle command, following live rebinds. */
export function useShortcutKeys(): string[] | null {
  const [keys, setKeys] = React.useState<string[] | null>(() => readKeys())
  React.useEffect(() => {
    const refresh = () => setKeys(readKeys())
    refresh()
    bridgeListeners.add(refresh)
    const unsubscribe = bridge ? bridge.subscribe(refresh) : () => {}
    return () => {
      bridgeListeners.delete(refresh)
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])
  return keys
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

/** Caps for the panel components: one hook, always the live binding. */
export function useShortcutCaps(): string[] {
  return keycapParts(useShortcutKeys())
}
