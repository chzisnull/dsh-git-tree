// Host calls: same-origin authenticated Fetch routes served by the plugin's
// host half. The browser uses the document-relative form so the request carries
// the session cookie and passes the Connection fence.

import type {
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
const STAGE_ROUTE = 'api/git-tree/stage'
const UNSTAGE_ROUTE = 'api/git-tree/unstage'
const COMMIT_ROUTE = 'api/git-tree/commit'
const OPEN_ROUTE = 'api/git-tree/open'

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
