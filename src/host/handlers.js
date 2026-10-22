/**
 * Route handlers for the host half.
 *
 * Handlers answer from the git runner and the parsers; they never register
 * themselves. `index.js` owns the route table, so this module stays a plain
 * importable unit that a Node test can call directly.
 *
 * Read routes: status, diff, refs, history, commit-info, workspaces.
 * Write routes: stage, unstage, commit, checkout, merge, branch create/rename/
 * delete, discard, remove, open and a non-forcing push of the current branch.
 */

import {
  GIT_PUSH_TIMEOUT_MS,
  currentBranchOf,
  MAX_DIFF_BYTES,
  MAX_PUSH_BYTES,
  MAX_REFS_BYTES,
  MAX_STATUS_BYTES,
  git,
  runProcess,
  subprocessOf,
} from './git.js'
import { parseUnifiedDiff } from './diff.js'
import { parsePorcelainV2, summariseEntries } from './porcelain.js'
import {
  DEFAULT_LIMIT,
  HISTORY_FORMAT,
  MAX_LIMIT,
  assignLanes,
  isSafeBranchName,
  parseDecoration,
  parseHistoryLog,
} from './history.js'
import { COMMIT_FORMAT, isSafeCommitSha, parseCommitShow, parseNameStatus } from './commit.js'
import { REF_ARGS, parseRefs } from './refs.js'
import { openArgv } from './open.js'
import { resolveCwd, safeRepoPath, workspaceRootOf } from './paths.js'
import { GitError, RequestError } from './errors.js'
import { orderWorkspaces, readRepositoryPrefs, recordOpened, togglePinned, writeRepositoryPrefs } from './repositories.js'
import { mapRemoteFailure, resolvePullTarget, splitUpstream } from './remote.js'
import {
  hasConflictMarkers,
  isUnmerged,
  parseConflictText,
  readConflictFile,
  requireUnmerged,
  revertConflict,
  stageResolved,
  validateResolvedText,
  writeRepoFile,
} from './conflict.js'
import { json, readJsonBody } from './http.js'

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
  return json({ ok: true, current, workspaces: orderWorkspaces(workspaces, readRepositoryPrefs()) })
}

/** Pin or unpin one workspace in the switcher. */
export async function handleRepositoryPin(ctx, request) {
  const body = await readJsonBody(request)
  const path = typeof body.path === 'string' ? body.path.trim() : ''
  if (!path || path.length > 4096) throw new RequestError('无效的仓库路径', 400, 'invalid-path')
  const pinned = body.pinned !== false
  const prefs = togglePinned(readRepositoryPrefs(), path, pinned)
  if (!writeRepositoryPrefs(prefs)) {
    throw new RequestError('无法保存置顶（DSH 目录不可写）', 409, 'settings-unwritable')
  }
  return json({ ok: true, path, pinned, pinnedPaths: prefs.pinned })
}

