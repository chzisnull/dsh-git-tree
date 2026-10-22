/**
 * Merge-conflict support for the host half.
 *
 * A path with unmerged index entries has no ordinary unified diff: `git diff`
 * prints a *combined* diff (`diff --cc`, `@@@` double-prefix hunks) that the
 * panel's line renderer does not speak. What the user actually needs to see —
 * and what an AI resolution rewrites — is the working-tree file with its
 * `<<<<<<<` / `=======` / `>>>>>>>` markers, so this module parses that file
 * into renderable lines and owns the guards for reading and rewriting it.
 */

import { randomUUID } from 'node:crypto'
import { chmodSync, lstatSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve as resolvePath } from 'node:path'
import { execGit, git } from './git.js'
import { RequestError } from './errors.js'

/** Largest conflicted file the panel will read, show or send to a model. */
export const MAX_CONFLICT_BYTES = 512 * 1024
/** Prompt budget: a file past this is refused instead of truncated. */
export const MAX_CONFLICT_PROMPT_BYTES = 60 * 1024
/** Largest resolved file a model may hand back. */
export const MAX_RESOLVED_BYTES = 512 * 1024

const MARKER_START = /^<{7}(?:\s|$)/
const MARKER_BASE = /^\|{7}(?:\s|$)/
const MARKER_SEP = /^={7}(?:\s|$)/
const MARKER_END = /^>{7}(?:\s|$)/

/** True when a text carries at least one conflict block opener. */
export function hasConflictMarkers(text) {
  for (const line of String(text).split('\n')) if (MARKER_START.test(line)) return true
  return false
}

/** How many conflict blocks a text still carries. */
export function countConflictBlocks(text) {
  let count = 0
  for (const line of String(text).split('\n')) if (MARKER_START.test(line)) count += 1
  return count
}

/**
 * Split one conflicted file into renderable lines.
 *
 * Each line is `{ kind, text }` where kind is `ours`, `theirs`, `base`,
 * `context`, or one of `marker-start` / `marker-base` / `marker-sep` /
 * `marker-end`. Labels come from the marker lines themselves (`<<<<<<< HEAD`).
 */
export function parseConflictText(text) {
  const lines = []
  let section = null
  let oursLabel = ''
  let theirsLabel = ''
  let blocks = 0
  let ours = 0
  let theirs = 0
  let base = 0

  for (const raw of String(text).split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (MARKER_START.test(line)) {
      section = 'ours'
      blocks += 1
      if (!oursLabel) oursLabel = line.replace(/^<{7}\s?/, '').trim()
      lines.push({ kind: 'marker-start', text: line })
      continue
    }
    if (MARKER_BASE.test(line) && section !== null) {
      section = 'base'
      lines.push({ kind: 'marker-base', text: line })
      continue
    }
    if (MARKER_SEP.test(line) && section !== null) {
      section = 'theirs'
      lines.push({ kind: 'marker-sep', text: line })
      continue
    }
    if (MARKER_END.test(line) && section !== null) {
      section = null
      if (!theirsLabel) theirsLabel = line.replace(/^>{7}\s?/, '').trim()
      lines.push({ kind: 'marker-end', text: line })
      continue
    }
    if (section === 'ours') ours += 1
    else if (section === 'theirs') theirs += 1
    else if (section === 'base') base += 1
    lines.push({ kind: section ?? 'context', text: line })
  }

  // A trailing newline produces one empty pseudo-line; drop it so the pane does
  // not show a phantom row after every file.
  if (lines.length > 0 && lines[lines.length - 1].text === '') lines.pop()

  return { lines, blocks, ours, theirs, base, labels: { ours: oursLabel, theirs: theirsLabel } }
}

/**
 * Check what a model (or a caller) wants to write back as the resolved file.
 * @returns `{ ok: true, text }` or `{ ok: false, code, reason }`
 */
export function validateResolvedText(value) {
  if (typeof value !== 'string') return { ok: false, code: 'invalid-content', reason: '内容必须是字符串' }
  const text = value.replace(/\r\n?/g, '\n')
  if (text.trim() === '') return { ok: false, code: 'empty-content', reason: '解决结果为空' }
  if (hasConflictMarkers(text)) {
    return { ok: false, code: 'markers-present', reason: '结果里仍然有冲突标记' }
  }
  if (Buffer.byteLength(text, 'utf8') > MAX_RESOLVED_BYTES) {
    return { ok: false, code: 'too-large', reason: '解决结果超过 ' + String(MAX_RESOLVED_BYTES / 1024) + ' KB' }
  }
  return { ok: true, text }
}

