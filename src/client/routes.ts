// Host calls: same-origin authenticated Fetch routes served by the plugin's
// host half. The browser uses the document-relative form so the request carries
// the session cookie and passes the Connection fence.

import type { DiffPayload, MutationPayload, RefsPayload, GitStatusPayload } from './types'

/** Authenticated exact Fetch routes served by the host half (document-relative). */
const STATUS_ROUTE = 'api/git-tree/status'
const DIFF_ROUTE = 'api/git-tree/diff'
const REFS_ROUTE = 'api/git-tree/refs'
const STAGE_ROUTE = 'api/git-tree/stage'
const UNSTAGE_ROUTE = 'api/git-tree/unstage'
const COMMIT_ROUTE = 'api/git-tree/commit'

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

export function fetchStatus(signal?: AbortSignal): Promise<GitStatusPayload> {
  return getJson<GitStatusPayload>(STATUS_ROUTE, {}, signal)
}

export function fetchDiff(
  params: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<DiffPayload> {
  return getJson<DiffPayload>(DIFF_ROUTE, params, signal)
}

export function fetchRefs(signal?: AbortSignal): Promise<RefsPayload> {
  return getJson<RefsPayload>(REFS_ROUTE, {}, signal)
}

export function stagePaths(paths: string[]): Promise<MutationPayload> {
  return postJson<MutationPayload>(STAGE_ROUTE, { paths })
}

export function unstagePaths(paths: string[]): Promise<MutationPayload> {
  return postJson<MutationPayload>(UNSTAGE_ROUTE, { paths })
}

export function commitChanges(message: string): Promise<MutationPayload> {
  return postJson<MutationPayload>(COMMIT_ROUTE, { message })
}