/** Count one deliberate switch to a repository; drives the "frequently used" order. */
export async function handleRepositoryOpen(ctx, request) {
  const body = await readJsonBody(request)
  const path = typeof body.path === 'string' ? body.path.trim() : ''
  if (!path || path.length > 4096) throw new RequestError('无效的仓库路径', 400, 'invalid-path')
  const prefs = recordOpened(readRepositoryPrefs(), path)
  // A read-only home must not block switching, so the write stays best effort.
  writeRepositoryPrefs(prefs)
  return json({ ok: true, path, openCount: prefs.opened[path] ? prefs.opened[path].count : 0 })
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
    platform: process.platform,
    branch: parsed.branch,
    oid: parsed.oid,
    upstream: parsed.upstream,
    ahead: parsed.ahead,
    behind: parsed.behind,
    identity: await readIdentity(subprocess, cwd),
    remotes: await readRemotes(subprocess, cwd),
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
  const commit = url.searchParams.get('commit') || ''
  if (commit && !isSafeCommitSha(commit)) throw new RequestError('无效的提交哈希', 400, 'invalid-sha')
  const subprocess = subprocessOf(ctx)

  // An unmerged path has no ordinary unified diff (git prints a combined one),
  // so answer with the working-tree file and its conflict blocks instead.
  if (!commit && (await isUnmerged(subprocess, cwd, path))) {
    const file = readConflictFile(cwd, path)
    const parsed = parseConflictText(file.text)
    return json({
      ok: true,
      path,
      side: 'conflicted',
      staged: false,
      conflicted: true,
      conflict: parsed,
      binary: false,
      stats: { additions: 0, deletions: 0 },
      files: [],
      text: file.text,
    })
  }

  let argv
  if (commit) {
    argv = ['show', commit, '--no-color', '--no-ext-diff', '--no-textconv', '--format=']
  } else {
    argv = ['diff', '--no-color', '--no-ext-diff', '--no-textconv']
    if (side === 'staged') argv.push('--cached')
  }
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

export async function handleHistory(ctx, request) {
  const { url, cwd } = handleCwd(ctx, request)
  const subprocess = subprocessOf(ctx)

  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit')) || DEFAULT_LIMIT))
  const skip = Math.max(0, Number(url.searchParams.get('skip')) || 0)
  const scope = url.searchParams.get('scope') || 'all'
  const query = (url.searchParams.get('query') || '').trim()
  const author = (url.searchParams.get('author') || '').trim()
  const path = url.searchParams.get('path') || ''

  const argv = ['log', '--date-order', '--decorate=full', '--format=' + HISTORY_FORMAT]
  if (scope === 'current') {
    argv.push('HEAD')
  } else if (scope.startsWith('branch:')) {
    const branch = scope.slice('branch:'.length)
    if (!isSafeBranchName(branch)) throw new RequestError('无效的分支名', 400, 'invalid-branch-name')
    argv.push('refs/heads/' + branch)
  } else if (scope.startsWith('tag:')) {
    const tag = scope.slice('tag:'.length)
    if (!isSafeBranchName(tag)) throw new RequestError('无效的标签名', 400, 'invalid-branch-name')
    argv.push('refs/tags/' + tag)
  } else {
    argv.push('--branches', '--tags', 'HEAD')
  }
  if (query) argv.push('--grep=' + query, '--fixed-strings', '--regexp-ignore-case')
  if (author) argv.push('--author=' + author, '--fixed-strings', '--regexp-ignore-case')
  argv.push('--max-count=' + String(limit + 1), '--skip=' + String(skip))
  if (path) argv.push('--', safeRepoPath(path))

  let text = ''
  try {
    text = await git(subprocess, argv, cwd, { maxBytes: MAX_DIFF_BYTES, signal: request.signal })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // An unborn branch has no history yet; that is an empty list, not a failure.
    if (/does not have any commits|unknown revision|bad default revision/i.test(message)) {
      return json({ ok: true, commits: [], laneCount: 1, hasMore: false, scope })
    }
    throw error
  }

  const parsed = parseHistoryLog(text)
  const hasMore = parsed.length > limit
  const commits = hasMore ? parsed.slice(0, limit) : parsed
  const laneCount = assignLanes(commits)
  return json({ ok: true, commits, laneCount, hasMore, scope })
}

export async function handleCommitInfo(ctx, request) {
  const { url, cwd } = handleCwd(ctx, request)
  const sha = url.searchParams.get('sha')
  if (!isSafeCommitSha(sha)) throw new RequestError('无效的提交哈希', 400, 'invalid-sha')
  const subprocess = subprocessOf(ctx)

  const showText = await git(
    subprocess,
    ['show', '--no-patch', '--decorate=full', '--format=' + COMMIT_FORMAT, sha],
    cwd,
    { maxBytes: 256 * 1024, signal: request.signal },
  )
  const parsed = parseCommitShow(showText)
  if (!parsed) throw new RequestError('无法解析该提交', 400, 'invalid-commit')

  const nameStatus = await git(
    subprocess,
    ['show', '--name-status', '--find-renames', '--format=', sha],
    cwd,
    { maxBytes: MAX_DIFF_BYTES, signal: request.signal },
  )

  return json({
    ok: true,
    sha: parsed.sha,
    author: parsed.author,
    authorEmail: parsed.authorEmail,
    date: parsed.date,
    subject: parsed.subject,
    body: parsed.body,
    parents: parsed.parents,
    refs: parseDecoration(parsed.decoration),
    files: parseNameStatus(nameStatus),
  })
}

export async function handleCheckout(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  const body = await readJsonBody(request)
  const branch = body.branch
  if (!isSafeBranchName(branch)) throw new RequestError('无效的分支名', 400, 'invalid-branch-name')
  const subprocess = subprocessOf(ctx)

  try {
    await git(subprocess, ['rev-parse', '--verify', 'refs/heads/' + branch], cwd, { maxBytes: 8 * 1024 })
  } catch {
    throw new RequestError('分支不存在', 404, 'unknown-branch')
  }

  const statusText = await git(
    subprocess,
    ['status', '--porcelain=v2', '--branch', '--untracked-files=all', '-z'],
    cwd,
    { maxBytes: MAX_STATUS_BYTES },
  )
  const dirty = parsePorcelainV2(statusText).entries.some(
    (entry) => entry.kind !== 'untracked' && entry.kind !== 'ignored' && (entry.staged || entry.unstaged || entry.conflicted),
  )
  if (dirty) throw new RequestError('有未提交改动，先提交或贮藏再切换分支', 409, 'dirty-worktree')

  try {
    await git(subprocess, ['checkout', '--quiet', branch], cwd, { maxBytes: 256 * 1024 })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (/would be overwritten|local changes|untracked working tree/i.test(detail)) {
      throw new RequestError(detail, 409, 'checkout-blocked')
    }
    throw error
  }
  return json({ ok: true, branch })
}

export async function handleBranchCreate(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  const body = await readJsonBody(request)
  const name = body.name
  if (!isSafeBranchName(name)) throw new RequestError('无效的分支名', 400, 'invalid-branch-name')
  const start = body.start === undefined || body.start === '' ? 'HEAD' : String(body.start)
  if (start !== 'HEAD' && !isSafeBranchName(start) && !isSafeCommitSha(start)) {
    throw new RequestError('无效的分支起点', 400, 'invalid-start-point')
  }
  const subprocess = subprocessOf(ctx)

  try {
    await git(subprocess, ['rev-parse', '--verify', 'refs/heads/' + name], cwd, { maxBytes: 8 * 1024 })
    throw new RequestError('分支已存在', 409, 'branch-exists')
  } catch (error) {
    if (error instanceof RequestError) throw error
    /* the branch does not exist, which is what we want */
  }

  await git(subprocess, ['branch', name, start], cwd, { maxBytes: 256 * 1024 })
  return json({ ok: true, name, start })
}

export async function handleBranchRename(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  const body = await readJsonBody(request)
  const from = body.from
  const to = body.to
  if (!isSafeBranchName(from) || !isSafeBranchName(to)) {
    throw new RequestError('无效的分支名', 400, 'invalid-branch-name')
  }
  const subprocess = subprocessOf(ctx)

  try {
    await git(subprocess, ['rev-parse', '--verify', 'refs/heads/' + from], cwd, { maxBytes: 8 * 1024 })
  } catch {
    throw new RequestError('分支不存在', 404, 'unknown-branch')
  }
  try {
    await git(subprocess, ['rev-parse', '--verify', 'refs/heads/' + to], cwd, { maxBytes: 8 * 1024 })
    throw new RequestError('目标分支已存在', 409, 'branch-exists')
  } catch (error) {
    if (error instanceof RequestError) throw error
    /* target is free */
  }

  await git(subprocess, ['branch', '-m', from, to], cwd, { maxBytes: 256 * 1024 })
  return json({ ok: true, from, to })
}

export async function handleBranchDelete(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  const body = await readJsonBody(request)
  const name = body.name
  if (!isSafeBranchName(name)) throw new RequestError('无效的分支名', 400, 'invalid-branch-name')
  const subprocess = subprocessOf(ctx)

  const current = await currentBranchOf(subprocess, cwd)
  if (current !== '' && current === name) {
    throw new RequestError('不能删除当前分支', 409, 'current-branch')
  }
  try {
    await git(subprocess, ['rev-parse', '--verify', 'refs/heads/' + name], cwd, { maxBytes: 8 * 1024 })
  } catch {
    throw new RequestError('分支不存在', 404, 'unknown-branch')
  }

  try {
    await git(subprocess, ['branch', '-d', name], cwd, { maxBytes: 256 * 1024 })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (/not fully merged/i.test(detail)) {
      throw new RequestError('分支尚未合并，先合并再删除', 409, 'branch-not-merged')
    }
    throw error
  }
  return json({ ok: true, name })
}

export async function handleMerge(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  const body = await readJsonBody(request)
  const branch = body.branch
  if (!isSafeBranchName(branch)) throw new RequestError('无效的分支名', 400, 'invalid-branch-name')
  const subprocess = subprocessOf(ctx)

  const current = await currentBranchOf(subprocess, cwd)
  if (current === '') throw new RequestError('当前处于分离头指针状态，无法合并', 409, 'detached-head')
  if (current === branch) throw new RequestError('不能把分支合并到它自己', 409, 'same-branch')

  try {
    await git(subprocess, ['rev-parse', '--verify', 'refs/heads/' + branch], cwd, { maxBytes: 8 * 1024 })
  } catch {
    throw new RequestError('分支不存在', 404, 'unknown-branch')
  }

  // git merges happily when local edits do not overlap the merge; only refuse
  // (with git's own reason) when the merge would overwrite uncommitted work.
  try {
    await git(subprocess, ['merge', '--no-edit', branch], cwd, { maxBytes: MAX_DIFF_BYTES })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (/CONFLICT|Automatic merge failed|fix conflicts/i.test(detail)) {
      throw new RequestError('合并产生冲突，冲突文件已列在改动里', 409, 'merge-conflict')
    }
    if (/not possible because you have unmerged|unresolved conflicts/i.test(detail)) {
      throw new RequestError('有未解决的冲突，先解决再合并', 409, 'unmerged')
    }
    if (/commit your changes or stash|would be overwritten/i.test(detail)) {
      throw new RequestError('本地改动会被这次合并覆盖，先提交或贮藏再合并', 409, 'dirty-worktree')
    }
    throw error
  }
  return json({ ok: true, branch, current })
}

/** Current upstream as `<remote>/<branch>`, or '' when the branch has none. */
async function readUpstream(subprocess, cwd) {
  try {
    const out = await git(subprocess, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], cwd, {
      maxBytes: 8 * 1024,
    })
    return out.trim()
  } catch {
    return ''
  }
}