function realpathOr(value) {
  try {
    return realpathSync.native(value)
  } catch {
    return value
  }
}

/**
 * Resolve one repository-relative path to a real regular file inside the repo.
 * Symlinks and directories are refused: the routes below write what they read.
 */
export function repoFile(cwd, repoPath) {
  const root = realpathOr(cwd)
  const candidate = resolvePath(root, repoPath)
  let stat
  try {
    stat = lstatSync(candidate)
  } catch {
    throw new RequestError('文件不存在', 404, 'missing-file')
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new RequestError('只支持仓库里的普通文件', 400, 'not-a-file')
  }
  const real = realpathOr(candidate)
  const rel = relative(root, real)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new RequestError('路径越出仓库', 403, 'outside-workspace')
  }
  return { absolute: candidate, real, mode: stat.mode }
}

/** Read a conflicted file, refusing anything past the display budget. */
export function readConflictFile(cwd, repoPath) {
  const file = repoFile(cwd, repoPath)
  const stat = statSync(file.absolute)
  if (stat.size > MAX_CONFLICT_BYTES) {
    throw new RequestError('文件超过 ' + String(MAX_CONFLICT_BYTES / 1024) + ' KB，无法在面板里显示', 409, 'file-too-large')
  }
  return { ...file, text: readFileSync(file.absolute, 'utf8') }
}

/** Replace a file's contents atomically, keeping its mode. */
export function writeRepoFile(cwd, repoPath, content) {
  const file = repoFile(cwd, repoPath)
  const temp = join(dirname(file.absolute), '.' + basename(file.absolute) + '.dgt-' + randomUUID().slice(0, 8))
  try {
    writeFileSync(temp, content, 'utf8')
    chmodSync(temp, file.mode & 0o777)
    renameSync(temp, file.absolute)
  } catch (error) {
    try {
      unlinkSync(temp)
    } catch {
      /* the temp file was never written */
    }
    throw error
  }
  return file.absolute
}

/** True when the index still holds unmerged stages for this path. */
export async function isUnmerged(subprocess, cwd, repoPath) {
  const out = await git(subprocess, ['ls-files', '-u', '-z', '--', repoPath], cwd, { maxBytes: 64 * 1024 })
  return out.length > 0
}

/** Refuse a path that is not currently in conflict. */
export async function requireUnmerged(subprocess, cwd, repoPath) {
  if (!(await isUnmerged(subprocess, cwd, repoPath))) {
    throw new RequestError('该文件当前不在冲突状态', 409, 'not-conflicted')
  }
}

/** Restore the conflicted working-tree copy from the index stages. */
export async function revertConflict(subprocess, cwd, repoPath) {
  await git(subprocess, ['checkout', '--merge', '--', repoPath], cwd, { maxBytes: 256 * 1024 })
}

/** Stage a resolved file, which removes its unmerged stages. */
export async function stageResolved(subprocess, cwd, repoPath) {
  await git(subprocess, ['add', '--', repoPath], cwd, { maxBytes: 256 * 1024 })
}

/**
 * Unified diff between the current conflicted file and a proposed resolution,
 * so the preview dialog can show what would change. `git diff --no-index`
 * exits 1 when the files differ, which is the normal case here.
 */
export async function diffAgainstProposal(subprocess, cwd, repoPath, proposal) {
  const file = repoFile(cwd, repoPath)
  const temp = join(dirname(file.absolute), '.' + basename(file.absolute) + '.dgt-proposal-' + randomUUID().slice(0, 8))
  try {
    writeFileSync(temp, proposal, 'utf8')
    const result = await execGit(
      subprocess,
      ['diff', '--no-index', '--no-color', '--no-ext-diff', '--unified=3', '--', file.absolute, temp],
      cwd,
      { maxBytes: 2 * 1024 * 1024 },
    )
    // `--no-index` prints the temp file's absolute path; show the repository
    // path instead so the preview header reads like every other diff.
    // `--no-index` prefixes the absolute path directly: `a/Library/...`.
    return result.out
      .split('a' + file.absolute)
      .join('a/' + repoPath)
      .split('b' + temp)
      .join('b/' + repoPath)
      .split(file.absolute)
      .join(repoPath)
      .split(temp)
      .join(repoPath)
  } finally {
    try {
      unlinkSync(temp)
    } catch {
      /* already gone */
    }
  }
}
