/**
 * Route handlers for the host half.
 *
 * Handlers answer from the git runner and the parsers; they never register
 * themselves. `index.js` owns the route table, so this module stays a plain
 * importable unit that a Node test can call directly.
 *
 * Read routes: status, diff, refs. Write routes: stage, unstage, commit.
 * The write surface is deliberately small: no reset --hard, no push, no amend.
 */

import { MAX_DIFF_BYTES, MAX_REFS_BYTES, MAX_STATUS_BYTES, git, subprocessOf } from './git.js'
import { parseUnifiedDiff } from './diff.js'
import { parsePorcelainV2, summariseEntries } from './porcelain.js'
import { REF_ARGS, parseRefs } from './refs.js'
import { resolveCwd, safeRepoPath, workspaceRootOf } from './paths.js'
import { RequestError } from './errors.js'
import { json } from './http.js'

const MAX_WRITE_PATHS = 500
const MAX_COMMIT_MESSAGE = 8192

/** Resolve the request cwd once, refusing anything outside the workspace. */
function handleCwd(ctx, request) {
  const url = new URL(request.url)
  return { url, cwd: resolveCwd(ctx, url.searchParams.get('cwd') || '') }
}

/** Best-effort `user.name` / `user.email` for the commit box. */
async function readIdentity(subprocess, cwd) {
  try {
    const text = await git(subprocess, ['config', '--get-regexp', '^user\\.(name|email)$'], cwd, {
      maxBytes: 8 * 1024,
    })
    const identity = { name: '', email: '' }
    for (const line of text.split('\n')) {
      const match = /^user\.(name|email)\s+(.*)$/.exec(line)
      if (match) identity[match[1]] = match[2]
    }
    return identity.name || identity.email ? identity : null
  } catch {
    return null
  }
}

// ── read routes ────────────────────────────────────────────────────────────

/**
 * Registered workspaces for the top-bar repository switcher. The current
 * session workspace is always included, even before the registry has any row.
 */
export async function handleWorkspaces(ctx) {
  const workspaces = []
  try {
    const registry = ctx.get('workspaceRegistry')
    if (registry && typeof registry.list === 'function') {
      for (const workspace of registry.list()) {
        if (!workspace || typeof workspace.path !== 'string' || !workspace.path) continue
        const segments = workspace.path.split(/[\\/]+/).filter(Boolean)
        workspaces.push({
          id: String(workspace.id ?? workspace.path),
          path: workspace.path,
          title: workspace.title || segments[segments.length - 1] || workspace.path,
        })
      }
    }
  } catch {
    /* registry not present in this composition */
  }
  const current = workspaceRootOf(ctx)
  if (!workspaces.some((workspace) => workspace.path === current)) {
    const segments = current.split(/[\\/]+/).filter(Boolean)
    workspaces.unshift({ id: current, path: current, title: segments[segments.length - 1] || current })
  }
  return json({ ok: true, current, workspaces })
}

export async function handleStatus(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  const signal = request.signal
  const subprocess = subprocessOf(ctx)

  const statusText = await git(
    subprocess,
    ['status', '--porcelain=v2', '--branch', '--untracked-files=all', '-z'],
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
    identity: await readIdentity(subprocess, cwd),
    entries: parsed.entries,
    counts: summariseEntries(parsed.entries),
    truncated: parsed.truncated,
  })
}

export async function handleDiff(ctx, request) {
  const { url, cwd } = handleCwd(ctx, request)
  const path = safeRepoPath(url.searchParams.get('path'))
  const requested = url.searchParams.get('side')
  const side = requested === 'staged' || url.searchParams.get('staged') === '1' ? 'staged' : 'unstaged'
  const subprocess = subprocessOf(ctx)

  const argv = ['diff', '--no-color', '--no-ext-diff', '--no-textconv']
  if (side === 'staged') argv.push('--cached')
  argv.push('--', path)

  const text = await git(subprocess, argv, cwd, { maxBytes: MAX_DIFF_BYTES, signal: request.signal })
  const parsed = parseUnifiedDiff(text)

  return json({
    ok: true,
    path,
    side,
    staged: side === 'staged',
    binary: parsed.binary,
    stats: parsed.stats,
    files: parsed.files,
    // Kept while the old renderer still ships; the panel uses `files`.
    text,
  })
}

export async function handleRefs(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  const subprocess = subprocessOf(ctx)

  let current = ''
  try {
    current = (await git(subprocess, ['symbolic-ref', '--short', '-q', 'HEAD'], cwd, { maxBytes: 8 * 1024 })).trim()
  } catch {
    /* detached HEAD: no current branch */
  }

  const text = await git(subprocess, REF_ARGS, cwd, {
    maxBytes: MAX_REFS_BYTES,
    signal: request.signal,
  })
  const parsed = parseRefs(text, current)
  return json({ ok: true, ...parsed })
}

// ── write routes ───────────────────────────────────────────────────────────

async function readJsonBody(request) {
  try {
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object')
    return body
  } catch {
    throw new RequestError('请求体必须是 JSON 对象')
  }
}

/** Validate a list of repository-relative paths before any of them reaches argv. */
function safePathList(value) {
  if (!Array.isArray(value) || value.length === 0) throw new RequestError('缺少 paths 参数')
  if (value.length > MAX_WRITE_PATHS) {
    throw new RequestError('一次最多操作 ' + String(MAX_WRITE_PATHS) + ' 个路径', 400, 'too-many-paths')
  }
  return value.map(safeRepoPath)
}

export async function handleStage(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  const body = await readJsonBody(request)
  const paths = safePathList(body.paths)
  const subprocess = subprocessOf(ctx)

  await git(subprocess, ['add', '-A', '--', ...paths], cwd, { maxBytes: 256 * 1024 })
  return json({ ok: true, staged: paths })
}

export async function handleUnstage(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  const body = await readJsonBody(request)
  const paths = safePathList(body.paths)
  const subprocess = subprocessOf(ctx)

  await git(subprocess, ['reset', '--quiet', 'HEAD', '--', ...paths], cwd, { maxBytes: 256 * 1024 })
  return json({ ok: true, unstaged: paths })
}

export async function handleCommit(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  const body = await readJsonBody(request)
  const subprocess = subprocessOf(ctx)

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) throw new RequestError('提交信息不能为空', 400, 'empty-message')
  if (message.length > MAX_COMMIT_MESSAGE) {
    throw new RequestError('提交信息过长', 400, 'message-too-long')
  }

  // Unmerged entries make a commit impossible; say so before git does.
  const unmerged = await git(subprocess, ['ls-files', '-u', '-z'], cwd, { maxBytes: 256 * 1024 })
  if (unmerged.length > 0) {
    throw new RequestError('存在未合并文件，请先解决冲突', 409, 'conflicts-present')
  }

  try {
    await git(subprocess, ['commit', '-m', message], cwd, { maxBytes: 1024 * 1024 })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (/nothing to commit|no changes added/i.test(detail)) {
      throw new RequestError('没有可提交的暂存内容', 409, 'nothing-to-commit')
    }
    throw error
  }

  let sha = ''
  try {
    sha = (await git(subprocess, ['rev-parse', 'HEAD'], cwd, { maxBytes: 8 * 1024 })).trim()
  } catch {
    /* commit succeeded; the receipt is best effort */
  }
  return json({
    ok: true,
    sha,
    shortSha: sha.slice(0, 7),
    subject: message.split('\n')[0] ?? '',
  })
}
