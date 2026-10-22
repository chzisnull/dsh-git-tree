/**
 * Repository preferences: which workspaces the user pinned, and how often they
 * opened each one. Stored beside the AI settings under the DSH home so the web
 * and desktop windows agree, and so switching browsers does not lose them.
 *
 * A path that leaves the registry keeps its record: DSH profiles come and go,
 * and re-registering a workspace should bring its pin and count back.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dshHome } from './home.js'

const MAX_PINNED = 200
const MAX_RECORDS = 2000

/** Where pins and open counts are remembered. */
export function preferencesPath() {
  return join(dshHome(), 'git-tree', 'repositories.json')
}

function cleanPath(value) {
  if (typeof value !== 'string') return ''
  const path = value.trim().replace(/[\\/]+$/, '')
  return path.length > 0 && path.length <= 4096 ? path : ''
}

/** Coerce whatever is on disk into the shape the rest of the module expects. */
export function normalisePrefs(raw) {
  const pinned = []
  const opened = {}
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.pinned)) {
      for (const value of raw.pinned) {
        const path = cleanPath(value)
        if (path && !pinned.includes(path)) pinned.push(path)
        if (pinned.length >= MAX_PINNED) break
      }
    }
    if (raw.opened && typeof raw.opened === 'object') {
      for (const [key, value] of Object.entries(raw.opened)) {
        const path = cleanPath(key)
        if (!path || !value || typeof value !== 'object') continue
        const count = Number(value.count)
        const last = Number(value.last)
        opened[path] = {
          count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 1,
          last: Number.isFinite(last) && last > 0 ? Math.floor(last) : 0,
        }
        if (Object.keys(opened).length >= MAX_RECORDS) break
      }
    }
  }
  return { pinned, opened }
}

/** Preferences from disk; a missing or broken file reads as empty. */
export function readRepositoryPrefs() {
  try {
    return normalisePrefs(JSON.parse(readFileSync(preferencesPath(), 'utf8')))
  } catch {
    return normalisePrefs(null)
  }
}

/** Best effort: a read-only home must not break the workspace switcher. */
export function writeRepositoryPrefs(prefs) {
  const file = preferencesPath()
  try {
    mkdirSync(join(dshHome(), 'git-tree'), { recursive: true })
    writeFileSync(file, JSON.stringify(prefs, null, 2) + '\n', 'utf8')
    return true
  } catch {
    return false
  }
}

/** Add or remove one workspace from the pinned list. */
export function togglePinned(prefs, path, pinned) {
  const target = cleanPath(path)
  const next = normalisePrefs(prefs)
  if (!target) return next
  next.pinned = next.pinned.filter((value) => value !== target)
  if (pinned !== false) next.pinned.push(target)
  return next
}

/** Count one deliberate open; returns the updated preferences. */
export function recordOpened(prefs, path, at = Date.now()) {
  const target = cleanPath(path)
  const next = normalisePrefs(prefs)
  if (!target) return next
  const current = next.opened[target] ?? { count: 0, last: 0 }
  next.opened[target] = { count: current.count + 1, last: Math.floor(at) }
  return next
}

/**
 * Decorate and order the registry list.
 *
 * Pinned workspaces come first, in the order they were pinned; everything else
 * follows by open count, then most recently opened, then title — so the list is
 * stable and explainable rather than jittering between equal counts.
 *
 * A pinned path that is no longer in the registry is simply absent from the
 * list; its record stays for when it comes back.
 */
export function orderWorkspaces(workspaces, prefs) {
  const list = Array.isArray(workspaces) ? workspaces : []
  const { pinned, opened } = normalisePrefs(prefs)
  const byPath = new Map(list.map((workspace) => [workspace.path, workspace]))
  const decorate = (workspace, isPinned) => {
    const record = opened[workspace.path]
    return {
      ...workspace,
      pinned: isPinned,
      openCount: record ? record.count : 0,
      lastOpenedAt: record ? record.last : 0,
    }
  }

  const top = []
  for (const path of pinned) {
    const workspace = byPath.get(path)
    if (workspace) top.push(decorate(workspace, true))
  }
  const topPaths = new Set(top.map((workspace) => workspace.path))
  const rest = list
    .filter((workspace) => !topPaths.has(workspace.path))
    .map((workspace) => decorate(workspace, false))
    .sort((a, b) => {
      if (b.openCount !== a.openCount) return b.openCount - a.openCount
      if (b.lastOpenedAt !== a.lastOpenedAt) return b.lastOpenedAt - a.lastOpenedAt
      return String(a.title).localeCompare(String(b.title))
    })
  return [...top, ...rest]
}
