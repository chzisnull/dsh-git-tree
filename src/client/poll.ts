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
): { delay: number; unchangedTicks: number; changed: boolean } {
  const changed = nextSignature !== previousSignature
  const unchanged = changed ? 0 : unchangedTicks + 1
  return {
    delay: unchanged >= POLL_IDLE_TICKS ? POLL_IDLE_MS : POLL_FAST_MS,
    unchangedTicks: unchanged,
    changed,
  }
}

/**
 * What identifies the rail: the branch and the head commit. Moving a file or
 * staging it changes the status signature but not the rail, so the rail must
 * not be re-read on every change — only when the branch or HEAD moved, or when
 * its own clock is due.
 */
export function refSignature(status: GitStatusPayload | null): string {
  if (!status || status.ok !== true) return ''
  return (status.branch ?? '') + '\u0001' + (status.oid ?? '')
}

/** Whether this tick should also read the rail: the branch/HEAD moved, or its clock is due. */
export function shouldFetchRefs(refsMoved: boolean, sinceRefsMs: number): boolean {
  return refsMoved || sinceRefsMs >= REFS_EVERY_MS
}

/** Everything the loop needs from the panel; the caller owns focus, timers and DOM. */
export interface PollHost {
  /** One status read; may resolve to null when the route failed. */
  readStatus: () => Promise<GitStatusPayload | null>
  /** One rail read; the branch saves the host a git process. */
  readRefs: (branch?: string) => void
  /** Hidden window or unfocused window: the loop stops until {@link PollLoop.wake}. */
  stopped: () => boolean
  /** A write is running: keep the timer, but do not read yet. */
  busy: () => boolean
  now: () => number
  setTimer: (run: () => void, ms: number) => any
  clearTimer: (handle: any) => void
}

export interface PollLoop {
  /** The user came back (focus, visibility, pointer): read now, fast cadence. */
  wake: () => void
  stop: () => void
}

/**
 * The poll loop itself. A screen that stops being watched stops scheduling
 * entirely — there is no "is it back yet?" timer; focus, visibility and pointer
 * entry call {@link PollLoop.wake} instead.
 */
export function startPollLoop(host: PollHost): PollLoop {
  let signature = ''
  let refs = ''
  let unchanged = 0
  let lastRefsAt = host.now()
  let timer: any = null
  let stopped = false

  const schedule = (ms: number) => {
    if (stopped) return
    if (timer !== null) host.clearTimer(timer)
    timer = host.setTimer(() => void tick(), ms)
  }

  const tick = async () => {
    if (stopped) return
    if (host.stopped()) return // wake() restarts the loop
    if (host.busy()) {
      schedule(POLL_FAST_MS)
      return
    }
    const next = await host.readStatus()
    if (stopped) return
    const nextSignature = statusSignature(next)
    const decision = pollDelay(signature, nextSignature, unchanged)
    const nextRefs = refSignature(next)
    const refsMoved = signature !== '' && nextRefs !== refs && nextRefs !== ''
    signature = nextSignature
    refs = nextRefs
    unchanged = decision.unchangedTicks
    const now = host.now()
    if (shouldFetchRefs(refsMoved, now - lastRefsAt)) {
      lastRefsAt = now
      host.readRefs(next?.branch)
    }
    schedule(decision.delay)
  }

  return {
    wake() {
      if (stopped) return
      unchanged = 0
      lastRefsAt = host.now()
      schedule(0)
    },
    stop() {
      stopped = true
      if (timer !== null) host.clearTimer(timer)
      timer = null
    },
  }
}
