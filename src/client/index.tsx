// dsh-git-tree — client half (browser artifact source).
//
// This file is bundled by `build.mjs` (esbuild, CJS) and wrapped in the DSH
// module-loader factory. Inside the wrapper, `require` is the browser module
// table of the running Harness; `react` is one of its frozen entries, so no
// React installation or import is needed (and none is allowed).
//
// The panel occupies the layout's root-scoped `main` keyed slot under the key
// `git-tree`; the sidebar icon registered into `sidebar.panellist` with the
// same id is the launcher (`ctx.layout.selectPanel` runs inside the window
// chrome when that row is clicked). Both slot ids and that pairing are
// documented in the shipped layout/sidebar READMEs and verified against
// `dsh-client-ui-layout/lib/client.js` and `dsh-client-ui-sidebar/lib/client.js`.
//
// Visible copy goes through the Client locale service (`ctx.locale`), and every
// color comes from a `--dsw-*` theme token so the panel inherits light/dark.

declare const require: (specifier: string) => any

type AnyProps = Record<string, any>

const React: AnyProps = require('react')
const h = React.createElement

// ── contract constants ──────────────────────────────────────────────────────

/** Locale namespace owning this plugin's client copy and sidebar label. */
const NS = 'dsh-git-tree'
/** Panel id: the `main` key and the `sidebar.panellist` entry id must match. */
const PANEL_ID = 'git-tree'
/** Authenticated exact Fetch routes served by the host half (document-relative). */
const STATUS_ROUTE = 'api/git-tree/status'
const DIFF_ROUTE = 'api/git-tree/diff'

// ── minimal client typings (no Harness type packages are imported) ──────────

interface ClientCtx {
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

interface GitFileEntry {
  path: string
  x: string
  y: string
  kind: 'changed' | 'untracked' | 'renamed' | 'ignored' | string
}

interface GitStatusPayload {
  ok: boolean
  cwd?: string
  repoRoot?: string
  branch?: string
  upstream?: string
  ahead?: number
  behind?: number
  entries?: GitFileEntry[]
  truncated?: boolean
  error?: string
  code?: string
}

interface DiffPayload {
  ok: boolean
  path?: string
  staged?: boolean
  text?: string
  error?: string
  code?: string
}

// ── host calls (same-origin authenticated Fetch routes) ─────────────────────

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, value)
  const text = search.toString()
  return text === '' ? '' : '?' + text
}

