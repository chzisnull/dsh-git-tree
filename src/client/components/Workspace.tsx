// The workspace panel: state, host calls, polling and the Sourcetree-style
// layout (toolbar / reference rail / change list / diff / commit box).

import { h, React } from '../react'
import type {
  EntrySide,
  GitFileEntry,
  GitStatusPayload,
  DiffPayload,
  RefsPayload,
  OpenTarget,
  Translate,
  WorkspaceRecord,
} from '../types'
import {
  commitChanges,
  fetchDiff,
  fetchRefs,
  fetchStatus,
  fetchWorkspaces,
  openLocal,
  stagePaths,
  unstagePaths,
} from '../routes'
import { rowKey, sideFor, splitEntries } from '../model'
import { TopBar } from './TopBar'
import { RefRail } from './RefRail'
import { ChangeList } from './ChangeList'
import { DiffView } from './DiffView'
import { CommitBox } from './CommitBox'

const POLL_MS = 2000
const REPO_KEY = 'dsh-git-tree/repository'

function findEntry(status: GitStatusPayload | null, path: string): GitFileEntry | null {
  return (status?.entries ?? []).find((entry) => entry.path === path) ?? null
}

/** Pick the side a path should be selected under after a status refresh. */
function sideOf(entry: GitFileEntry): EntrySide {
  if (entry.conflicted) return 'conflicted'
  if (entry.staged) return 'staged'
  return 'unstaged'
}