async function readRemotes(subprocess, cwd) {
  try {
    const out = await git(subprocess, ['remote'], cwd, { maxBytes: 16 * 1024 })
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Push the current branch. With an upstream, a plain `git push`; without one,
 * `push -u <remote> <branch>` so the next push is a no-argument one. Never
 * forces and never pushes other branches.
 */
export async function handlePush(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  await readJsonBody(request)
  const subprocess = subprocessOf(ctx)

  const current = await currentBranchOf(subprocess, cwd)
  if (current === '') throw new RequestError('当前处于分离头指针状态，无法推送', 409, 'detached-head')

  const remotes = await readRemotes(subprocess, cwd)
  if (remotes.length === 0) throw new RequestError('当前仓库没有配置远端', 409, 'no-remote')

  const upstream = await readUpstream(subprocess, cwd)
  let argv
  let remote = ''
  if (upstream) {
    const parsed = splitUpstream(upstream)
    remote = parsed ? parsed.remote : upstream
    const remoteBranch = parsed ? parsed.branch : current
    // Explicit remote and refspec: never let push.default or a remote-level
    // push refspec decide what gets pushed.
    argv = ['push', remote, current + ':' + remoteBranch]
  } else {
    if (!remotes.includes('origin')) {
      throw new RequestError('当前分支没有 upstream，且仓库没有 origin 远端', 409, 'no-remote')
    }
    remote = 'origin'
    argv = ['push', '-u', 'origin', current]
  }

  try {
    await git(subprocess, argv, cwd, { maxBytes: MAX_PUSH_BYTES, timeoutMs: GIT_PUSH_TIMEOUT_MS })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (/Authentication failed|could not read Username|terminal prompts disabled|Permission denied|HTTP 40[13]/i.test(detail)) {
      throw new RequestError('推送需要认证：请先在终端登录一次，再回来重试', 409, 'auth-failed')
    }
    if (/Updates were rejected|non-fast-forward|fetch first/i.test(detail)) {
      throw new RequestError('远端有新提交，先拉取或合并后再推送', 409, 'non-fast-forward')
    }
    throw error
  }

  return json({ ok: true, branch: current, upstream: upstream || remote + '/' + current })
}

/** How many commits one revision is ahead of another, in best-effort terms. */
async function countCommits(subprocess, cwd, range) {
  try {
    const out = await git(subprocess, ['rev-list', '--count', range], cwd, { maxBytes: 8 * 1024 })
    return Number(out.trim()) || 0
  } catch {
    return 0
  }
}

/** True when `<remote>/<branch>` exists as a remote-tracking ref. */
async function hasRemoteBranch(subprocess, cwd, remote, branch) {
  try {
    await git(subprocess, ['rev-parse', '--verify', '--quiet', 'refs/remotes/' + remote + '/' + branch], cwd, {
      maxBytes: 8 * 1024,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Fetch the remote this branch tracks (origin when it tracks nothing), pruning
 * deleted remote branches so the ahead/behind numbers stay honest. Never
 * touches the working tree.
 */
export async function handleFetch(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  await readJsonBody(request)
  const subprocess = subprocessOf(ctx)

  const remotes = await readRemotes(subprocess, cwd)
  if (remotes.length === 0) throw new RequestError('当前仓库没有配置远端', 409, 'no-remote')
  const parsed = splitUpstream(await readUpstream(subprocess, cwd))
  const remote =
    parsed && remotes.includes(parsed.remote) ? parsed.remote : remotes.includes('origin') ? 'origin' : remotes[0]

  try {
    await git(subprocess, ['fetch', remote, '--prune'], cwd, {
      maxBytes: MAX_PUSH_BYTES,
      timeoutMs: GIT_PUSH_TIMEOUT_MS,
    })
  } catch (error) {
    const mapped = mapRemoteFailure('fetch', error instanceof Error ? error.message : String(error))
    if (mapped) throw new RequestError(mapped.reason, 409, mapped.code)
    throw error
  }
  return json({ ok: true, remote })
}

/**
 * Fetch, then fast-forward the current branch (or merge, when the caller
 * explicitly asks for it because fast-forwarding is impossible).
 */
export async function handlePull(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  const body = await readJsonBody(request)
  const mode = body.mode === 'merge' ? 'merge' : 'ff-only'
  const subprocess = subprocessOf(ctx)

  const current = await currentBranchOf(subprocess, cwd)
  if (current === '') throw new RequestError('当前处于分离头指针状态，无法拉取', 409, 'detached-head')

  const remotes = await readRemotes(subprocess, cwd)
  const originBranch = remotes.includes('origin') && (await hasRemoteBranch(subprocess, cwd, 'origin', current))
  const target = resolvePullTarget({
    upstream: await readUpstream(subprocess, cwd),
    current,
    remotes,
    originBranch,
  })
  if (!target.ok) throw new RequestError(target.reason, 409, target.code)

  const startOid = (await git(subprocess, ['rev-parse', 'HEAD'], cwd, { maxBytes: 8 * 1024 })).trim()
  try {
    await git(subprocess, ['fetch', target.remote, '--prune'], cwd, {
      maxBytes: MAX_PUSH_BYTES,
      timeoutMs: GIT_PUSH_TIMEOUT_MS,
    })
  } catch (error) {
    const mapped = mapRemoteFailure('fetch', error instanceof Error ? error.message : String(error))
    if (mapped) throw new RequestError(mapped.reason, 409, mapped.code)
    throw error
  }

  const remoteRef = target.remote + '/' + target.remoteBranch
  const argv = mode === 'merge' ? ['merge', '--no-edit', remoteRef] : ['merge', '--ff-only', remoteRef]
  try {
    await git(subprocess, argv, cwd, { maxBytes: MAX_DIFF_BYTES })
  } catch (error) {
    const mapped = mapRemoteFailure(mode, error instanceof Error ? error.message : String(error))
    if (mapped) throw new RequestError(mapped.reason, 409, mapped.code)
    throw error
  }

  const pulled = await countCommits(subprocess, cwd, startOid + '..HEAD')
  return json({
    ok: true,
    branch: current,
    upstream: remoteRef,
    mode,
    pulled,
    viaUpstream: target.viaUpstream,
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

/**
 * Throw away working-tree changes. A staged row is restored on both sides
 * (index and work tree), an unstaged row only in the work tree. Destructive by
 * nature; the client confirms before calling this.
 */
export async function handleDiscard(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  const body = await readJsonBody(request)
  const paths = safePathList(body.paths)
  const staged = body.side === 'staged'
  const subprocess = subprocessOf(ctx)

  const argv = ['restore']
  if (staged) argv.push('--staged')
  argv.push('--worktree', '--', ...paths)
  await git(subprocess, argv, cwd, { maxBytes: 256 * 1024 })
  return json({ ok: true, discarded: paths, side: staged ? 'staged' : 'unstaged' })
}

/** Remove tracked files (git rm) or untracked files (git clean) from the repo. */
export async function handleRemove(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  const body = await readJsonBody(request)
  const paths = safePathList(body.paths)
  const untracked = body.untracked === true
  const subprocess = subprocessOf(ctx)

  if (untracked) {
    await git(subprocess, ['clean', '-f', '--', ...paths], cwd, { maxBytes: 256 * 1024 })
  } else {
    await git(subprocess, ['rm', '-f', '--quiet', '--', ...paths], cwd, { maxBytes: 256 * 1024 })
  }
  return json({ ok: true, removed: paths, untracked })
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

// ── local action routes ────────────────────────────────────────────────────

/**
 * Open the selected repository in Finder or a new Terminal window.
 *
 * `open` runs with a fixed argv and the already-resolved workspace as cwd; the
 * target string never reaches argv itself. Non-macOS hosts refuse the action
 * even though the client hides the buttons there.
 */
export async function handleOpen(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  const body = await readJsonBody(request)
  const target = typeof body.target === 'string' ? body.target : ''
  const argv = openArgv(target, cwd)
  const subprocess = subprocessOf(ctx)

  const result = await runProcess(subprocess, 'open', argv, cwd, {
    label: 'open',
    maxBytes: 64 * 1024,
    signal: request.signal,
  })
  if (result.code !== 0) {
    throw new GitError(result.err || 'open 退出码 ' + String(result.code), 'open-failed')
  }
  return json({ ok: true, target, cwd })
}


// ── conflict routes ────────────────────────────────────────────────────────

/** Write the reviewed resolution over the conflicted working-tree file. */
export async function handleConflictApply(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  const body = await readJsonBody(request)
  const path = safeRepoPath(body.path)
  const checked = validateResolvedText(body.content)
  if (!checked.ok) throw new RequestError(checked.reason, 409, checked.code)
  const subprocess = subprocessOf(ctx)

  await requireUnmerged(subprocess, cwd, path)
  writeRepoFile(cwd, path, checked.text)
  return json({ ok: true, path, bytes: Buffer.byteLength(checked.text, 'utf8') })
}

/** Restore the conflicted working-tree copy (git checkout --merge). */
export async function handleConflictRevert(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  const body = await readJsonBody(request)
  const path = safeRepoPath(body.path)
  const subprocess = subprocessOf(ctx)

  await requireUnmerged(subprocess, cwd, path)
  await revertConflict(subprocess, cwd, path)
  return json({ ok: true, path })
}

/** Stage a resolved file; refuses while markers are still in the file. */
export async function handleConflictMarkResolved(ctx, request) {
  const { cwd } = handleCwd(ctx, request)
  const body = await readJsonBody(request)
  const path = safeRepoPath(body.path)
  const subprocess = subprocessOf(ctx)

  await requireUnmerged(subprocess, cwd, path)
  const file = readConflictFile(cwd, path)
  if (hasConflictMarkers(file.text)) {
    throw new RequestError('文件里仍有冲突标记，先解决再标记', 409, 'markers-present')
  }
  await stageResolved(subprocess, cwd, path)
  return json({ ok: true, path })
}