async function getJson<T>(route: string, params: Record<string, string | undefined>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(route + query(params), {
    signal,
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error('HTTP ' + String(response.status))
  return (await response.json()) as T
}

// ── small UI atoms ─────────────────────────────────────────────────────────

function Chip(props: { tone?: 'ok' | 'warn' | 'muted'; children?: any }): any {
  return h('span', { className: 'dgt-chip', 'data-tone': props.tone ?? 'muted' }, props.children)
}

function Spinner(): any {
  return h('span', { className: 'dgt-spinner', 'aria-hidden': 'true' })
}

/** One row of the working-tree list. */
function FileRow(props: { entry: GitFileEntry; active: boolean; onSelect: (entry: GitFileEntry) => void }): any {
  const entry = props.entry
  const code = (entry.x + entry.y).trim() || '??'
  return h(
    'button',
    {
      type: 'button',
      className: 'dgt-file',
      'data-active': props.active || undefined,
      'data-kind': entry.kind,
      title: entry.path,
      onClick: () => props.onSelect(entry),
    },
    h('span', { className: 'dgt-file-code', 'data-status': entry.x === '?' ? '?' : entry.x === 'A' ? 'A' : entry.y === 'M' || entry.x === 'M' ? 'M' : 'D' }, code),
    h('span', { className: 'dgt-file-path' }, entry.path),
  )
}

// ── main panel ─────────────────────────────────────────────────────────────

function GitTreePanel(props: AnyProps): any {
  const t: (key: string) => string = typeof props.t === 'function' ? props.t : (key: string) => key

  const [status, setStatus] = React.useState<GitStatusPayload | null>(null)
  const [statusError, setStatusError] = React.useState('')
  const [refreshing, setRefreshing] = React.useState(false)
  const [selected, setSelected] = React.useState<GitFileEntry | null>(null)
  const [diff, setDiff] = React.useState<DiffPayload | null>(null)
  const [diffLoading, setDiffLoading] = React.useState(false)

  const loadStatus = React.useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true)
    try {
      const next = await getJson<GitStatusPayload>(STATUS_ROUTE, {}, signal)
      if (signal?.aborted) return
      if (next.ok) {
        setStatus(next)
        setStatusError('')
      } else {
        setStatus(null)
        setStatusError(next.error || t('statusFailed'))
      }
    } catch (error) {
      if (signal?.aborted) return
      // A missing host route means the host half is not active (or not built):
      // render the shell instead of crashing the slot entry.
      setStatus(null)
      setStatusError(error instanceof Error ? error.message : String(error))
    } finally {
      if (!signal?.aborted) setRefreshing(false)
    }
  }, [t])

  React.useEffect(() => {
    const controller = new AbortController()
    void loadStatus(controller.signal)
    return () => controller.abort()
  }, [loadStatus])

  const openDiff = React.useCallback(async (entry: GitFileEntry, signal?: AbortSignal) => {
    setSelected(entry)
    setDiff(null)
    if (entry.kind === 'ignored') return
    setDiffLoading(true)
    try {
      // A fully staged entry is previewed from the index (`git diff --cached`);
      // everything else is previewed against the index (plain `git diff`).
      const next = await getJson<DiffPayload>(DIFF_ROUTE, { path: entry.path, staged: isStaged(entry) ? '1' : '0' }, signal)
      if (!signal?.aborted) setDiff(next)
    } catch (error) {
      if (!signal?.aborted) setDiff({ ok: false, error: error instanceof Error ? error.message : String(error) })
    } finally {
      if (!signal?.aborted) setDiffLoading(false)
    }
  }, [])

  const entries = status?.entries ?? []
  const staged = entries.filter(isStaged)
  const working = entries.filter((entry) => !isStaged(entry))

  const branchLabel = status?.branch && status.branch !== '(detached)' ? status.branch : status?.branch || '—'

  return h(
    'div',
    { className: 'dgt-root', 'data-plugin': 'dsh-git-tree' },

    // top bar: repo identity, branch, ahead/behind, actions
    h(
      'header',
      { className: 'dgt-topbar' },
      h(
        'div',
        { className: 'dgt-repo' },
        h('span', { className: 'dgt-repo-name' }, status?.repoRoot ? lastSegment(status.repoRoot) : t('panel')),
        h('span', { className: 'dgt-repo-path', title: status?.cwd || status?.repoRoot || '' }, status?.repoRoot || status?.cwd || '—'),
      ),
      h(
        'div',
        { className: 'dgt-refs' },
        h(Chip, { tone: 'muted' }, h('span', { className: 'dgt-branch-glyph', 'aria-hidden': 'true' }, '⎇'), ' ', branchLabel),
        typeof status?.ahead === 'number' && status.ahead > 0 ? h(Chip, { tone: 'ok' }, '↑' + String(status.ahead)) : null,
        typeof status?.behind === 'number' && status.behind > 0 ? h(Chip, { tone: 'warn' }, '↓' + String(status.behind)) : null,
        status?.upstream ? h('span', { className: 'dgt-upstream' }, status.upstream) : null,
      ),
      h(
        'div',
        { className: 'dgt-actions' },
        refreshing ? h(Spinner) : null,
        h(
          'button',
          { type: 'button', className: 'dgt-button', onClick: () => void loadStatus(), disabled: refreshing, title: t('refresh') },
          '⟳ ' + t('refresh'),
        ),
      ),
    ),

    statusError !== ''
      ? h(
          'div',
          { className: 'dgt-banner', role: 'status' },
          h('strong', null, t('hostUnavailable')),
          h('span', null, statusError),
        )
      : null,

    // three-pane workspace: refs rail / change list / diff
    h(
      'div',
      { className: 'dgt-body' },

      h(
        'aside',
        { className: 'dgt-rail', 'aria-label': t('refs') },
        h('div', { className: 'dgt-section-title' }, t('branches')),
        h('div', { className: 'dgt-placeholder' }, t('branchesPlaceholder')),
        h('div', { className: 'dgt-section-title' }, t('remotes')),
        h('div', { className: 'dgt-placeholder' }, t('remotesPlaceholder')),
        h('div', { className: 'dgt-section-title' }, t('tags')),
        h('div', { className: 'dgt-placeholder' }, t('tagsPlaceholder')),
      ),

      h(
        'section',
        { className: 'dgt-list', 'aria-label': t('changes') },
        h(
          'div',
          { className: 'dgt-list-head' },
          h('span', null, t('changes')),
          h('span', { className: 'dgt-count' }, String(entries.length)),
        ),
        status === null && statusError === ''
          ? h('div', { className: 'dgt-placeholder' }, t('loading'))
          : entries.length === 0
            ? h('div', { className: 'dgt-placeholder' }, t('clean'))
            : h(
                'div',
                { className: 'dgt-scroll' },
                staged.length > 0 ? h('div', { className: 'dgt-group' }, t('staged'), ' · ', String(staged.length)) : null,
                staged.map((entry) =>
                  h(FileRow, { key: 's:' + entry.path, entry, active: selected?.path === entry.path, onSelect: (picked: GitFileEntry) => void openDiff(picked) }),
                ),
                working.length > 0 ? h('div', { className: 'dgt-group' }, t('working'), ' · ', String(working.length)) : null,
                working.map((entry) =>
                  h(FileRow, { key: 'w:' + entry.path, entry, active: selected?.path === entry.path, onSelect: (picked: GitFileEntry) => void openDiff(picked) }),
                ),
              ),
      ),

      h(
        'section',
        { className: 'dgt-diff', 'aria-label': t('diff') },
        h(
          'div',
          { className: 'dgt-list-head' },
          h('span', null, t('diff')),
          h('span', { className: 'dgt-mono' }, selected?.path ?? ''),
        ),
        h(
          'div',
          { className: 'dgt-diff-body' },
          selected === null
            ? h('div', { className: 'dgt-placeholder' }, t('diffPlaceholder'))
            : diffLoading
              ? h('div', { className: 'dgt-placeholder' }, t('loading'))
              : diff && diff.ok === false
                ? h('div', { className: 'dgt-placeholder dgt-error' }, diff.error || t('diffFailed'))
                : diff && diff.text
                  ? h('pre', { className: 'dgt-premain' }, diff.text)
                  : h('div', { className: 'dgt-placeholder' }, selected.kind === 'untracked' ? t('untrackedNoDiff') : t('noDiff')),
        ),
      ),
    ),
  )
}

