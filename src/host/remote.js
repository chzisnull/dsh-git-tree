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

/** How many commits one branch is ahead/behind another, parsed from rev-list. */
export function parseAheadBehind(text) {
  const [ahead, behind] = String(text)
    .trim()
    .split(/\s+/)
    .map((value) => Number(value) || 0)
  return { ahead: ahead ?? 0, behind: behind ?? 0 }
}
