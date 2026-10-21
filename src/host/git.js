/**
 * Git process runner for the host half.
 *
 * Every git invocation in this plugin goes through here, so the child-process
 * shape and the scrubbed environment are defined in exactly one place. The
 * functions take the subprocess service directly (not the Cordis context) so a
 * plain Node test can drive them with a fake process table.
 */

import { GitError } from './errors.js'

/** Output caps per command family. */
export const MAX_STATUS_BYTES = 4 * 1024 * 1024
export const MAX_DIFF_BYTES = 2 * 1024 * 1024
export const MAX_REFS_BYTES = 2 * 1024 * 1024
export const GIT_TIMEOUT_MS = 10_000

/** Environment every git child starts from (merged over the subprocess scrub). */
export const GIT_ENV = Object.freeze({
  GIT_TERMINAL_PROMPT: '0',
  GIT_OPTIONAL_LOCKS: '0',
  GIT_CONFIG_COUNT: '0',
  GIT_PAGER: 'cat',
  LC_ALL: 'C',
})

/**
 * Resolve the subprocess service, refusing to run without it.
 * A missing capability is a deployment problem, not a request problem.
 */
export function subprocessOf(ctx) {
  const subprocess = ctx.get('subprocess')
  if (
    !subprocess ||
    typeof subprocess.resolveExecutable !== 'function' ||
    typeof subprocess.spawn !== 'function'
  ) {
    throw new GitError('subprocess 服务不可用：该插件需要 subprocess 能力', 'subprocess-unavailable')
  }
  return subprocess
}

/**
 * Run one git command through the subprocess capability.
 * @returns {Promise<{ code: number, out: string, err: string }>}
 */
export async function execGit(subprocess, argv, cwd, options = {}) {
  return runProcess(subprocess, 'git', argv, cwd, {
    ...options,
    env: GIT_ENV,
    missingMessage: '未找到 git 可执行文件（macOS 上仅安装 Command Line Tools 存根时也会出现）',
    missingCode: 'git-not-found',
    spawnMessage: '无法启动 git：',
    spawnCode: 'git-spawn-failed',
  })
}

/**
 * Run one fixed-argv child process through the subprocess capability.
 *
 * The same shape as a git call — no shell, scrubbed environment, bounded
 * output, bounded run time — but the executable is named by the caller so the
 * local `open` actions do not need a second spawn implementation.
 *
 * @returns {Promise<{ code: number, out: string, err: string }>}
 */
export async function runProcess(subprocess, command, argv, cwd, options = {}) {
  if (
    !subprocess ||
    typeof subprocess.resolveExecutable !== 'function' ||
    typeof subprocess.spawn !== 'function'
  ) {
    throw new GitError('subprocess 服务不可用：该插件需要 subprocess 能力', 'subprocess-unavailable')
  }
  const label = options.label ?? command
  const maxBytes = options.maxBytes ?? MAX_STATUS_BYTES
  let exe
  try {
    exe = await subprocess.resolveExecutable(command)
  } catch {
    throw new GitError(
      options.missingMessage ?? '未找到 ' + label + ' 可执行文件',
      options.missingCode ?? command + '-not-found',
    )
  }
  let handle
  try {
    handle = subprocess.spawn({
      argv: [exe, ...argv],
      cwd,
      env: { ...(options.env ?? {}) },
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes },
        stderr: { maxBytes: 256 * 1024 },
      },
      graceMs: options.timeoutMs ?? GIT_TIMEOUT_MS,
      ...(options.signal ? { signal: options.signal } : {}),
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new GitError(
      (options.spawnMessage ?? '无法启动 ' + label + '：') + detail,
      options.spawnCode ?? command + '-spawn-failed',
    )
  }
  const outcome = await handle.done
  const stdout = handle.collected?.stdout?.readFrom(0)
  const stderr = handle.collected?.stderr?.readFrom(0)
  if (stdout?.lossy) throw new GitError('输出超出上限，请缩小查询范围', 'output-too-large')
  return { code: outcome.exitCode, out: stdout?.text ?? '', err: (stderr?.text ?? '').trim() }
}

/** Run git and throw on a non-zero exit, carrying git's own message. */
export async function git(subprocess, argv, cwd, options) {
  const result = await execGit(subprocess, argv, cwd, options)
  if (result.code !== 0) throw new GitError(result.err || 'git 退出码 ' + String(result.code), 'git-failed')
  return result.out
}
