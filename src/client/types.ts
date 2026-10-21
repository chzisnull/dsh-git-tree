// Shared client types. The Harness type packages are not imported; the client
// only needs the small surface it actually calls.

export type AnyProps = Record<string, any>

export interface ClientCtx {
  effect(effect: () => void | (() => void), label?: string): void
  locale: {
    register(ns: string, dicts: Record<string, Record<string, string>>): () => void
    bind(ns: string): (key: string, params?: Record<string, unknown>) => string
  }
  slots: {
    inject(ownerKey: string, callback: () => unknown): void
    register(options: Record<string, unknown>, component: any): unknown
  }
}

/** The workspace view currently shown in the main column. */
export type ViewKind = 'status' | 'history' | 'search'

/** The side of the working copy an entry row belongs to. */
export type EntrySide = 'staged' | 'unstaged' | 'conflicted'

export interface GitFileEntry {
  path: string
  origPath?: string
  x: string
  y: string
  kind: 'changed' | 'untracked' | 'renamed' | 'copied' | 'conflicted' | 'ignored' | string
  staged: boolean
  unstaged: boolean
  conflicted: boolean
}

export interface GitIdentity {
  name: string
  email: string
}

export interface GitCounts {
  staged: number
  unstaged: number
  conflicted: number
}

export interface GitStatusPayload {
  ok: boolean
  cwd?: string
  repoRoot?: string
  branch?: string
  oid?: string
  upstream?: string
  ahead?: number
  behind?: number
  identity?: GitIdentity | null
  entries?: GitFileEntry[]
  counts?: GitCounts
  truncated?: boolean
  error?: string
  code?: string
}

export type DiffLineKind = 'context' | 'add' | 'del' | 'meta'

export interface DiffLine {
  kind: DiffLineKind
  oldNo: number | null
  newNo: number | null
  text: string
}

export interface DiffHunk {
  header: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  heading: string
  lines: DiffLine[]
}

export interface DiffFile {
  oldPath: string | null
  newPath: string | null
  status: string
  binary: boolean
  hunks: DiffHunk[]
}

export interface DiffPayload {
  ok: boolean
  path?: string
  side?: EntrySide
  staged?: boolean
  binary?: boolean
  stats?: { additions: number; deletions: number }
  files?: DiffFile[]
  text?: string
  error?: string
  code?: string
}

export interface RefRecord {
  name: string
  oid: string
  upstream: string
  committedAt: number
  subject: string
  current: boolean
}

export interface RefsPayload {
  ok: boolean
  branches?: RefRecord[]
  remotes?: RefRecord[]
  tags?: RefRecord[]
  error?: string
  code?: string
}

export interface WorkspaceRecord {
  id: string
  path: string
  title: string
}

export interface WorkspacesPayload {
  ok: boolean
  current?: string
  workspaces?: WorkspaceRecord[]
  error?: string
  code?: string
}

export interface MutationPayload {
  ok: boolean
  error?: string
  code?: string
  sha?: string
  shortSha?: string
  subject?: string
  staged?: string[]
  unstaged?: string[]
}

export type Translate = (key: string) => string
