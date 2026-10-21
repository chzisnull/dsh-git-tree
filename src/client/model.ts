// Pure derivations over the status payload. No React, no host calls: these are
// the rules the panes share, kept in one place so they stay consistent.

import type { EntrySide, GitFileEntry } from './types'

export function lastSegment(path: string): string {
  const parts = String(path).split(/[\\/]+/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : path
}

/** Split a repository-relative path into its muted directory and its name. */
export function splitPath(path: string): { dir: string; name: string } {
  const parts = String(path).split('/')
  const name = parts.pop() ?? path
  return { dir: parts.length > 0 ? parts.join('/') + '/' : '', name }
}

/** Identity of one selectable row: the same path may appear on two sides. */
export function rowKey(path: string, side: EntrySide): string {
  return side + '\u0000' + path
}

export function splitEntries(entries: GitFileEntry[]): {
  staged: GitFileEntry[]
  unstaged: GitFileEntry[]
  conflicted: GitFileEntry[]
} {
  const staged: GitFileEntry[] = []
  const unstaged: GitFileEntry[] = []
  const conflicted: GitFileEntry[] = []
  for (const entry of entries) {
    if (entry.conflicted) {
      conflicted.push(entry)
      continue
    }
    if (entry.staged) staged.push(entry)
    if (entry.unstaged) unstaged.push(entry)
  }
  return { staged, unstaged, conflicted }
}

/** The status letter the row shows for the side it is listed under. */
export function statusLetter(entry: GitFileEntry, side: EntrySide): string {
  if (side === 'conflicted' || entry.conflicted) return 'U'
  if (entry.kind === 'untracked') return '?'
  if (entry.kind === 'renamed') return 'R'
  if (entry.kind === 'copied') return 'C'
  const letter = side === 'staged' ? entry.x : entry.y
  return letter && letter !== '.' ? letter : 'M'
}

/** Colour tone used for a status letter. */
export function statusTone(letter: string): 'ok' | 'warn' | 'error' | 'muted' | 'accent' {
  if (letter === 'A') return 'ok'
  if (letter === 'D' || letter === 'U') return 'error'
  if (letter === 'M') return 'warn'
  if (letter === 'R' || letter === 'C') return 'accent'
  return 'muted'
}

/** Which diff side a row previews. */
export function sideFor(entry: GitFileEntry, side: EntrySide): 'staged' | 'unstaged' {
  return side === 'staged' ? 'staged' : 'unstaged'
}

export function shortSha(sha: string): string {
  return String(sha).slice(0, 7)
}
