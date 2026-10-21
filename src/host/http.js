/**
 * Small HTTP helpers shared by the route handlers.
 *
 * The plugin answers every domain failure as HTTP 200 with `ok:false` so the
 * browser reads one JSON shape; only bad request input keeps its status code.
 */

import { RequestError } from './errors.js'

export function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
}

/** Domain failure: HTTP 200 with `ok:false` so the browser reads one shape. */
export function failure(error) {
  const message = error instanceof Error ? error.message : String(error)
  const code = error && typeof error === 'object' && typeof error.code === 'string' ? error.code : 'internal'
  const status = error instanceof RequestError ? error.status : 200
  return json({ ok: false, error: message, code }, status)
}

/** Wrap a handler so a thrown error never escapes into the HTTP bridge. */
export function guard(handler) {
  return async (request) => {
    try {
      return await handler(request)
    } catch (error) {
      return failure(error)
    }
  }
}
