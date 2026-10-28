// Handing a conflicted file to a DSH session.
//
// The panel does not try to be the agent: for a real conflict the useful thing
// is a session in the same workspace, with the context already written into the
// composer, so the user presses Enter (or edits first). Everything here is a
// thin, defensive layer over two optional client services:
//
//   * `workspaces`  — the registered workspace list (`items[].workspaceId/path`)
//   * `uiWorkspace` — `startSession(workspaceId, draftOptions)`, whose
//                     `{ prompt, whenDraftExists }` opens the blank Session and
//                     fills the composer without sending anything.
//
// Both are optional on purpose: an older Harness (or a composition without the
// workspace browser) must degrade to the "copy the prompt" dialog, never to a
// dead button.

import { serviceOf } from './shortcut'
import type { Translate, WorkspaceRecord } from './types'

/**
 * What happened when the panel asked for a session. `requested` is honest about
 * the call: `startSession` is fire-and-forget, so the panel can only know the
 * session was asked for, not that it appeared.
 */
export type HandoffResult = 'requested' | 'no-workspace' | 'not-ready' | 'unavailable'

/** Why a hand-off ended in the fallback dialog (a requested session has none). */
export type HandoffFailure = Exclude<HandoffResult, 'requested'> | 'failed'

/** The panel-side seam the client entry publishes. */
export interface HandoffBridge {
  /**
   * Open a blank session in the workspace that contains `repoRoot`, with
   * `prompt` in the composer (never sent).
   */
  open: (repoRoot: string, prompt: string) => HandoffResult
}

/** Trailing separators and both slash kinds trimmed, for prefix comparison. */
function cleanPath(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim().replace(/[\\/]+$/, '')
  return trimmed.length > 0 && trimmed.length <= 4096 ? trimmed : ''
}

/**
 * Pick the registered workspace that owns `target`: the folder itself, or the
 * deepest registered folder containing it (a repository can live below its
 * workspace). Longest match wins, so nested workspaces stay distinguishable.
 */
export function matchWorkspace(workspaces: unknown, target: string): WorkspaceRecord | null {
  const path = cleanPath(target)
  if (!path || !Array.isArray(workspaces)) return null
  let best: WorkspaceRecord | null = null
  let bestLength = -1
  for (const workspace of workspaces) {
    if (!workspace || typeof workspace !== 'object') continue
    const candidate = cleanPath((workspace as any).path)
    if (!candidate) continue
    const inside = path === candidate || path.startsWith(candidate + '/') || path.startsWith(candidate + '\\')
    if (!inside || candidate.length <= bestLength) continue
    best = workspace
    bestLength = candidate.length
  }
  return best
}

/**
 * Build the bridge over the live client services. `open` returns a verdict
 * instead of throwing, because the panel has to render the reason.
 */
export function createHandoff(ctx: any): HandoffBridge {
  return {
    open(repoRoot: string, prompt: string): HandoffResult {
      try {
        const uiWorkspace = serviceOf(ctx, 'uiWorkspace')
        if (!uiWorkspace || typeof uiWorkspace.startSession !== 'function') return 'unavailable'
        const workspaces = serviceOf(ctx, 'workspaces')
        const snapshot = workspaces && workspaces.list && typeof workspaces.list.getSnapshot === 'function'
          ? workspaces.list.getSnapshot()
          : null
        if (!snapshot) return 'unavailable'
        // The list loads over a stream: while it is not ready `items` is empty,
        // and answering "no workspace" would be a lie about the repository.
        if (snapshot.phase && snapshot.phase !== 'ready') return 'not-ready'
        const items = snapshot.items
        if (!Array.isArray(items)) return 'unavailable'
        const match = matchWorkspace(items, repoRoot)
        const workspaceId = match && match.workspaceId
        if (typeof workspaceId !== 'string' || !workspaceId) return 'no-workspace'
        // `replace`: the prompt is the point of the click, even if the blank
        // session still holds an older handoff for the same file.
        uiWorkspace.startSession(workspaceId, { prompt, whenDraftExists: 'replace' })
        return 'requested'
      } catch {
        return 'unavailable'
      }
    },
  }
}

/**
 * The prompt the panel writes into the composer. It names the repository, the
 * file and the branch, adds the conflict-block count only when this panel
 * actually counted it (a right-click on a file whose diff is not open cannot
 * claim a number), then states the boundary: the agent edits the file, the
 * human marks it resolved.
 */
/** Everything the prompt names; the four fields always travel together. */
export interface ConflictPromptInput {
  repo: string
  path: string
  branch: string
  blocks: number
}

export function buildConflictPrompt(input: ConflictPromptInput, t: Translate): string {
  const head = t('handoffPromptHead', {
    repo: input.repo || '—',
    path: input.path,
    branch: input.branch || '—',
  })
  const blocks = input.blocks > 0 ? t('handoffPromptBlocks', { blocks: String(input.blocks) }) : ''
  return head + (blocks === '' ? '' : '\n' + blocks) + '\n\n' + t('handoffPromptBody')
}