function lastSegment(path: string): string {
  const parts = String(path).split(/[\\/]+/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : path
}

/**
 * Porcelain v2 encodes index status in X and work-tree status in Y; `.` means
 * "unchanged on that side". A tracked entry is fully staged when the work tree
 * side is clean.
 */
function isStaged(entry: GitFileEntry): boolean {
  return entry.kind === 'changed' && entry.x !== '.' && entry.x !== '?' && entry.y === '.'
}

// ── sidebar launcher icon ──────────────────────────────────────────────────

/** Root-scoped `sidebar.panellist` entry: the sidebar passes `{ size, active }`. */
function GitTreeIcon(props: AnyProps): any {
  const size = typeof props.size === 'number' ? props.size : 16
  const active = props.active === true
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      'aria-hidden': 'true',
      focusable: 'false',
      style: { display: 'block', opacity: active ? 1 : 0.86 },
    },
    h('path', {
      d: 'M4 2.75v6.1a2.75 2.75 0 0 0 2.75 2.75h2.6',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.4,
      strokeLinecap: 'round',
    }),
    h('circle', { cx: 4, cy: 2.6, r: 1.55, fill: 'currentColor' }),
    h('circle', { cx: 11.6, cy: 11.6, r: 1.55, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 }),
    h('circle', { cx: 6.9, cy: 11.6, r: 1.55, fill: 'currentColor' }),
  )
}

// ── styles (theme tokens only) ─────────────────────────────────────────────

