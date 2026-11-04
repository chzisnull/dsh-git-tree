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

import { createHash, randomUUID } from 'node:crypto'
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

const MARKER_START = /^(<+)(?:\s|$)/
const MARKER_BASE = /^(\|+)(?:\s|$)/
const MARKER_SEP = /^(=+)(?:\s|$)/
const MARKER_END = /^(>+)(?:\s|$)/

// Short configured markers overlap ordinary source text, so require a complete
// same-width block; conventional markers still block incomplete resolutions.
function conflictStarts(lines) {
  const starts = new Set()
  const endings = new Set()
  const separators = new Set()
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]
    const end = MARKER_END.exec(line)
    if (end) endings.add(end[1].length)
    const separator = MARKER_SEP.exec(line)
    if (separator && endings.has(separator[1].length)) separators.add(separator[1].length)
    const start = MARKER_START.exec(line)
    if (start) {
      const size = start[1].length
      if (size >= 7 || separators.has(size)) starts.add(index)
      endings.delete(size)
      separators.delete(size)
    }
  }
  return starts
}

/** True when a text carries conflict markers, including configured short ones. */
export function hasConflictMarkers(text) {
  return countConflictBlocks(text) > 0
}

/** How many conflict blocks a text still carries. */
export function countConflictBlocks(text) {
  return conflictStarts(String(text).split('\n')).size
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
  let markerSize = 0
  let oursLabel = ''
  let theirsLabel = ''
  let blocks = 0
  let ours = 0
  let theirs = 0
  let base = 0

  const rawLines = String(text).split('\n')
  const starts = conflictStarts(rawLines)
  for (let index = 0; index < rawLines.length; index += 1) {
    const line = rawLines[index].replace(/\r$/, '')
    if (starts.has(index)) {
      section = 'ours'
      markerSize = MARKER_START.exec(line)[1].length
      blocks += 1
      if (!oursLabel) oursLabel = line.slice(markerSize).trim()
      lines.push({ kind: 'marker-start', text: line })
      continue
    }
    if (MARKER_BASE.exec(line)?.[1].length === markerSize && section !== null) {
      section = 'base'
      lines.push({ kind: 'marker-base', text: line })
      continue
    }
    if (MARKER_SEP.exec(line)?.[1].length === markerSize && section !== null) {
      section = 'theirs'
      lines.push({ kind: 'marker-sep', text: line })
      continue
    }
    if (MARKER_END.exec(line)?.[1].length === markerSize && section !== null) {
      section = null
      if (!theirsLabel) theirsLabel = line.slice(markerSize).trim()
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
  const bytes = readFileSync(file.absolute)
  const sourceHash = createHash('sha256')
    .update(realpathOr(cwd)).update('\0').update(repoPath).update('\0').update(bytes).digest('hex')
  return { ...file, text: bytes.toString('utf8'), sourceHash }
}

/** Refuse an outdated preview before writing, including one from another repo. */
export function requireConflictSource(cwd, repoPath, sourceHash) {
  if (readConflictFile(cwd, repoPath).sourceHash !== sourceHash) {
    throw new RequestError('文件已变化，请重新生成解决预览', 409, 'stale-source')
  }
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
  const out = await git(subprocess, ['--literal-pathspecs', 'ls-files', '-u', '-z', '--', repoPath], cwd, { maxBytes: 64 * 1024 })
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
  await git(subprocess, ['--literal-pathspecs', 'checkout', '--merge', '--', repoPath], cwd, { maxBytes: 256 * 1024 })
}

/** Stage a resolved file, which removes its unmerged stages. */
export async function stageResolved(subprocess, cwd, repoPath) {
  await git(subprocess, ['--literal-pathspecs', 'add', '--', repoPath], cwd, { maxBytes: 256 * 1024 })
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
