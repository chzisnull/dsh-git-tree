// How often the panel asks the host to run git.
//
// The panel polls while it is on screen, but a fixed two-second tick costs far
// more than it buys: a poll is two routes and (on the host side) six git
// processes, four of which are per-repository facts that never change between
// two ticks. These helpers keep the decision testable without a DOM:
//
//   * a fast cadence while the window is focused,
//   * a slower cadence once nothing has changed for a few ticks,
//   * refs refreshed on a slower clock (or immediately when the branch moved).
//
// The caller owns the timer; this module only answers "how long to wait" and
// "what changed".

import type { GitStatusPayload } from './types'

/** Cadence while the window is focused and the working copy is moving. */
export const POLL_FAST_MS = 3000

/** Cadence once several polls in a row saw no change. */
export const POLL_IDLE_MS = 10000

/** Consecutive unchanged polls before backing off. */
export const POLL_IDLE_TICKS = 3

/** How often the refs rail is refreshed when nothing changed. */
export const REFS_EVERY_MS = 10000

/**
 * Everything the rail and the change list render, in one comparable string.
 * Two polls with the same signature have nothing new to show.
 */
export function statusSignature(status: GitStatusPayload | null): string {
  if (!status || status.ok !== true) return 'none'
  const counts = status.counts ?? { staged: 0, unstaged: 0, conflicted: 0 }
  const entries = (status.entries ?? []).map((entry) => entry.x + entry.y + entry.path).join('\u0000')
  return [
    status.branch ?? '',
    status.oid ?? '',
    status.upstream ?? '',
    status.ahead ?? 0,
    status.behind ?? 0,
    counts.staged,
    counts.unstaged,
    counts.conflicted,
    entries,
  ].join('\u0001')
}

/**
 * Next delay and the new unchanged counter: the counter resets as soon as
 * anything changed, and backs the cadence off after {@link POLL_IDLE_TICKS}.
 */
export function pollDelay(
  previousSignature: string,
  nextSignature: string,
  unchangedTicks: number,
): { delay: number; unchangedTicks: number } {
  const unchanged = nextSignature === previousSignature ? unchangedTicks + 1 : 0
  return {
    delay: unchanged >= POLL_IDLE_TICKS ? POLL_IDLE_MS : POLL_FAST_MS,
    unchangedTicks: unchanged,
  }
}

/** Whether this tick should also read the rail: something moved, or its clock is due. */
export function shouldFetchRefs(signatureChanged: boolean, sinceRefsMs: number): boolean {
  return signatureChanged || sinceRefsMs >= REFS_EVERY_MS
}
