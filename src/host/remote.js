/**
 * Remote helpers shared by push, fetch and pull.
 *
 * The three routes answer the same questions — which remote, which branch, and
 * what a git failure means — so those decisions live here as pure functions.
 * No git and no context here: the handlers own the subprocess calls.
 */

/** Split `<remote>/<branch>`; a branch name may itself contain slashes. */
export function splitUpstream(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  const separator = text.indexOf('/')
  if (separator <= 0 || separator === text.length - 1) return null
  return { remote: text.slice(0, separator), branch: text.slice(separator + 1) }
}

/**
 * Where a pull would come from.
 *
 * With an upstream the answer is that remote and branch. Without one it is
 * origin and the same-named branch, but only when origin actually has it —
 * never a guess, and never another remote.
 *
 * @returns `{ ok: true, remote, remoteBranch }` or `{ ok: false, code, reason }`
 */
export function resolvePullTarget({ upstream, current, remotes, originBranch }) {
  if (!Array.isArray(remotes) || remotes.length === 0) {
    return { ok: false, code: 'no-remote', reason: '当前仓库没有配置远端' }
  }
  const parsed = splitUpstream(upstream)
  if (parsed) {
    if (!remotes.includes(parsed.remote)) {
      return { ok: false, code: 'no-remote', reason: '上游远端 ' + parsed.remote + ' 不在远端列表里' }
    }
    return { ok: true, remote: parsed.remote, remoteBranch: parsed.branch, viaUpstream: true }
  }
  if (!remotes.includes('origin')) {
    return { ok: false, code: 'no-remote', reason: '当前分支没有 upstream，且仓库没有 origin 远端' }
  }
  if (originBranch !== true) {
    return {
      ok: false,
      code: 'no-upstream',
      reason: '当前分支没有 upstream，origin 上也没有同名分支',
    }
  }
  return { ok: true, remote: 'origin', remoteBranch: current, viaUpstream: false }
}

/**
 * Translate a failed fetch/pull into a domain error, or null when the failure
 * is not one we know how to explain.
 *
 * @param {'fetch'|'ff-only'|'merge'} stage
 */
export function mapRemoteFailure(stage, detail) {
  const text = typeof detail === 'string' ? detail : ''
  if (/Authentication failed|could not read Username|terminal prompts disabled|Permission denied|HTTP 40[13]|SSL_connect|SSL_ERROR/i.test(text)) {
    return { code: 'auth-failed', reason: '需要认证：请先在终端登录一次，再回来重试' }
  }
  if (/Could not resolve host|unable to access|Connection refused|Network is unreachable|Operation timed out/i.test(text)) {
    return { code: 'network-failed', reason: '连不上远端，检查网络后重试' }
  }
  if (stage !== 'fetch' && /Not possible to fast-forward|not possible to fast-forward|diverged/i.test(text)) {
    return { code: 'diverged', reason: '本地和远端各有提交，快进不可能；可以用合并方式拉取' }
  }
  if (stage !== 'fetch' && /CONFLICT|Automatic merge failed|fix conflicts/i.test(text)) {
    return { code: 'merge-conflict', reason: '拉取产生冲突，冲突文件已列在改动里' }
  }
  if (stage !== 'fetch' && /commit your changes or stash|would be overwritten|local changes/i.test(text)) {
    return { code: 'dirty-worktree', reason: '本地改动会被这次拉取覆盖，先提交或贮藏再拉取' }
  }
  return null
}

/** Configured names may contain slashes, so use the longest matching prefix. */
export function remoteForRef(name, remotes) {
  return remotes.filter((remote) => name.startsWith(remote + '/'))
    .sort((left, right) => right.length - left.length)[0] ?? null
}

function refspecMatch(pattern, ref) {
  const parts = pattern.split('*')
  if (parts.length === 1) return pattern === ref ? '' : null
  if (parts.length !== 2 || !ref.startsWith(parts[0]) || !ref.endsWith(parts[1]) || ref.length < parts[0].length + parts[1].length) return null
  return ref.slice(parts[0].length, parts[1] ? -parts[1].length : undefined)
}

/** Reverse only an unambiguous fetch mapping to a server branch. */
export function remoteDeleteRef(trackingRef, refspecs) {
  const candidates = new Set()
  const excluded = []
  for (const raw of refspecs) {
    if (raw.startsWith('^')) {
      excluded.push(raw.slice(1))
      continue
    }
    const parts = raw.replace(/^\+/, '').split(':')
    if (parts.length !== 2) continue
    const [source, destination] = parts
    const match = refspecMatch(destination, trackingRef)
    if (match === null) continue
    if ((source.match(/\*/g) || []).length !== (destination.match(/\*/g) || []).length) {
      return { ok: false, code: 'remote-mapping-unsupported', reason: '远端 fetch 映射无法唯一对应服务器分支' }
    }
    candidates.add(source.replace('*', match))
  }
  const [ref] = candidates
  if (candidates.size !== 1 || !ref.startsWith('refs/heads/') || excluded.some((pattern) => refspecMatch(pattern, ref) !== null)) {
    return { ok: false, code: 'remote-mapping-unsupported', reason: '远端 fetch 映射无法唯一对应服务器分支' }
  }
  return { ok: true, ref }
}

/** Explain a server-side delete refusal without weakening its protection. */
export function mapRemoteDeleteFailure(detail) {
  const common = mapRemoteFailure('fetch', detail)
  if (common) return common
  if (/stale info|fetch first|cannot lock ref.*expected|is at .*expected/i.test(detail)) {
    return { code: 'remote-stale', reason: '远程分支已变化，请获取最新引用后重新确认删除' }
  }
  if (/remote ref does not exist|unable to delete.*not found/i.test(detail)) {
    return { code: 'remote-branch-missing', reason: '远程服务器上已没有这个分支' }
  }
  if (/protected branch|hook declined|deletion.*(?:prohibited|denied)|deny deleting|remote rejected/i.test(detail)) {
    return { code: 'remote-delete-protected', reason: '服务器拒绝删除这个分支，请检查分支保护或服务器钩子' }
  }
  if (/repository.*not found|does not appear to be a git repository/i.test(detail)) {
    return { code: 'remote-not-found', reason: '找不到远程仓库，请检查远端地址与访问权限' }
  }
  return null
}

/** How many commits one branch is ahead/behind another, parsed from rev-list. */
export function parseAheadBehind(text) {
  const [ahead, behind] = String(text)
    .trim()
    .split(/\s+/)
    .map((value) => Number(value) || 0)
  return { ahead: ahead ?? 0, behind: behind ?? 0 }
}
