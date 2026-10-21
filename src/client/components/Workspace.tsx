// The workspace shell: repository, view, status state and host calls. Each view
// renders its own surface; the shell owns the toolbar, the reference rail and
// the shared banners.

import { h, React } from '../react'
import type {
  EntrySide,
  GitFileEntry,
  GitStatusPayload,
  DiffPayload,
  CommitDetailPayload,
  HistoryCommit,
  HistoryScope,
  OpenTarget,
  RefsPayload,
  RefRecord,
  Translate,
  WorkspaceRecord,
} from '../types'
import {
  checkoutBranch,
  commitChanges,
  createBranch,
  deleteBranch,
  renameBranch,
  fetchCommitInfo,
  fetchDiff,
  fetchHistory,
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
import { StatusView } from './views/StatusView'
import { HistoryView } from './views/HistoryView'
import { ConfirmDialog, PromptDialog } from './Dialogs'
import type { ViewKind } from '../types'

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
  const [view, setView] = React.useState<ViewKind>('status')

  const [historyCommits, setHistoryCommits] = React.useState<HistoryCommit[]>([])
  const [historyLaneCount, setHistoryLaneCount] = React.useState(1)
  const [historyHasMore, setHistoryHasMore] = React.useState(false)
  const [historyLoading, setHistoryLoading] = React.useState(false)
  const [historyError, setHistoryError] = React.useState('')
  const [historyScope, setHistoryScope] = React.useState<HistoryScope>('all')
  const [historySha, setHistorySha] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [searchAuthor, setSearchAuthor] = React.useState('')
  const [searchPath, setSearchPath] = React.useState('')
  const [appliedQuery, setAppliedQuery] = React.useState('')
  const [appliedAuthor, setAppliedAuthor] = React.useState('')
  const [appliedPath, setAppliedPath] = React.useState('')
  const [commitDetail, setCommitDetail] = React.useState<CommitDetailPayload | null>(null)
  const [commitDetailLoading, setCommitDetailLoading] = React.useState(false)
  const [commitDetailError, setCommitDetailError] = React.useState('')
  const [commitFile, setCommitFile] = React.useState('')
  const [commitFileDiff, setCommitFileDiff] = React.useState<DiffPayload | null>(null)
  const [commitFileDiffLoading, setCommitFileDiffLoading] = React.useState(false)

  const [dialog, setDialog] = React.useState<{ kind: 'create' | 'rename' | 'delete'; branch?: string } | null>(null)
  const [dialogBusy, setDialogBusy] = React.useState(false)
  const [dialogError, setDialogError] = React.useState('')
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

  const loadHistory = React.useCallback(
    async (reset: boolean) => {
      setHistoryLoading(true)
      setHistoryError('')
      const skip = reset ? 0 : historyCommits.length
      const filtering = view === 'search'
      try {
        const next = await fetchHistory({
          cwd: repoPath || undefined,
          scope: historyScope,
          limit: '200',
          skip: String(skip),
          ...(filtering && appliedQuery !== '' ? { query: appliedQuery } : {}),
          ...(filtering && appliedAuthor !== '' ? { author: appliedAuthor } : {}),
          ...(filtering && appliedPath !== '' ? { path: appliedPath } : {}),
        })
        if (!next.ok) {
          setHistoryError(next.error || t('historyFailed'))
          if (reset) setHistoryCommits([])
        } else {
          const list = next.commits ?? []
          setHistoryCommits(reset ? list : [...historyCommits, ...list])
          setHistoryLaneCount(next.laneCount ?? 1)
          setHistoryHasMore(next.hasMore === true)
        }
      } catch (error) {
        setHistoryError(error instanceof Error ? error.message : String(error))
      } finally {
        setHistoryLoading(false)
      }
    },
    [appliedAuthor, appliedPath, appliedQuery, historyCommits, historyScope, repoPath, t, view],
  )

  const loadCommitDetail = React.useCallback(
    async (sha: string) => {
      setCommitDetailLoading(true)
      setCommitDetailError('')
      setCommitDetail(null)
      try {
        const next = await fetchCommitInfo({ cwd: repoPath || undefined, sha })
        if (!next.ok) {
          setCommitDetailError(next.error || t('historyFailed'))
        } else {
          setCommitDetail(next)
        }
      } catch (error) {
        setCommitDetailError(error instanceof Error ? error.message : String(error))
      } finally {
        setCommitDetailLoading(false)
      }
    },
    [repoPath, t],
  )

  React.useEffect(() => {
    if (view !== 'history' || historySha === '') return
    setCommitFile('')
    setCommitFileDiff(null)
    void loadCommitDetail(historySha)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historySha, view, repoPath])

  const openCommitFile = React.useCallback(
    async (path: string) => {
      if (historySha === '') return
      setCommitFile(path)
      setCommitFileDiff(null)
      setCommitFileDiffLoading(true)
      try {
        const next = await fetchDiff({ cwd: repoPath || undefined, path, commit: historySha })
        setCommitFileDiff(next)
      } catch (error) {
        setCommitFileDiff({ ok: false, error: error instanceof Error ? error.message : String(error) })
      } finally {
        setCommitFileDiffLoading(false)
      }
    },
    [historySha, repoPath],
  )

  const openRef = React.useCallback((record: RefRecord, kind: 'branch' | 'tag') => {
    setHistoryScope((kind === 'branch' ? 'branch:' : 'tag:') + record.name)
    setHistorySha('')
    setView('history')
  }, [])

  const checkout = React.useCallback(
    async (name: string) => {
      setBusy(true)
      setActionError('')
      try {
        const result = await checkoutBranch(name, repoPath || undefined)
        if (!result.ok) throw new Error(result.error || t('checkOutFailed'))
        showToast(t('checkedOut') + ' · ' + name)
        setSelected(null)
        setDiff(null)
        setHistorySha('')
        await loadStatus()
        await loadRefs()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setActionError(message)
        showToast(message)
      } finally {
        setBusy(false)
      }
    },
    [loadRefs, loadStatus, repoPath, showToast, t],
  )

  const copyRef = React.useCallback(
    (name: string) => {
      try {
        void navigator.clipboard?.writeText(name)
        showToast(t('copiedPath'))
      } catch {
        showToast(name)
      }
    },
    [showToast, t],
  )

  const closeDialog = React.useCallback(() => {
    setDialog(null)
    setDialogError('')
    setDialogBusy(false)
  }, [])

  const afterBranchChange = React.useCallback(
    async (message: string) => {
      showToast(message)
      closeDialog()
      await loadRefs()
      await loadStatus()
    },
    [closeDialog, loadRefs, loadStatus, showToast],
  )

  const submitCreate = React.useCallback(
    async (name: string) => {
      setDialogBusy(true)
      setDialogError('')
      try {
        const result = await createBranch(name, repoPath || undefined)
        if (!result.ok) throw new Error(result.error || t('branchActionFailed'))
        await afterBranchChange(t('branchCreated') + ' · ' + name)
      } catch (error) {
        setDialogError(error instanceof Error ? error.message : String(error))
      } finally {
        setDialogBusy(false)
      }
    },
    [afterBranchChange, repoPath, t],
  )

  const submitRename = React.useCallback(
    async (to: string) => {
      const from = dialog?.branch ?? ''
      setDialogBusy(true)
      setDialogError('')
      try {
        const result = await renameBranch(from, to, repoPath || undefined)
        if (!result.ok) throw new Error(result.error || t('branchActionFailed'))
        if (historyScope === 'branch:' + from) setHistoryScope('all')
        await afterBranchChange(t('branchRenamed') + ' · ' + to)
      } catch (error) {
        setDialogError(error instanceof Error ? error.message : String(error))
      } finally {
        setDialogBusy(false)
      }
    },
    [afterBranchChange, dialog, historyScope, repoPath, t],
  )

  const submitDelete = React.useCallback(async () => {
    const name = dialog?.branch ?? ''
    setDialogBusy(true)
    setDialogError('')
    try {
      const result = await deleteBranch(name, repoPath || undefined)
      if (!result.ok) throw new Error(result.error || t('branchActionFailed'))
      if (historyScope === 'branch:' + name) setHistoryScope('all')
      await afterBranchChange(t('branchDeleted') + ' · ' + name)
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : String(error))
    } finally {
      setDialogBusy(false)
    }
  }, [afterBranchChange, dialog, historyScope, repoPath, t])

  // Debounce the search inputs into applied filters.
  React.useEffect(() => {
    if (view !== 'search') return
    const id = setTimeout(() => {
      setAppliedQuery(searchQuery.trim())
      setAppliedAuthor(searchAuthor.trim())
      setAppliedPath(searchPath.trim())
    }, 350)
    return () => clearTimeout(id)
  }, [view, searchQuery, searchAuthor, searchPath])

  // Reload whenever the view, repository, scope or applied filters change.
  React.useEffect(() => {
    if (view !== 'history' && view !== 'search') return
    setHistorySha('')
    if (view === 'search' && appliedQuery === '' && appliedAuthor === '' && appliedPath === '') {
      setHistoryCommits([])
      setHistoryError('')
      setHistoryLoading(false)
      return
    }
    void loadHistory(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, repoPath, historyScope, appliedQuery, appliedAuthor, appliedPath])

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
    setView('status')
    setHistoryCommits([])
    setHistorySha('')
  }, [])

  const entries = status?.entries ?? []
  const rows = splitEntries(entries)
  const selectedKey = selected ? rowKey(selected.path, selected.side) : ''
  const selectedEntry = selected ? findEntry(status, selected.path) : null
  const diffSelection = selected && selectedEntry ? { entry: selectedEntry, side: selected.side } : null
  const truncated = status?.truncated === true

  const renderView = () => {
    switch (view) {
      case 'history':
      case 'search':
        return h(HistoryView, {
          mode: view === 'search' ? 'search' : 'history',
          query: searchQuery,
          author: searchAuthor,
          path: searchPath,
          onQuery: setSearchQuery,
          onAuthor: setSearchAuthor,
          onPath: setSearchPath,
          commits: historyCommits,
          laneCount: historyLaneCount,
          hasMore: historyHasMore,
          loading: historyLoading,
          error: historyError,
          scope: historyScope,
          selectedSha: historySha,
          detail: commitDetail,
          detailLoading: commitDetailLoading,
          detailError: commitDetailError,
          selectedFile: commitFile,
          fileDiff: commitFileDiff,
          fileDiffLoading: commitFileDiffLoading,
          t,
          onScope: (scope: HistoryScope) => {
            setHistoryScope(scope)
            setHistorySha('')
          },
          onClearScope: () => {
            setHistoryScope('all')
            setHistorySha('')
          },
          onSelect: (commit: HistoryCommit) => setHistorySha(commit.sha),
          onSelectFile: (path: string) => void openCommitFile(path),
          onParent: (sha: string) => setHistorySha(sha),
          onLoadMore: () => void loadHistory(false),
        })
      case 'status':
      default:
        return h(StatusView, {
          status,
          statusError,
          rows,
          entries,
          selectedKey,
          diffSelection,
          diff,
          diffLoading,
          message,
          busy,
          actionError,
          t,
          commitInputRef: commitInput,
          onSelect: (entry: GitFileEntry, side: EntrySide) => void openDiff(entry, side),
          onToggle: (entry: GitFileEntry, side: EntrySide) => void toggle(entry, side),
          onCopyPath: copyPath,
          onMessage: setMessage,
          onCommit: () => void commit(),
        })
    }
  }

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

    h('div', { className: 'dgt-body' }, h(RefRail, {
          status,
          refs,
          view,
          t,
          onView: setView,
          onOpenRef: openRef,
          onCheckout: (name: string) => void checkout(name),
          onCopyRef: copyRef,
          onCreate: () => {
            setDialogError('')
            setDialog({ kind: 'create' })
          },
          onRename: (name: string) => {
            setDialogError('')
            setDialog({ kind: 'rename', branch: name })
          },
          onDelete: (name: string) => {
            setDialogError('')
            setDialog({ kind: 'delete', branch: name })
          },
        }), renderView()),

    dialog?.kind === 'create'
      ? h(PromptDialog, {
          title: t('newBranch'),
          label: t('branchName'),
          initial: '',
          submitLabel: t('createBranchAction'),
          busy: dialogBusy,
          error: dialogError,
          t,
          onCancel: closeDialog,
          onSubmit: (value: string) => void submitCreate(value),
        })
      : null,
    dialog?.kind === 'rename'
      ? h(PromptDialog, {
          title: t('renameBranch'),
          label: t('branchName'),
          initial: dialog.branch ?? '',
          submitLabel: t('renameBranchAction'),
          busy: dialogBusy,
          error: dialogError,
          t,
          onCancel: closeDialog,
          onSubmit: (value: string) => void submitRename(value),
        })
      : null,
    dialog?.kind === 'delete'
      ? h(ConfirmDialog, {
          title: t('deleteBranch'),
          body: (dialog.branch ?? '') + ' — ' + t('deleteBranchConfirm'),
          submitLabel: t('delete'),
          busy: dialogBusy,
          error: dialogError,
          t,
          onCancel: closeDialog,
          onConfirm: () => void submitDelete(),
        })
      : null,
    toast ? h('div', { className: 'dgt-toast', role: 'status' }, toast) : null,
    notice ? h('div', { className: 'dgt-toast', role: 'status' }, notice) : null,
  )
}
