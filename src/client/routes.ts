// Host calls: same-origin authenticated Fetch routes served by the plugin's
// host half. The browser uses the document-relative form so the request carries
// the session cookie and passes the Connection fence.

import type {
  AiMessagePayload,
  AiModelsPayload,
  ConflictResolvePayload,
  DiffPayload,
  HistoryPayload,
  MutationPayload,
  OpenPayload,
  OpenTarget,
  RefsPayload,
  GitStatusPayload,
  WorkspacesPayload,
} from './types'

/** Authenticated exact Fetch routes served by the host half (document-relative). */
const STATUS_ROUTE = 'api/git-tree/status'
const WORKSPACES_ROUTE = 'api/git-tree/workspaces'
const DIFF_ROUTE = 'api/git-tree/diff'
const REFS_ROUTE = 'api/git-tree/refs'
const HISTORY_ROUTE = 'api/git-tree/history'
const COMMIT_INFO_ROUTE = 'api/git-tree/commit-info'
const CHECKOUT_ROUTE = 'api/git-tree/checkout'
const DISCARD_ROUTE = 'api/git-tree/discard'
const REMOVE_ROUTE = 'api/git-tree/remove'
const MERGE_ROUTE = 'api/git-tree/merge'
const PUSH_ROUTE = 'api/git-tree/push'
const FETCH_ROUTE = 'api/git-tree/fetch'
const REPOSITORY_PIN_ROUTE = 'api/git-tree/repositories/pin'
const REPOSITORY_OPEN_ROUTE = 'api/git-tree/repositories/open'
const PULL_ROUTE = 'api/git-tree/pull'
const BRANCH_CREATE_ROUTE = 'api/git-tree/branch/create'
const BRANCH_RENAME_ROUTE = 'api/git-tree/branch/rename'
const BRANCH_DELETE_ROUTE = 'api/git-tree/branch/delete'
const STAGE_ROUTE = 'api/git-tree/stage'
const UNSTAGE_ROUTE = 'api/git-tree/unstage'
const COMMIT_ROUTE = 'api/git-tree/commit'
const OPEN_ROUTE = 'api/git-tree/open'
const AI_MODELS_ROUTE = 'api/git-tree/ai/models'
const AI_MODEL_ROUTE = 'api/git-tree/ai/model'
const COMMIT_MESSAGE_ROUTE = 'api/git-tree/commit-message'
const CONFLICT_RESOLVE_ROUTE = 'api/git-tree/conflict/resolve'
const CONFLICT_APPLY_ROUTE = 'api/git-tree/conflict/apply'
const CONFLICT_REVERT_ROUTE = 'api/git-tree/conflict/revert'
const CONFLICT_MARK_ROUTE = 'api/git-tree/conflict/mark-resolved'

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, value)
  const text = search.toString()
  return text === '' ? '' : '?' + text
}

async function getJson<T>(
  route: string,
  params: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(route + query(params), {
    signal,
    headers: { accept: 'application/json' },
  })
  const payload = (await response.json()) as T
  return payload
}