const CSS = `
.dgt-root{box-sizing:border-box;height:100%;min-height:0;display:flex;flex-direction:column;
  background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);
  font-family:var(--dsw-font-family);font-size:13px;line-height:20px;
  padding:calc(var(--dsh-frame-top-clearance,0px) + 8px) 12px 12px;}
.dgt-topbar{display:flex;align-items:center;gap:12px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);
  border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);flex:0 0 auto;}
.dgt-repo{display:flex;flex-direction:column;min-width:0;gap:1px;}
.dgt-repo-name{font-size:14px;font-weight:500;}
.dgt-repo-path{font-size:11px;color:var(--dsw-alias-label-tertiary);max-width:42vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dgt-refs{display:flex;align-items:center;gap:6px;margin-left:auto;min-width:0;}
.dgt-upstream{font-size:11px;color:var(--dsw-alias-label-caption);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:20vw;}
.dgt-branch-glyph{opacity:.75;}
.dgt-chip{display:inline-flex;align-items:center;gap:2px;padding:1px 8px;border-radius:999px;
  background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);
  font-size:11px;line-height:18px;white-space:nowrap;}
.dgt-chip[data-tone='ok']{color:var(--dsw-alias-state-success-primary);}
.dgt-chip[data-tone='warn']{color:var(--dsw-alias-state-warn-primary);}
.dgt-actions{display:flex;align-items:center;gap:8px;}
.dgt-button{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-primary);border-radius:var(--dsw-radius-sm);padding:3px 10px;
  font:inherit;font-size:12px;cursor:pointer;}
.dgt-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);}
.dgt-button:disabled{color:var(--dsw-alias-label-caption);cursor:default;}
.dgt-banner{display:flex;flex-direction:column;gap:2px;margin-top:8px;padding:8px 12px;flex:0 0 auto;
  border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);font-size:12px;}
.dgt-banner strong{color:var(--dsw-alias-state-warn-primary);font-weight:500;}
.dgt-body{display:flex;gap:8px;min-height:0;flex:1 1 auto;margin-top:8px;}
.dgt-rail{flex:0 0 200px;min-width:0;display:flex;flex-direction:column;gap:2px;overflow:auto;
  border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-bg-layer-1);padding:8px;}
.dgt-list{flex:1 1 300px;min-width:0;display:flex;flex-direction:column;
  border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-bg-layer-1);overflow:hidden;}
.dgt-diff{flex:1.4 1 380px;min-width:0;display:flex;flex-direction:column;
  border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-bg-layer-1);overflow:hidden;}
.dgt-list-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:0 0 auto;
  padding:7px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);
  color:var(--dsw-alias-label-secondary);font-size:12px;}
.dgt-count{color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums;}
.dgt-section-title{margin-top:6px;padding:2px 4px;color:var(--dsw-alias-label-tertiary);
  font-size:11px;text-transform:uppercase;letter-spacing:.04em;}
.dgt-placeholder{padding:10px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;}
.dgt-error{color:var(--dsw-alias-state-error-primary);}
.dgt-scroll{overflow:auto;min-height:0;flex:1 1 auto;padding:4px;}
.dgt-group{padding:6px 6px 2px;color:var(--dsw-alias-label-caption);font-size:11px;text-transform:uppercase;letter-spacing:.04em;}
.dgt-file{display:flex;align-items:center;gap:8px;width:100%;text-align:left;appearance:none;border:0;
  background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;
  padding:3px 6px;border-radius:var(--dsw-radius-xs);cursor:pointer;}
.dgt-file:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dgt-file[data-active]{background:var(--dsw-alias-interactive-bg-active);}
.dgt-file-code{flex:0 0 auto;width:18px;text-align:center;font-family:var(--ds-font-family-code);
  font-size:11px;color:var(--dsw-alias-label-tertiary);}
.dgt-file-code[data-status='A']{color:var(--dsw-alias-state-success-primary);}
.dgt-file-code[data-status='D']{color:var(--dsw-alias-state-error-primary);}
.dgt-file-code[data-status='M']{color:var(--dsw-alias-state-warn-primary);}
.dgt-file-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left;}
.dgt-diff-body{min-height:0;flex:1 1 auto;overflow:auto;}
.dgt-premain{margin:0;padding:10px;font-family:var(--ds-font-family-code);
  font-size:var(--dsh-code-font-size,11px);line-height:17px;color:var(--dsw-alias-label-secondary);
  white-space:pre;tab-size:2;}
.dgt-mono{font-family:var(--ds-font-family-code);font-size:11px;color:var(--dsw-alias-label-caption);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%;}
.dgt-spinner{width:12px;height:12px;border-radius:50%;flex:0 0 auto;
  border:1.5px solid var(--dsw-alias-border-l3);border-top-color:var(--dsw-alias-brand-primary);
  animation:dgt-spin .8s linear infinite;}
@keyframes dgt-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.dgt-spinner{animation:none}}
`

