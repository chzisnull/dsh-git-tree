/**
 * dsh-git-tree — host half (Node ESM, plain JavaScript, no build step).
 *
 * This is the process-side half of the plugin. It is mounted by the Loader row
 * the bundle's `cordis.patch.yml` inserts, and it serves two authenticated
 * exact Fetch routes that the browser half calls:
 *
 *   GET /api/git-tree/status   working-tree summary (branch, ahead/behind, entries)
 *   GET /api/git-tree/diff     unified diff for one path (optionally --cached)
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

import { isAbsolute, relative, resolve as resolvePath } from 'node:path'

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

/** git output caps: status is bounded, diff is bounded tighter. */
const MAX_STATUS_BYTES = 4 * 1024 * 1024
const MAX_DIFF_BYTES = 2 * 1024 * 1024
const MAX_ENTRIES = 5000
const GIT_TIMEOUT_MS = 10_000

/** Environment every git child starts from (merged over the subprocess scrub). */
const GIT_ENV = Object.freeze({
  GIT_TERMINAL_PROMPT: '0',
  GIT_OPTIONAL_LOCKS: '0',
  GIT_CONFIG_COUNT: '0',
  GIT_PAGER: 'cat',
  LC_ALL: 'C',
})

// ── errors ─────────────────────────────────────────────────────────────────

class RequestError extends Error {
  constructor(message, status = 400, code = 'bad-request') {
    super(message)
    this.name = 'RequestError'
    this.status = status
    this.code = code
  }
}

class GitError extends Error {
  constructor(message, code = 'git-failed') {
    super(message)
    this.name = 'GitError'
    this.code = code
  }
}

// ── HTTP helpers ───────────────────────────────────────────────────────────

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
}

/** Domain failure: HTTP 200 with `ok:false` so the browser reads one shape. */
function failure(error) {
  const message = error instanceof Error ? error.message : String(error)
  const code = error && typeof error === 'object' && typeof error.code === 'string' ? error.code : 'internal'
  const status = error instanceof RequestError ? error.status : 200
  return json({ ok: false, error: message, code }, status)
}

/** Wrap a handler so a thrown error never escapes into the HTTP bridge. */
function guard(handler) {
  return async (request) => {
    try {
      return await handler(request)
    } catch (error) {
      return failure(error)
    }
  }
}

// ── workspace + path safety ────────────────────────────────────────────────

/** Workspace root from the host services, with the same fallback ladder workbench uses. */
function workspaceRootOf(ctx) {
  try {
    const policy = ctx.get('sandboxPolicy')
    if (policy && typeof policy.workspaceRoot === 'string' && policy.workspaceRoot) return policy.workspaceRoot
  } catch {
    /* service not present in this composition */
  }
  try {
    const fs = ctx.get('fs')
    if (fs && typeof fs.resolve === 'function') {
      const target = fs.resolve('.')
      if (target) return typeof fs.processPath === 'function' ? fs.processPath(target) : target
    }
  } catch {
    /* service not present */
  }
  return process.cwd()
}

/**
 * Resolve the requested `cwd` (optional) and confine it to the workspace root.
 * A panel may only read repositories inside the workspace it was opened in.
 */
function resolveCwd(ctx, requested) {
  const root = workspaceRootOf(ctx)
  if (!requested) return root
  if (typeof requested !== 'string' || requested.includes('\0')) throw new RequestError('无效的 cwd 参数')
  let absolute
  try {
    const fs = ctx.get('fs')
    if (fs && typeof fs.resolve === 'function') {
      const target = fs.resolve(requested)
      absolute = target ? (typeof fs.processPath === 'function' ? fs.processPath(target) : target) : requested
    } else {
      absolute = resolvePath(root, requested)
    }
  } catch {
    throw new RequestError('无法解析 cwd 参数')
  }
  const rel = relative(root, absolute)
  if (rel !== '' && (rel.startsWith('..') || isAbsolute(rel))) throw new RequestError('cwd 位于工作区之外', 403, 'outside-workspace')
  return absolute
}

/**
 * Validate a repository-relative path before it reaches argv.
 * Rejects NUL, absolute paths, `..` segments, option-looking paths and empty input.
 */
function safeRepoPath(value) {
  if (typeof value !== 'string' || value.length === 0) throw new RequestError('缺少 path 参数')
  if (value.length > 4096) throw new RequestError('path 参数过长')
  if (value.includes('\0')) throw new RequestError('path 不能包含 NUL')
  if (isAbsolute(value) || value.startsWith('~')) throw new RequestError('path 必须是仓库内相对路径')
  if (value.startsWith('-')) throw new RequestError('path 不能以 - 开头')
  const segments = value.split(/[\\/]+/)
  if (segments.some((segment) => segment === '..')) throw new RequestError('path 不能包含 ..')
  return segments.filter(Boolean).join('/')
}

// ── git runner ─────────────────────────────────────────────────────────────

/**
 * Run one git command through the subprocess capability.
 * @returns {{ code: number, out: string, err: string }}
 */
