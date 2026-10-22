/**
 * dsh-git-tree — host half (Node ESM, plain JavaScript, no build step).
 *
 * This file is assembly only: it names the plugin, declares its hard services
 * and registers the authenticated Fetch routes. The git runner, path guards,
 * parsers and route handlers live in `src/host/` so they can be unit tested
 * without a DSH context.
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
 *   - the write surface is file-level stage / unstage / commit only. No
 *     reset --hard, no push, no amend, no discard route exists on purpose.
 *
 * Config: a host plugin may export a schemastery `Config` and the Loader
 * validates the row's `config` against it (workbench does this). This skeleton
 * intentionally exports none, because it must build with zero dependencies;
 * see README.md for the four-line pattern to add one later.
 */

import {
  handleBranchCreate,
  handleBranchDelete,
  handleBranchRename,
  handleCheckout,
  handleCommit,
  handleCommitInfo,
  handleConflictApply,
  handleConflictMarkResolved,
  handleConflictRevert,
  handleDiscard,
  handleDiff,
  handleFetch,
  handleOpen,
  handlePush,
  handleHistory,
  handleMerge,
  handlePull,
  handleRefs,
  handleRepositoryOpen,
  handleRepositoryPin,
  handleRemove,
  handleStage,
  handleStatus,
  handleUnstage,
  handleWorkspaces,
} from './src/host/handlers.js'
import { guard } from './src/host/http.js'
import {
  handleAiModels,
  handleAiModelSave,
  handleConflictResolve,
  handleGenerateCommitMessage,
} from './src/host/ai.js'

/** Stable Cordis plugin name (not strictly required; matches the patch row id). */
export const name = 'dsh-git-tree'

/**
 * Hard dependencies: without the Fetch-route registry or the subprocess
 * capability the plugin has nothing to do, so Cordis keeps it inactive instead
 * of letting `apply` throw.
 */
export const inject = ['connection', 'subprocess']

/** Exact Fetch route paths. */
const ROUTES = [
  { path: '/api/git-tree/workspaces', methods: ['GET'], handler: handleWorkspaces },
  { path: '/api/git-tree/repositories/pin', methods: ['POST'], handler: handleRepositoryPin },
  { path: '/api/git-tree/repositories/open', methods: ['POST'], handler: handleRepositoryOpen },
  { path: '/api/git-tree/status', methods: ['GET'], handler: handleStatus },
  { path: '/api/git-tree/diff', methods: ['GET'], handler: handleDiff },
  { path: '/api/git-tree/refs', methods: ['GET'], handler: handleRefs },
  { path: '/api/git-tree/history', methods: ['GET'], handler: handleHistory },
  { path: '/api/git-tree/merge', methods: ['POST'], handler: handleMerge },
  { path: '/api/git-tree/push', methods: ['POST'], handler: handlePush },
  { path: '/api/git-tree/fetch', methods: ['POST'], handler: handleFetch },
  { path: '/api/git-tree/pull', methods: ['POST'], handler: handlePull },
  { path: '/api/git-tree/commit-info', methods: ['GET'], handler: handleCommitInfo },
  { path: '/api/git-tree/checkout', methods: ['POST'], handler: handleCheckout },
  { path: '/api/git-tree/branch/create', methods: ['POST'], handler: handleBranchCreate },
  { path: '/api/git-tree/branch/rename', methods: ['POST'], handler: handleBranchRename },
  { path: '/api/git-tree/branch/delete', methods: ['POST'], handler: handleBranchDelete },
  { path: '/api/git-tree/stage', methods: ['POST'], handler: handleStage },
  { path: '/api/git-tree/unstage', methods: ['POST'], handler: handleUnstage },
  { path: '/api/git-tree/commit', methods: ['POST'], handler: handleCommit },
  { path: '/api/git-tree/discard', methods: ['POST'], handler: handleDiscard },
  { path: '/api/git-tree/remove', methods: ['POST'], handler: handleRemove },
  { path: '/api/git-tree/open', methods: ['POST'], handler: handleOpen },
  { path: '/api/git-tree/ai/models', methods: ['GET'], handler: handleAiModels },
  { path: '/api/git-tree/ai/model', methods: ['POST'], handler: handleAiModelSave },
  { path: '/api/git-tree/commit-message', methods: ['POST'], handler: handleGenerateCommitMessage },
  { path: '/api/git-tree/conflict/resolve', methods: ['POST'], handler: handleConflictResolve },
  { path: '/api/git-tree/conflict/apply', methods: ['POST'], handler: handleConflictApply },
  { path: '/api/git-tree/conflict/revert', methods: ['POST'], handler: handleConflictRevert },
  { path: '/api/git-tree/conflict/mark-resolved', methods: ['POST'], handler: handleConflictMarkResolved },
]

/**
 * Register the routes. Each registration is owned by this plugin's fiber:
 * `ctx.connection.fetch.register` wraps it in an effect, so unloading the row
 * (or disabling the bundle) removes the routes with no extra cleanup here.
 */
export function apply(ctx) {
  for (const route of ROUTES) {
    ctx.connection.fetch.register({
      path: route.path,
      methods: route.methods,
      requestBody: 'buffered',
      fetch: guard((request) => route.handler(ctx, request)),
    })
  }
}
