// Pure derivations over the status payload. No React, no host calls: these are
// the rules the panes share, kept in one place so they stay consistent.

import type { GitFileEntry } from './types'

export function lastSegment(path: string): string {
  const parts = String(path).split(/[\\/]+/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : path
}

/**
 * Porcelain v2 encodes index status in X and work-tree status in Y; `.` means
 * "unchanged on that side". A tracked entry is fully staged when the work tree
 * side is clean.
 */
export function isStaged(entry: GitFileEntry): boolean {
  return entry.kind === 'changed' && entry.x !== '.' && entry.x !== '?' && entry.y === '.'
}