async function postJson<T>(route: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(route, {
    method: 'POST',
    signal,
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return (await response.json()) as T
}

export function fetchWorkspaces(signal?: AbortSignal): Promise<WorkspacesPayload> {
  return getJson<WorkspacesPayload>(WORKSPACES_ROUTE, {}, signal)
}

export function fetchStatus(cwd?: string, signal?: AbortSignal): Promise<GitStatusPayload> {
  return getJson<GitStatusPayload>(STATUS_ROUTE, { cwd }, signal)
}

export function fetchDiff(
  params: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<DiffPayload> {
  return getJson<DiffPayload>(DIFF_ROUTE, params, signal)
}

export function fetchRefs(cwd?: string, signal?: AbortSignal): Promise<RefsPayload> {
  return getJson<RefsPayload>(REFS_ROUTE, { cwd }, signal)
}

export function fetchCommitInfo(
  params: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<CommitDetailPayload> {
  return getJson<CommitDetailPayload>(COMMIT_INFO_ROUTE, params, signal)
}

export function fetchHistory(
  params: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<HistoryPayload> {
  return getJson<HistoryPayload>(HISTORY_ROUTE, params, signal)
}

export function fetchRemote(cwd?: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(FETCH_ROUTE + query({ cwd }), {})
}

/** Fast-forward the current branch; `mode: 'merge'` is only for a diverged one. */
export function pullBranch(mode: 'ff-only' | 'merge', cwd?: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(PULL_ROUTE + query({ cwd }), { mode })
}

export function pushBranch(cwd?: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(PUSH_ROUTE + query({ cwd }), {})
}

export function mergeBranch(branch: string, cwd?: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(MERGE_ROUTE + query({ cwd }), { branch })
}

export function discardPaths(paths: string[], side: 'staged' | 'unstaged', cwd?: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(DISCARD_ROUTE + query({ cwd }), { paths, side })
}

export function removePaths(paths: string[], untracked: boolean, cwd?: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(REMOVE_ROUTE + query({ cwd }), { paths, untracked })
}

export function checkoutBranch(branch: string, cwd?: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(CHECKOUT_ROUTE + query({ cwd }), { branch })
}

export function createBranch(name: string, cwd?: string, start?: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(BRANCH_CREATE_ROUTE + query({ cwd }), { name, start })
}

export function renameBranch(from: string, to: string, cwd?: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(BRANCH_RENAME_ROUTE + query({ cwd }), { from, to })
}

export function deleteBranch(name: string, cwd?: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(BRANCH_DELETE_ROUTE + query({ cwd }), { name })
}

export function stagePaths(paths: string[], cwd?: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(STAGE_ROUTE + query({ cwd }), { paths })
}

export function unstagePaths(paths: string[], cwd?: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(UNSTAGE_ROUTE + query({ cwd }), { paths })
}

export function commitChanges(message: string, cwd?: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(COMMIT_ROUTE + query({ cwd }), { message })
}

export function openLocal(target: OpenTarget, cwd?: string): Promise<OpenPayload> {
  return postJson<OpenPayload>(OPEN_ROUTE + query({ cwd }), { target })
}

export function fetchAiModels(signal?: AbortSignal): Promise<AiModelsPayload> {
  return getJson<AiModelsPayload>(AI_MODELS_ROUTE, {}, signal)
}

export function saveAiModel(provider: string, model: string): Promise<AiModelsPayload> {
  return postJson<AiModelsPayload>(AI_MODEL_ROUTE, { provider, model })
}

/** Ask the selected model to write a commit message for the given files. */
export function generateCommitMessage(
  input: {
    side: 'staged' | 'unstaged'
    files: { path: string; status: string }[]
    locale: string
  },
  cwd?: string,
): Promise<AiMessagePayload> {
  return postJson<AiMessagePayload>(COMMIT_MESSAGE_ROUTE + query({ cwd }), input)
}


export function resolveConflict(path: string, cwd?: string): Promise<ConflictResolvePayload> {
  return postJson<ConflictResolvePayload>(CONFLICT_RESOLVE_ROUTE + query({ cwd }), { path })
}

export function applyConflict(path: string, content: string, cwd?: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(CONFLICT_APPLY_ROUTE + query({ cwd }), { path, content })
}

export function revertConflict(path: string, cwd?: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(CONFLICT_REVERT_ROUTE + query({ cwd }), { path })
}

export function markConflictResolved(path: string, cwd?: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(CONFLICT_MARK_ROUTE + query({ cwd }), { path })
}


export function setRepositoryPin(path: string, pinned: boolean): Promise<MutationPayload> {
  return postJson<MutationPayload>(REPOSITORY_PIN_ROUTE, { path, pinned })
}

export function recordRepositoryOpen(path: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(REPOSITORY_OPEN_ROUTE, { path })
}