async function execGit(ctx, argv, cwd, options = {}) {
  const subprocess = ctx.get('subprocess')
  if (!subprocess || typeof subprocess.resolveExecutable !== 'function' || typeof subprocess.spawn !== 'function') {
    throw new GitError('subprocess 服务不可用：该插件需要 subprocess 能力', 'subprocess-unavailable')
  }
  const maxBytes = options.maxBytes ?? MAX_STATUS_BYTES
  let exe
  try {
    exe = await subprocess.resolveExecutable('git')
  } catch (error) {
    throw new GitError('未找到 git 可执行文件（macOS 上仅安装 Command Line Tools 存根时也会出现）', 'git-not-found')
  }
  let handle
  try {
    handle = subprocess.spawn({
      argv: [exe, ...argv],
      cwd,
      env: { ...GIT_ENV },
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes },
        stderr: { maxBytes: 256 * 1024 },
      },
      graceMs: options.timeoutMs ?? GIT_TIMEOUT_MS,
      ...(options.signal ? { signal: options.signal } : {}),
    })
  } catch (error) {
    throw new GitError('无法启动 git：' + (error instanceof Error ? error.message : String(error)), 'git-spawn-failed')
  }
  const outcome = await handle.done
  const stdout = handle.collected?.stdout?.readFrom(0)
  const stderr = handle.collected?.stderr?.readFrom(0)
  if (stdout?.lossy) throw new GitError('git 输出超出上限，请缩小查询范围', 'output-too-large')
  return { code: outcome.exitCode, out: stdout?.text ?? '', err: (stderr?.text ?? '').trim() }
}

/** Run git and throw on a non-zero exit, carrying git's own message. */
async function git(ctx, argv, cwd, options) {
  const result = await execGit(ctx, argv, cwd, options)
  if (result.code !== 0) throw new GitError(result.err || 'git 退出码 ' + String(result.code), 'git-failed')
  return result.out
}

// ── porcelain v2 parsing ───────────────────────────────────────────────────

/**
 * Parse `git status --porcelain=v2 --branch -z` output.
 * Record shapes (git-status(1)): `1 XY sub mH mI mW hH hI <path>`,
 * `2 XY sub mH mI mW hH hI Xscore <path>` (renames; disabled here),
 * `? <path>`, `! <path>`, and `# branch.*` headers.
 */
function parsePorcelainV2(text) {
  const entries = []
  let branch = ''
  let oid = ''
  let upstream = ''
  let ahead = 0
  let behind = 0
  let truncated = false
  for (const record of text.split('\0')) {
    if (!record) continue
    if (record.startsWith('# branch.oid ')) {
      oid = record.slice('# branch.oid '.length).trim()
      continue
    }
    if (record.startsWith('# branch.head ')) {
      branch = record.slice('# branch.head '.length).trim()
      continue
    }
    if (record.startsWith('# branch.upstream ')) {
      upstream = record.slice('# branch.upstream '.length).trim()
      continue
    }
    if (record.startsWith('# branch.ab ')) {
      const match = /\+(\d+)\s+-(\d+)/.exec(record)
      if (match) {
        ahead = Number(match[1])
        behind = Number(match[2])
      }
      continue
    }
    if (record.startsWith('#')) continue

    let entry
    if (record[0] === '1') {
      // 8 space-separated fields precede the path.
      const fields = record.split(' ')
      const xy = fields[1] || '??'
      entry = { path: fields.slice(8).join(' '), x: xy[0] || '?', y: xy[1] || '?', kind: 'changed' }
    } else if (record[0] === '2') {
      // Renames: 9 fields precede the new path; also carries the score field.
      const fields = record.split(' ')
      const xy = fields[1] || '??'
      entry = { path: fields.slice(9).join(' '), x: xy[0] || '?', y: xy[1] || '?', kind: 'renamed' }
    } else if (record[0] === '?') {
      entry = { path: record.slice(2), x: '?', y: '?', kind: 'untracked' }
    } else if (record[0] === '!') {
      entry = { path: record.slice(2), x: '!', y: '!', kind: 'ignored' }
    }
    if (!entry || !entry.path) continue
    if (entries.length >= MAX_ENTRIES) {
      truncated = true
      break
    }
    entries.push(entry)
  }
  return { oid, branch, upstream, ahead, behind, entries, truncated }
}

// ── handlers ───────────────────────────────────────────────────────────────

async function handleStatus(ctx, request) {
  const url = new URL(request.url)
  const cwd = resolveCwd(ctx, url.searchParams.get('cwd') || '')
  const signal = request.signal

  const statusText = await git(
    ctx,
    ['status', '--porcelain=v2', '--branch', '--untracked-files=all', '--no-renames', '-z'],
    cwd,
    { maxBytes: MAX_STATUS_BYTES, signal },
  )
  const parsed = parsePorcelainV2(statusText)

  let repoRoot = cwd
  try {
    repoRoot = (await git(ctx, ['rev-parse', '--show-toplevel'], cwd, { maxBytes: 64 * 1024, signal })).trim() || cwd
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

async function handleDiff(ctx, request) {
  const url = new URL(request.url)
  const cwd = resolveCwd(ctx, url.searchParams.get('cwd') || '')
  const path = safeRepoPath(url.searchParams.get('path'))
  const staged = url.searchParams.get('staged') === '1'

  const argv = ['diff', '--no-color', '--no-ext-diff', '--no-textconv']
  if (staged) argv.push('--cached')
  argv.push('--', path)

  const text = await git(ctx, argv, cwd, { maxBytes: MAX_DIFF_BYTES, signal: request.signal })
  return json({ ok: true, path, staged, text })
}

// ── plugin body ────────────────────────────────────────────────────────────

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