export function Workspace(props: { t?: Translate }): any {
  const t: Translate = typeof props.t === 'function' ? props.t : (key: string) => key

  const [status, setStatus] = React.useState<GitStatusPayload | null>(null)
  const [refs, setRefs] = React.useState<RefsPayload | null>(null)
  const [workspaces, setWorkspaces] = React.useState<WorkspaceRecord[]>([])
  const [repoPath, setRepoPath] = React.useState('')
  const [statusError, setStatusError] = React.useState('')
  const [selected, setSelected] = React.useState<{ path: string; side: EntrySide } | null>(null)
  const [diff, setDiff] = React.useState<DiffPayload | null>(null)
  const [diffLoading, setDiffLoading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)
  const [opening, setOpening] = React.useState(false)
  const [actionError, setActionError] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [toast, setToast] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const busyRef = React.useRef(false)
  const commitInput = React.useRef<any>(null)
  const toastTimer = React.useRef<any>(null)
  React.useEffect(() => {
    busyRef.current = busy
  }, [busy])

  const showToast = React.useCallback((text: string) => {
    setToast(text)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 6000)
  }, [])

  const loadStatus = React.useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setRefreshing(true)
      try {
        const next = await fetchStatus(repoPath || undefined)
        if (next.ok) {
          setStatus(next)
          setStatusError('')
        } else {
          setStatus(null)
          setStatusError(next.error || t('statusFailed'))
        }
      } catch (error) {
        setStatus(null)
        setStatusError(error instanceof Error ? error.message : String(error))
      } finally {
        if (!options?.silent) setRefreshing(false)
      }
    },
    [repoPath, t],
  )

  const loadRefs = React.useCallback(async () => {
    try {
      const next = await fetchRefs(repoPath || undefined)
      if (next.ok) setRefs(next)
    } catch {
      /* the rail degrades to empty groups */
    }
  }, [repoPath])

  const openDiff = React.useCallback(async (entry: GitFileEntry, side: EntrySide) => {
    setSelected({ path: entry.path, side })
    setDiff(null)
    if (entry.kind === 'ignored') return
    setDiffLoading(true)
    try {
      const next = await fetchDiff({ path: entry.path, side: sideFor(entry, side), cwd: repoPath || undefined })
      setDiff(next)
    } catch (error) {
      setDiff({ ok: false, error: error instanceof Error ? error.message : String(error) })
    } finally {
      setDiffLoading(false)
    }
  }, [repoPath])

  // Registered workspaces for the toolbar switcher; restore the last choice.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await fetchWorkspaces()
        if (cancelled || !list.ok) return
        setWorkspaces(list.workspaces ?? [])
        const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(REPO_KEY) : null
        if (saved && (list.workspaces ?? []).some((workspace) => workspace.path === saved)) setRepoPath(saved)
      } catch {
        /* the switcher stays with the session workspace */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    void loadStatus()
    void loadRefs()
  }, [loadStatus, loadRefs])

  // Keep the selection honest when the working copy changes underneath it.
  React.useEffect(() => {
    if (selected === null) return
    if (findEntry(status, selected.path) === null) {
      setSelected(null)
      setDiff(null)
    }
  }, [status, selected])

  // Poll while the panel is on screen; pause when hidden or a write is running.
  React.useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (busyRef.current) return
      void loadStatus({ silent: true })
      void loadRefs()
    }, POLL_MS)
    const onFocus = () => {
      void loadStatus({ silent: true })
      void loadRefs()
    }
    const onVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') onFocus()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadStatus, loadRefs])

  const toggle = React.useCallback(
    async (entry: GitFileEntry, side: EntrySide) => {
      if (entry.conflicted || side === 'conflicted') {
        setActionError(t('conflictsBlockCommit'))
        return
      }
      setBusy(true)
      setActionError('')
      try {
        const result =
          side === 'staged'
            ? await unstagePaths([entry.path], repoPath || undefined)
            : await stagePaths([entry.path], repoPath || undefined)
        if (!result.ok) throw new Error(result.error || (side === 'staged' ? t('unstageFailed') : t('stageFailed')))
        const next = await fetchStatus(repoPath || undefined)
        if (next.ok) setStatus(next)
        if (selected?.path === entry.path && next.ok) {
          const updated = findEntry(next, entry.path)
          if (updated) await openDiff(updated, sideOf(updated))
        }
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error))
      } finally {
        setBusy(false)
      }
    },
    [openDiff, repoPath, selected, t],
  )

  const copyPath = React.useCallback(
    (entry: GitFileEntry) => {
      try {
        void navigator.clipboard?.writeText(entry.path)
        showToast(t('copiedPath'))
      } catch {
        showToast(entry.path)
      }
    },
    [showToast, t],
  )

  const openLocalAction = React.useCallback(
    async (target: OpenTarget) => {
      setOpening(true)
      try {
        const result = await openLocal(target, repoPath || undefined)
        if (!result.ok) throw new Error(result.error || t('openFailed'))
      } catch (error) {
        showToast(error instanceof Error ? error.message : String(error))
      } finally {
        setOpening(false)
      }
    },
    [repoPath, showToast, t],
  )

  const commit = React.useCallback(async () => {
    const staged = status?.counts?.staged ?? 0
    const conflicts = status?.counts?.conflicted ?? 0
    if (busyRef.current || staged === 0 || message.trim() === '' || conflicts > 0) return
    setBusy(true)
    setActionError('')
    try {
      const result = await commitChanges(message, repoPath || undefined)
      if (!result.ok) throw new Error(result.error || t('commitFailed'))
      showToast([t('commitDone'), result.shortSha, result.subject].filter(Boolean).join(' · '))
      setMessage('')
      setSelected(null)
      setDiff(null)
      await loadStatus()
      await loadRefs()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }, [loadRefs, loadStatus, message, repoPath, showToast, status, t])

  const switchWorkspace = React.useCallback((path: string) => {
    setRepoPath(path)
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(REPO_KEY, path)
    } catch {
      /* storage may be unavailable; the selection still holds for this mount */
    }
    setSelected(null)
    setDiff(null)
    setActionError('')
    setMessage('')
  }, [])

  const entries = status?.entries ?? []
  const rows = splitEntries(entries)
  const selectedKey = selected ? rowKey(selected.path, selected.side) : ''
  const selectedEntry = selected ? findEntry(status, selected.path) : null
  const diffSelection = selected && selectedEntry ? { entry: selectedEntry, side: selected.side } : null
  const truncated = status?.truncated === true

  return h(
    'div',
    { className: 'dgt-root', 'data-plugin': 'dsh-git-tree' },
    h(TopBar, {
      status,
      workspaces,
      currentPath: repoPath || status?.repoRoot || status?.cwd || '',
      busy: refreshing || busy,
      opening,
      t,
      onRefresh: () => void loadStatus(),
      onOpen: (target: OpenTarget) => void openLocalAction(target),
      onSelectWorkspace: switchWorkspace,
      onCommitFocus: () => {
        if (commitInput.current && commitInput.current.focus) commitInput.current.focus()
      },
    }),

    statusError !== ''
      ? h(
          'div',
          { className: 'dgt-banner', 'data-tone': 'error' },
          h('span', { className: 'dgt-banner-text' }, statusError),
        )
      : null,
    truncated ? h('div', { className: 'dgt-banner' }, h('span', { className: 'dgt-banner-text' }, t('truncated'))) : null,

    h(
      'div',
      { className: 'dgt-body' },
      h(RefRail, { status, refs, t }),
      h(
        'div',
        { className: 'dgt-main' },
        h(
          'div',
          { className: 'dgt-panes' },
          h(ChangeList, {
            status,
            statusError,
            rows,
            selectedKey,
            t,
            onSelect: (entry: GitFileEntry, side: EntrySide) => void openDiff(entry, side),
            onToggle: (entry: GitFileEntry, side: EntrySide) => void toggle(entry, side),
            onCopyPath: copyPath,
          }),
          h(DiffView, {
            selected: diffSelection,
            diff,
            loading: diffLoading,
            hasChanges: entries.length > 0,
            t,
            onToggleFile: () => {
              if (diffSelection) void toggle(diffSelection.entry, diffSelection.side)
            },
          }),
        ),
        h(CommitBox, {
          status,
          message,
          busy,
          hint: actionError,
          hintTone: actionError ? 'error' : 'muted',
          t,
          inputRef: commitInput,
          onMessage: setMessage,
          onCommit: () => void commit(),
        }),
      ),
    ),

    toast ? h('div', { className: 'dgt-toast', role: 'status' }, toast) : null,
    notice ? h('div', { className: 'dgt-toast', role: 'status' }, notice) : null,
  )
}
