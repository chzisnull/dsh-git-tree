/**
 * Path and workspace guards for the host half.
 *
 * A request may name a repository-relative path and (optionally) a cwd. Both
 * are confined before they can reach argv: the cwd must stay inside the
 * workspace DSH registered for this session, and a path must be a plain
 * relative path with no traversal, no leading dash and no NUL.
 */

import { isAbsolute, relative, resolve as resolvePath } from 'node:path'
import { RequestError } from './errors.js'

/** Workspace root from the host services, with the same fallback ladder workbench uses. */
export function workspaceRootOf(ctx) {
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
export function resolveCwd(ctx, requested) {
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
  if (rel !== '' && (rel.startsWith('..') || isAbsolute(rel))) {
    throw new RequestError('cwd 位于工作区之外', 403, 'outside-workspace')
  }
  return absolute
}

/**
 * Validate a repository-relative path before it reaches argv.
 * Rejects NUL, absolute paths, `..` segments, option-looking paths and empty input.
 */
export function safeRepoPath(value) {
  if (typeof value !== 'string' || value.length === 0) throw new RequestError('缺少 path 参数')
  if (value.length > 4096) throw new RequestError('path 参数过长')
  if (value.includes('\0')) throw new RequestError('path 不能包含 NUL')
  if (isAbsolute(value) || value.startsWith('~')) throw new RequestError('path 必须是仓库内相对路径')
  if (value.startsWith('-')) throw new RequestError('path 不能以 - 开头')
  const segments = value.split(/[\\/]+/)
  if (segments.some((segment) => segment === '..')) throw new RequestError('path 不能包含 ..')
  return segments.filter(Boolean).join('/')
}
