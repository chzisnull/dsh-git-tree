/**
 * dsh-git-tree — host half (Node ESM, plain JavaScript, no build step).
 *
 * This file is assembly only: it names the plugin, declares its hard services
 * and registers the authenticated Fetch routes. The git runner, path guards,
 * porcelain parser and route handlers live in `src/host/` so they can be unit
 * tested without a DSH context.
 *
 * Channel contract (verified against shipped DSH plugins):
 *   - routes are registered through `ctx.connection.fetch.register({ path,
 *     methods, requestBody, fetch })`; Connection owns the browser-trust fence
 *     (Host/Origin checks + authenticated peer), answers 401/403 before the
 *     handler, and disposes the route with this plugin's fiber;
 *   - the browser calls the document-relative form (`api/git-tree/status`)
 *     with a plain same-origin `fetch`, which carries the session cookie.
 *
 * Git safety (the pattern DSH itself uses in @deepseek-ai/dsh-workspace-changes):
 *   - no shell: `ctx.subprocess.spawn({ argv })`, argv built from constants;
 *   - scrubbed child environment plus GIT_TERMINAL_PROMPT=0 (never block on
 *     credentials), GIT_OPTIONAL_LOCKS=0 (never take optional locks in the
 *     user's repository), GIT_CONFIG_COUNT=0 (ignore ambient indexed config);
 *   - bounded output, bounded run time, `--` before user-supplied paths, and a
 *     cwd that must stay inside the workspace root;
 *   - read-only commands only (`status`, `rev-parse`, `diff`); no mutation is
 *     implemented here on purpose.
 *
 * Config: a host plugin may export a schemastery `Config` and the Loader
 * validates the row's `config` against it (workbench does this). This skeleton
 * intentionally exports none, because it must build with zero dependencies;
 * see README.md for the four-line pattern to add one later.
 */

import { handleDiff, handleStatus } from './src/host/handlers.js'
import { guard } from './src/host/http.js'

/** Stable Cordis plugin name (not strictly required; matches the patch row id). */
export const name = 'dsh-git-tree'

/**
 * Hard dependencies: without the Fetch-route registry or the subprocess
 * capability the plugin has nothing to do, so Cordis keeps it inactive instead
 * of letting `apply` throw.
 */
export const inject = ['connection', 'subprocess']

/** Exact Fetch route paths. `/api/<name>.<verb>` is the shape shipped plugins use. */
const STATUS_PATH = '/api/git-tree/status'
const DIFF_PATH = '/api/git-tree/diff'

/**
 * Register the two routes. Each registration is owned by this plugin's fiber:
 * `ctx.connection.fetch.register` wraps it in an effect, so unloading the row
 * (or disabling the bundle) removes the routes with no extra cleanup here.
 */
export function apply(ctx) {
  ctx.connection.fetch.register({
    path: STATUS_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: guard((request) => handleStatus(ctx, request)),
  })
  ctx.connection.fetch.register({
    path: DIFF_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: guard((request) => handleDiff(ctx, request)),
  })
}
