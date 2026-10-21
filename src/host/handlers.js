/**
 * Route handlers for the host half.
 *
 * Handlers answer from the git runner and the parsers; they never register
 * themselves. `index.js` owns the route table, so this module stays a plain
 * importable unit that a Node test can call directly.
 */

import { MAX_DIFF_BYTES, MAX_STATUS_BYTES, git, subprocessOf } from './git.js'
import { parsePorcelainV2 } from './porcelain.js'
import { resolveCwd, safeRepoPath } from './paths.js'
import { json } from './http.js'

export async function handleStatus(ctx, request) {
  const url = new URL(request.url)
  const cwd = resolveCwd(ctx, url.searchParams.get('cwd') || '')
  const signal = request.signal
  const subprocess = subprocessOf(ctx)

  const statusText = await git(
    subprocess,
    ['status', '--porcelain=v2', '--branch', '--untracked-files=all', '--no-renames', '-z'],
    cwd,
    { maxBytes: MAX_STATUS_BYTES, signal },
  )
  const parsed = parsePorcelainV2(statusText)

  let repoRoot = cwd
  try {
    repoRoot =
      (await git(subprocess, ['rev-parse', '--show-toplevel'], cwd, { maxBytes: 64 * 1024, signal })).trim() || cwd
  } catch {
    /* keep cwd; status already succeeded inside a repository */
  }

  return json({
    ok: true,
    cwd,
    repoRoot,
    branch: parsed.branch,
    oid: parsed.oid,
    upstream: parsed.upstream,
    ahead: parsed.ahead,
    behind: parsed.behind,
    entries: parsed.entries,
    truncated: parsed.truncated,
  })
}

export async function handleDiff(ctx, request) {
  const url = new URL(request.url)
  const cwd = resolveCwd(ctx, url.searchParams.get('cwd') || '')
  const path = safeRepoPath(url.searchParams.get('path'))
  const staged = url.searchParams.get('staged') === '1'
  const subprocess = subprocessOf(ctx)

  const argv = ['diff', '--no-color', '--no-ext-diff', '--no-textconv']
  if (staged) argv.push('--cached')
  argv.push('--', path)

  const text = await git(subprocess, argv, cwd, { maxBytes: MAX_DIFF_BYTES, signal: request.signal })
  return json({ ok: true, path, staged, text })
}