// ── dictionaries ───────────────────────────────────────────────────────────

const EN: Record<string, string> = {
  panel: 'Git',
  refresh: 'Refresh',
  refs: 'References',
  branches: 'Local branches',
  branchesPlaceholder: 'Branch list (skeleton)',
  remotes: 'Remotes',
  remotesPlaceholder: 'Remote list (skeleton)',
  tags: 'Tags',
  tagsPlaceholder: 'Tag list (skeleton)',
  changes: 'Changes',
  staged: 'Staged',
  working: 'Working tree',
  diff: 'Diff',
  diffPlaceholder: 'Select a changed file to preview its diff.',
  untrackedNoDiff: 'Untracked file: no diff until it is added.',
  noDiff: 'No diff for this file.',
  clean: 'Working tree clean.',
  loading: 'Loading…',
  statusFailed: 'git status failed.',
  diffFailed: 'git diff failed.',
  hostUnavailable: 'Host half not available',
}

const ZH: Record<string, string> = {
  panel: 'Git',
  refresh: '刷新',
  refs: '引用',
  branches: '本地分支',
  branchesPlaceholder: '分支列表（骨架）',
  remotes: '远程',
  remotesPlaceholder: '远程列表（骨架）',
  tags: '标签',
  tagsPlaceholder: '标签列表（骨架）',
  changes: '改动',
  staged: '已暂存',
  working: '工作区',
  diff: '差异',
  diffPlaceholder: '选择左侧改动以预览差异。',
  untrackedNoDiff: '未跟踪文件：加入暂存前没有差异。',
  noDiff: '该文件没有差异。',
  clean: '工作区干净。',
  loading: '加载中…',
  statusFailed: 'git status 执行失败。',
  diffFailed: 'git diff 执行失败。',
  hostUnavailable: '宿主半未就绪',
}

// ── plugin body ────────────────────────────────────────────────────────────

/**
 * Browser half entry point. `inject` lets Cordis defer `apply` until the slot
 * registry exists; `ctx.slots.inject(ownerKey, …)` then waits for the owning
 * packages' slot declarations instead of racing them.
 */
export const inject = ['slots']

export function apply(ctx: ClientCtx): void {
  // 1. stylesheet owned by this plugin: unloaded with it (no document.body append).
  ctx.effect(() => {
    if (typeof document === 'undefined') return () => {}
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-git-tree'
    tag.textContent = CSS
    document.head.appendChild(tag)
    return () => {
      if (tag.parentNode) tag.parentNode.removeChild(tag)
    }
  }, 'dsh-git-tree: styles')

  // 2. dictionaries + bound translator (resolved text follows locale changes).
  ctx.effect(() => ctx.locale.register(NS, { en: EN, zh: ZH }), 'dsh-git-tree: dictionaries')
  const t = ctx.locale.bind(NS)

  // 3. sidebar launcher: an icon row whose id equals the main panel key.
  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      { name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: () => t('panel'), locale: NS },
      GitTreeIcon,
    ),
  )

  // 4. the panel itself: root-scoped keyed `main` entry, full-height.
  ctx.slots.inject('main', () =>
    ctx.slots.register(
      { name: 'main', key: PANEL_ID, locale: NS, inject: () => ({ t }) },
      GitTreePanel,
    ),
  )
}
