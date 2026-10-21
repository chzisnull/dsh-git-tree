// Host calls: same-origin authenticated Fetch routes served by the plugin's
// host half. The browser uses the document-relative form so the request carries
// the session cookie and passes the Connection fence.

import type { DiffPayload, GitStatusPayload } from './types'

/** Authenticated exact Fetch routes served by the host half (document-relative). */
export const STATUS_ROUTE = 'api/git-tree/status'
export const DIFF_ROUTE = 'api/git-tree/diff'

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, value)
  const text = search.toString()
  return text === '' ? '' : '?' + text
}

export async function getJson<T>(
  route: string,
  params: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(route + query(params), {
    signal,
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error('HTTP ' + String(response.status))
  return (await response.json()) as T
}

export async function fetchStatus(signal?: AbortSignal): Promise<GitStatusPayload> {
  return getJson<GitStatusPayload>(STATUS_ROUTE, {}, signal)
}

export async function fetchDiff(
  params: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<DiffPayload> {
  return getJson<DiffPayload>(DIFF_ROUTE, params, signal)
}
