// Shared client types. The Harness type packages are not imported; the client
// only needs the small surface it actually calls.

export type AnyProps = Record<string, any>

export interface ClientCtx {
  effect(effect: () => void | (() => void), label?: string): void
  locale: {
    register(ns: string, dicts: Record<string, Record<string, string>>): () => void
    bind(ns: string): Translate
  }
  slots: {
    inject(ownerKey: string, callback: () => unknown): void
    register(options: Record<string, unknown>, component: any): unknown
  }
  /** Optional service lookup (Cordis): returns null/undefined when absent. */
  get?(name: string): any
  /** Child fiber that starts once every named service is provided. */
  inject?(deps: string[], callback: (ctx: ClientCtx) => void): unknown
}

export interface HistoryRef {
  name: string
  kind: 'branch' | 'tag'
}

export interface HistoryCommit {
  sha: string
  parents: string[]
  lane: number
  parentLanes: number[]
  author: string
  authorEmail: string
  date: string
  subject: string
  refs: HistoryRef[]
}

export interface HistoryPayload {
  ok: boolean
  commits?: HistoryCommit[]
  laneCount?: number
  hasMore?: boolean
  scope?: string
  error?: string
  code?: string
}

/** `all`, `current`, `branch:<name>` or `tag:<name>`. */
export type HistoryScope = string

export interface CommitFile {
  path: string
  origPath?: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | string
}

export interface CommitDetailPayload {
  ok: boolean
  sha?: string
  author?: string
  authorEmail?: string
  date?: string
  subject?: string
  body?: string
  parents?: string[]
  refs?: HistoryRef[]
  files?: CommitFile[]
  error?: string
  code?: string
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
  /** Host platform (`process.platform`); the local open actions need darwin. */
  platform?: string
  branch?: string
  oid?: string
  upstream?: string
  ahead?: number
  behind?: number
  identity?: GitIdentity | null
  remotes?: string[]
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

/** One line of a conflicted working-tree file. */
export interface ConflictLine {
  kind: 'context' | 'ours' | 'theirs' | 'base' | 'marker-start' | 'marker-base' | 'marker-sep' | 'marker-end'
  text: string
}

export interface ConflictPayload {
  lines: ConflictLine[]
  blocks: number
  ours: number
  theirs: number
  base: number
  labels: { ours: string; theirs: string }
}

export interface DiffPayload {
  ok: boolean
  path?: string
  side?: EntrySide
  staged?: boolean
  binary?: boolean
  conflicted?: boolean
  conflict?: ConflictPayload
  stats?: { additions: number; deletions: number }
  files?: DiffFile[]
  text?: string
  error?: string
  code?: string
}

/** One model answer for a conflicted file, with the preview diff. */
export interface ConflictResolvePayload {
  ok: boolean
  path?: string
  content?: string
  provider?: string
  model?: string
  diff?: { files?: DiffFile[]; stats?: { additions: number; deletions: number }; text?: string }
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
  /** Pinned by the user; pinned rows render above the usage-sorted list. */
  pinned?: boolean
  /** How many times the user switched to this repository from the panel. */
  openCount?: number
  lastOpenedAt?: number
}

export interface WorkspacesPayload {
  ok: boolean
  current?: string
  workspaces?: WorkspaceRecord[]
  error?: string
  code?: string
}

export type OpenTarget = 'finder' | 'terminal'

export interface OpenPayload {
  ok: boolean
  target?: OpenTarget
  cwd?: string
  error?: string
  code?: string
}

export interface MutationPayload {
  ok: boolean
  error?: string
  code?: string
  remote?: string
  mode?: string
  pulled?: number
  viaUpstream?: boolean
  sha?: string
  shortSha?: string
  subject?: string
  staged?: string[]
  unstaged?: string[]
  branch?: string
  upstream?: string
}

/** One model route in the commit-message picker. */
export interface AiModelRoute {
  provider: string
  model: string
  label: string
}

/** One provider group of the DSH model catalog. */
export interface AiModelGroup {
  id: string
  name: string
  models: { provider: string; id: string; name: string; description?: string }[]
}

export interface AiModelFailure {
  id: string
  name: string
  message: string
}

export interface AiModelsPayload {
  ok: boolean
  groups?: AiModelGroup[]
  failures?: AiModelFailure[]
  default?: { provider: string; model: string } | null
  selected?: { provider: string; model: string } | null
  active?: AiModelRoute | null
  error?: string
  code?: string
}

export interface AiMessagePayload {
  ok: boolean
  message?: string
  provider?: string
  model?: string
  error?: string
  code?: string
}

/** Everything the commit card needs for its two AI controls. */
export interface AiCommitControls {
  loading: boolean
  busy: boolean
  groups: AiModelGroup[]
  failures: AiModelFailure[]
  active: AiModelRoute | null
  /** Why the catalog is empty, when the host reported a failure. */
  error?: string
  onGenerate: () => void
  onSelect: (provider: string, model: string) => void
}

export type Translate = (key: string) => string
