// The workspace shell: repository, view, status state and host calls. Each view
// renders its own surface; the shell owns the toolbar, the reference rail, the
// shared banners, and the shortcut hold that an open dialog puts around the
// panel toggle.

import { h, React } from '../react'
import type {
  AiCommitControls,
  AiModelsPayload,
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
  RefKind,
  Translate,
  WorkspaceRecord,
} from '../types'
import {
  checkoutBranch,
  commitChanges,
  discardPaths,
  applyConflict,
  generateCommitMessage,
  markConflictResolved,
  mergeBranch,
  resolveConflict,
  revertConflict,
  pushBranch,
  createBranch,
  deleteBranch,
  deleteRemoteBranch,
  renameBranch,
  fetchAiModels,
  saveAiModel,
  fetchCommitInfo,
  fetchDiff,
  fetchHistory,
  fetchRefs,
  fetchRemote,
  fetchStatus,
  fetchWorkspaces,
  openLocal,
  pullBranch,
  recordRepositoryOpen,
  removePaths,
  setRepositoryPin,
  stagePaths,
  unstagePaths,
} from '../routes'
import { rowKey, sideFor, splitEntries, statusLetter } from '../model'
import { TopBar } from './TopBar'
import { RefRail } from './RefRail'
import { StatusView } from './views/StatusView'
import { HistoryView } from './views/HistoryView'
import { ConflictDialog, ConfirmDialog, HandoffDialog, PromptDialog } from './Dialogs'
import { ContextMenu } from './ContextMenu'
import type { ContextMenuEntry, ContextMenuState } from './ContextMenu'
import { holdShortcut } from '../shortcut'
import { startPollLoop, statusSignature } from '../poll'
import { buildConflictPrompt } from '../handoff'
import type { HandoffBridge, HandoffFailure, HandoffResult } from '../handoff'
import type { ViewKind } from '../types'

const REPO_KEY = 'dsh-git-tree/repository'
const COMMIT_FOLD_KEY = 'dsh-git-tree/commit-collapsed'

// A typed commit message is worth more than the React state it lives in: the
// panel is a `main` slot, so closing it (or toggling back to the conversation
// with the shortcut) destroys the component. Keep the draft per repository for
// the lifetime of the page; a successful commit clears it like pressing Clear.
const commitDrafts = new Map<string, string>()

function findEntry(status: GitStatusPayload | null, path: string): GitFileEntry | null {
  return (status?.entries ?? []).find((entry) => entry.path === path) ?? null
}

/** Pick the side a path should be selected under after a status refresh. */
function sideOf(entry: GitFileEntry): EntrySide {
  if (entry.conflicted) return 'conflicted'
  if (entry.staged) return 'staged'
  return 'unstaged'
}

/** What the commit card needs from the AI model catalog; one object, one prop. */
export type AiCommitProps = AiCommitControls

export function Workspace(props: { t?: Translate; locale?: () => string; handoff?: HandoffBridge }): any {
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

  const [dialog, setDialog] = React.useState<{
    kind:
      | 'create'
      | 'rename'
      | 'delete'
      | 'delete-remote'
      | 'discard'
      | 'remove'
      | 'remove-untracked'
      | 'remove-untracked-batch'
      | 'merge'
      | 'push'
      | 'conflict-revert'
      | 'pull-diverged'
    branch?: string
    oid?: string
    force?: boolean
    start?: string
    path?: string
    paths?: string[]
    generation?: number
    side?: EntrySide
  } | null>(null)
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null)
  const [pushAfter, setPushAfter] = React.useState(false)
  // The commit card folds to one strip; the choice outlives the panel, like the
  // repository choice, so a user who wants the diff space keeps it.
  const [commitCollapsed, setCommitCollapsed] = React.useState<boolean>(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(COMMIT_FOLD_KEY) === '1'
    } catch {
      return false
    }
  })
  const [aiModels, setAiModels] = React.useState<AiModelsPayload | null>(null)
  const [aiLoading, setAiLoading] = React.useState(false)
  const [aiBusy, setAiBusy] = React.useState(false)
  // Conflict resolution: the model's answer is previewed, never auto-written.
  const [conflictResolve, setConflictResolve] = React.useState<{
    path: string
    content: string
    sourceHash: string
    generation: number
    diff: DiffPayload | null
    provider: string
    model: string
  } | null>(null)
  const [conflictBusy, setConflictBusy] = React.useState('')
  // Handing the file to a session: the button runs while the main view swaps,
  // and the dialog is the only way out when no session can be opened.
  const [handoffBusy, setHandoffBusy] = React.useState(false)
  const [handoffDialog, setHandoffDialog] = React.useState<{
    prompt: string
    reason: HandoffFailure
    /** True only when the automatic copy failed; then the dialog carries the text. */
    copyFailed: boolean
  } | null>(null)
  const [conflictError, setConflictError] = React.useState('')
  const [dialogBusy, setDialogBusy] = React.useState(false)
  const [dialogError, setDialogError] = React.useState('')
  const [statusError, setStatusError] = React.useState('')
  const [selected, setSelected] = React.useState<{ path: string; side: EntrySide } | null>(null)
  const [batchSelected, setBatchSelected] = React.useState<Set<string>>(() => new Set())
  const [diff, setDiff] = React.useState<DiffPayload | null>(null)
  const [diffLoading, setDiffLoading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)
  const [opening, setOpening] = React.useState(false)
  const [fetching, setFetching] = React.useState(false)
  const [pulling, setPulling] = React.useState(false)
  const [actionError, setActionError] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [toast, setToast] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const busyRef = React.useRef(false)
  const repoGeneration = React.useRef(0)
  const statusRequest = React.useRef(0)
  const refsRequest = React.useRef(0)
  const diffRequest = React.useRef(0)
  const historyRequest = React.useRef(0)
  const detailRequest = React.useRef(0)
  const commitFileRequest = React.useRef(0)
  const selectedRef = React.useRef(selected)
  selectedRef.current = selected
  // The status the panel is already showing, per repository generation. A poll
  // that reads the same content again must not write it back: every write
  // re-renders the whole change list for a screen that has not changed (138 ms
  // at 5000 changes). A new generation — a repository switch — invalidates it,
  // so the first read there is always written.
  const statusWritten = React.useRef<{ generation: number; signature: string }>({
    generation: -1,
    signature: '',
  })
  // Set by the poll loop: a pointer entering the panel is a signal to refresh.
  const wakePollRef = React.useRef<(() => void) | null>(null)
  const handoffTimer = React.useRef<any>(null)
  const commitInput = React.useRef<any>(null)
  const toastTimer = React.useRef<any>(null)
  React.useEffect(() => {
    busyRef.current = busy
  }, [busy])
  React.useEffect(
    () => () => {
      if (handoffTimer.current) clearTimeout(handoffTimer.current)
    },
    [],
  )

  const setCommitFold = React.useCallback((folded: boolean) => {
    setCommitCollapsed(folded)
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(COMMIT_FOLD_KEY, folded ? '1' : '0')
    } catch {
      /* storage may be unavailable; the fold still holds for this mount */
    }
  }, [])

  // Stable for the memoised commit card: it only changes when the fold does.
  const toggleCommitFold = React.useCallback(() => setCommitFold(!commitCollapsed), [commitCollapsed, setCommitFold])

  const showToast = React.useCallback((text: string) => {
    setToast(text)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 6000)
  }, [])

  // Restore / remember the commit draft. The key is the repository the git
  // command actually ran against, not the explicit switcher selection: with no
  // repository chosen the host answers for the session workspace, so `repoPath`
  // alone stays empty and would never match a draft.
  const draftKey = repoPath || status?.repoRoot || status?.cwd || ''
  React.useEffect(() => {
    if (!draftKey) return
    const saved = commitDrafts.get(draftKey)
    if (saved === undefined) return
    setMessage((current) => (current === '' ? saved : current))
  }, [draftKey])

  React.useEffect(() => {
    if (!draftKey) return
    if (message === '') commitDrafts.delete(draftKey)
    else commitDrafts.set(draftKey, message)
  }, [draftKey, message])

  // A panel-owned overlay owns the keyboard until it closes. The desktop shell
  // dispatches bound shortcuts ahead of modal controls, so without this the
  // toggle would hide the panel (and drop an unsaved AI preview) underneath the
  // dialog the user is looking at.
  const overlayOpen =
    dialog !== null || conflictResolve !== null || contextMenu !== null || handoffDialog !== null
  React.useEffect(() => {
    if (!overlayOpen) return undefined
    return holdShortcut()
  }, [overlayOpen])

  const statusGeneration = repoGeneration.current
  const loadStatus = React.useCallback(
    async (options?: { silent?: boolean }): Promise<GitStatusPayload | null> => {
      const generation = statusGeneration
      if (generation !== repoGeneration.current) return null
      const request = ++statusRequest.current
      if (!options?.silent) setRefreshing(true)
      try {
        const next = await fetchStatus(repoPath || undefined)
        if (generation !== repoGeneration.current || request !== statusRequest.current) return null
        if (next.ok) {
          // Only write what the panel is not already showing. The signature covers
          // everything the rail, the list and the commit card draw from, so an
          // unchanged one means the poll found nothing to show — and the caller
          // still gets the fresh payload back. After a write the content moved, so
          // the signature differs and the refresh goes through.
          const signature = statusSignature(next)
          const written = statusWritten.current
          if (written.generation !== generation || written.signature !== signature) {
            statusWritten.current = { generation, signature }
            setStatus(next)
          }
          setStatusError('')
        } else {
          // Nothing is on screen now, so a later success has to be written even
          // if it matches the last thing that was.
          statusWritten.current = { generation, signature: '' }
          setStatus(null)
          setStatusError(next.error || t('statusFailed'))
        }
        return next
      } catch (error) {
        if (generation !== repoGeneration.current || request !== statusRequest.current) return null
        statusWritten.current = { generation, signature: '' }
        setStatus(null)
        setStatusError(error instanceof Error ? error.message : String(error))
        return null
      } finally {
        if (!options?.silent && generation === repoGeneration.current) setRefreshing(false)
      }
    },
    [repoPath, statusGeneration, t],
  )

  const loadRefs = React.useCallback(async (branch?: string) => {
    const generation = statusGeneration
    if (generation !== repoGeneration.current) return
    const request = ++refsRequest.current
    const current = () => generation === repoGeneration.current && request === refsRequest.current
    try {
      const next = await fetchRefs(repoPath || undefined, branch)
      if (!current()) return
      setRefs((previous) => next.ok ? next : { ...previous, ok: false, error: next.error || t('refsFailed') })
    } catch (error) {
      if (current()) setRefs((previous) => ({ ...previous, ok: false, error: error instanceof Error ? error.message : String(error) }))
    }
  }, [repoPath, statusGeneration, t])

  /** Refresh the live DSH model catalog and the route the card will call. */
  const loadAiModels = React.useCallback(async () => {
    setAiLoading(true)
    try {
      const next = await fetchAiModels()
      setAiModels(next.ok ? next : { ok: false, groups: [], failures: [], active: null, error: next.error })
    } catch {
      setAiModels({ ok: false, groups: [], failures: [], active: null })
    } finally {
      setAiLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadAiModels()
  }, [loadAiModels])

  /**
   * Write the commit message from the files the commit would include: the
   * staged rows when there are any, otherwise every working-tree row (so a
   * message can be drafted before staging).
   */
  const generateMessage = React.useCallback(async () => {
    const generation = statusGeneration
    if (busyRef.current || aiBusy || generation !== repoGeneration.current) return
    const all = status?.entries ?? []
    const staged = all.filter((entry) => entry.staged && !entry.conflicted)
    const side: 'staged' | 'unstaged' = staged.length > 0 ? 'staged' : 'unstaged'
    const source = (staged.length > 0 ? staged : all.filter((entry) => !entry.conflicted && entry.kind !== 'ignored')).slice(
      0,
      60,
    )
    const files = source.map((entry) => ({ path: entry.path, status: statusLetter(entry, side) }))
    if (files.length === 0) {
      showToast(t('aiNoChanges'))
      return
    }
    setAiBusy(true)
    setActionError('')
    try {
      const locale = typeof props.locale === 'function' ? props.locale() : 'en'
      const payload = await generateCommitMessage({ side, files, locale }, repoPath || undefined)
      if (generation !== repoGeneration.current) return
      if (!payload.ok || typeof payload.message !== 'string' || payload.message === '') {
        throw new Error(payload.error || t('aiFailed'))
      }
      setMessage(payload.message)
      showToast(t('aiDone'))
      setTimeout(() => {
        if (commitInput.current && commitInput.current.focus) commitInput.current.focus()
      }, 0)
    } catch (error) {
      if (generation !== repoGeneration.current) return
      const text = error instanceof Error ? error.message : String(error)
      setActionError(text)
      showToast(text)
    } finally {
      if (generation === repoGeneration.current) setAiBusy(false)
    }
  }, [aiBusy, props.locale, repoPath, showToast, status, statusGeneration, t])

  const selectAiModel = React.useCallback(
    async (provider: string, model: string) => {
      try {
        const saved = await saveAiModel(provider, model)
        if (!saved.ok) throw new Error(saved.error || t('aiModelSaveFailed'))
        await loadAiModels()
        showToast(t('aiModelSwitched'))
      } catch (error) {
        showToast(error instanceof Error ? error.message : String(error))
      }
    },
    [loadAiModels, showToast, t],
  )

  // The two handlers are the `useCallback`s themselves rather than fresh arrows:
  // the commit card is memoised on this object, and an arrow here would redraw
  // it on every status render for no change at all.
  const aiCommit: AiCommitProps = {
    loading: aiLoading,
    busy: aiBusy,
    groups: aiModels?.groups ?? [],
    failures: aiModels?.failures ?? [],
    active: aiModels?.active ?? null,
    error: aiModels?.error || (aiModels && aiModels.ok === false ? t('aiFailed') : ''),
    onGenerate: generateMessage,
    onSelect: selectAiModel,
  }

  const openDiff = React.useCallback(async (entry: GitFileEntry, side: EntrySide, silent = false) => {
    const generation = statusGeneration
    if (generation !== repoGeneration.current) return
    const request = ++diffRequest.current
    const current = () => generation === repoGeneration.current && request === diffRequest.current
    if (!silent) {
      const selection = { path: entry.path, side }
      selectedRef.current = selection
      setSelected(selection)
      setDiff(null)
      setDiffLoading(true)
    }
    if (entry.kind === 'ignored') { setDiffLoading(false); return }
    try {
      const next = await fetchDiff({ path: entry.path, side: sideFor(entry, side), cwd: repoPath || undefined })
      if (current()) setDiff((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
    } catch (error) {
      if (current()) setDiff({ ok: false, error: error instanceof Error ? error.message : String(error) })
    } finally {
      if (current()) setDiffLoading(false)
    }
  }, [repoPath, statusGeneration])

  const refreshDiff = React.useCallback(async (next: GitStatusPayload | null) => {
    const selection = selectedRef.current
    if (view !== 'status' || !next?.ok || !selection || statusGeneration !== repoGeneration.current) return
    const entry = findEntry(next, selection.path)
    if (entry && (selection.side === 'conflicted' ? entry.conflicted : entry[selection.side])) {
      await openDiff(entry, selection.side, true)
    } else {
      ++diffRequest.current
      selectedRef.current = null
      setSelected(null)
      setDiff(null)
      setDiffLoading(false)
    }
  }, [openDiff, statusGeneration, view])

  const loadHistory = React.useCallback(
    async (reset: boolean) => {
      const generation = statusGeneration
      if (generation !== repoGeneration.current) return
      const request = ++historyRequest.current
      const current = () => generation === repoGeneration.current && request === historyRequest.current
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
        if (!current()) return
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
        if (current()) setHistoryError(error instanceof Error ? error.message : String(error))
      } finally {
        if (current()) setHistoryLoading(false)
      }
    },
    [appliedAuthor, appliedPath, appliedQuery, historyCommits, historyScope, repoPath, statusGeneration, t, view],
  )

  const afterPush = React.useCallback(async () => {
    await loadStatus()
    await loadRefs()
    if (view !== 'status') await loadHistory(true)
  }, [loadHistory, loadRefs, loadStatus, view])

  const refreshAll = React.useCallback(async () => {
    const next = await loadStatus()
    await Promise.all([loadRefs(next?.branch), refreshDiff(next), view !== 'status' ? loadHistory(true) : Promise.resolve()])
  }, [loadHistory, loadRefs, loadStatus, refreshDiff, view])

  const loadCommitDetail = React.useCallback(
    async (sha: string) => {
      const generation = statusGeneration
      if (generation !== repoGeneration.current) return
      const request = ++detailRequest.current
      ++commitFileRequest.current
      const current = () => generation === repoGeneration.current && request === detailRequest.current
      setCommitDetailLoading(true)
      setCommitDetailError('')
      setCommitDetail(null)
      try {
        const next = await fetchCommitInfo({ cwd: repoPath || undefined, sha })
        if (!current()) return
        if (!next.ok) {
          setCommitDetailError(next.error || t('historyFailed'))
        } else {
          setCommitDetail(next)
          // Open the first changed file so selecting a commit lands on a diff,
          // not on an empty instruction pane.
          const first = (next.files ?? [])[0]
          if (first) {
            setCommitFile(first.path)
            setCommitFileDiff(null)
            setCommitFileDiffLoading(true)
            const fileRequest = ++commitFileRequest.current
            const fileCurrent = () => current() && fileRequest === commitFileRequest.current
            try {
              const detail = await fetchDiff({ cwd: repoPath || undefined, path: first.path, commit: sha })
              if (fileCurrent()) setCommitFileDiff(detail)
            } catch (error) {
              if (fileCurrent()) setCommitFileDiff({ ok: false, error: error instanceof Error ? error.message : String(error) })
            } finally {
              if (fileCurrent()) setCommitFileDiffLoading(false)
            }
          } else {
            setCommitFile('')
            setCommitFileDiff(null)
          }
        }
      } catch (error) {
        if (current()) setCommitDetailError(error instanceof Error ? error.message : String(error))
      } finally {
        if (current()) setCommitDetailLoading(false)
      }
    },
    [repoPath, statusGeneration, t],
  )

  const selectCommit = React.useCallback((sha: string) => {
    if (sha === historySha) return
    ++detailRequest.current
    ++commitFileRequest.current
    setHistorySha(sha)
  }, [historySha])

  React.useEffect(() => {
    if ((view !== 'history' && view !== 'search') || historySha === '') return
    setCommitFile('')
    setCommitFileDiff(null)
    void loadCommitDetail(historySha)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historySha, view, repoPath])

  const openCommitFile = React.useCallback(
    async (path: string) => {
      const generation = statusGeneration
      if (historySha === '' || generation !== repoGeneration.current) return
      const request = ++commitFileRequest.current
      const current = () => generation === repoGeneration.current && request === commitFileRequest.current
      setCommitFile(path)
      setCommitFileDiff(null)
      setCommitFileDiffLoading(true)
      try {
        const next = await fetchDiff({ cwd: repoPath || undefined, path, commit: historySha })
        if (current()) setCommitFileDiff(next)
      } catch (error) {
        if (current()) setCommitFileDiff({ ok: false, error: error instanceof Error ? error.message : String(error) })
      } finally {
        if (current()) setCommitFileDiffLoading(false)
      }
    },
    [historySha, repoPath, statusGeneration],
  )

  React.useEffect(() => {
    if (view !== 'search' || historyLoading || historySha !== '') return
    const first = historyCommits[0]
    if (first) setHistorySha(first.sha)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, historyLoading, historyCommits, historySha])

  const openRef = React.useCallback((record: RefRecord, kind: RefKind) => {
    if (view === 'history' && historyScope === kind + ':' + record.name) return
    ++historyRequest.current
    ++detailRequest.current
    ++commitFileRequest.current
    setHistoryScope(kind + ':' + record.name)
    setHistorySha('')
    setView('history')
  }, [historyScope, view])

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
    async (name: string) => {
      try {
        if (!navigator.clipboard?.writeText) { showToast(name); return }
        await navigator.clipboard.writeText(name)
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
        const result = await createBranch(name, repoPath || undefined, dialog?.start)
        if (!result.ok) throw new Error(result.error || t('branchActionFailed'))
        await afterBranchChange(t('branchCreated') + ' · ' + name)
      } catch (error) {
        setDialogError(error instanceof Error ? error.message : String(error))
      } finally {
        setDialogBusy(false)
      }
    },
    [afterBranchChange, dialog?.start, repoPath, t],
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

  const requestBranchDelete = React.useCallback((name: string, force = false) => {
    setDialogError('')
    setDialog({ kind: 'delete', branch: name, force, generation: statusGeneration })
  }, [statusGeneration])

  const requestRemoteDelete = React.useCallback((record: RefRecord) => {
    setDialogError('')
    setDialog({ kind: 'delete-remote', branch: record.name, oid: record.oid, generation: statusGeneration })
  }, [statusGeneration])

  const submitDelete = React.useCallback(async () => {
    if (!dialog || dialog.generation !== repoGeneration.current || busyRef.current) return
    const generation = dialog.generation
    const name = dialog.branch ?? ''
    const remote = dialog.kind === 'delete-remote'
    busyRef.current = true
    setDialogBusy(true)
    setDialogError('')
    try {
      const result = remote
        ? await deleteRemoteBranch(name, dialog.oid ?? '', repoPath || undefined)
        : await deleteBranch(name, repoPath || undefined, dialog.force === true)
      if (generation !== repoGeneration.current) return
      if (!result.ok) throw new Error(result.error || t('branchActionFailed'))
      const resetScope = historyScope === (remote ? 'remote:' : 'branch:') + name
      if (resetScope) setHistoryScope('all')
      await afterBranchChange(t(remote ? 'remoteBranchDeleted' : 'branchDeleted') + ' · ' + name + (result.warning ? ' · ' + result.warning : ''))
      if (!resetScope && view !== 'status' && generation === repoGeneration.current) await loadHistory(true)
    } catch (error) {
      if (generation === repoGeneration.current) setDialogError(error instanceof Error ? error.message : String(error))
    } finally {
      busyRef.current = false
      if (generation === repoGeneration.current) setDialogBusy(false)
    }
  }, [afterBranchChange, dialog, historyScope, loadHistory, repoPath, t, view])

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
    ++historyRequest.current
    ++detailRequest.current
    ++commitFileRequest.current
    setHistorySha('')
    setHistoryHasMore(false)
    if (view === 'search' && appliedQuery === '' && appliedAuthor === '' && appliedPath === '') {
      setHistoryCommits([])
      setHistoryError('')
      setHistoryLoading(false)
      return
    }
    void loadHistory(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, repoPath, historyScope, appliedQuery, appliedAuthor, appliedPath])

  /** Refresh the switcher list with its pins and usage counts. */
  const loadWorkspaces = React.useCallback(async () => {
    try {
      const list = await fetchWorkspaces()
      if (list.ok) setWorkspaces(list.workspaces ?? [])
      return list.workspaces ?? []
    } catch {
      return []
    }
  }, [])

  // Registered workspaces for the toolbar switcher; restore the last choice.
  React.useEffect(() => {
    let cancelled = false
    const generation = repoGeneration.current
    void (async () => {
      const list = await loadWorkspaces()
      if (cancelled || generation !== repoGeneration.current) return
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(REPO_KEY) : null
      if (saved && list.some((workspace) => workspace.path === saved)) {
        repoGeneration.current += 1
        selectedRef.current = null
        setRefs(null)
        setStatus(null)
        setBatchSelected(new Set())
        setDialog(null)
        setSelected(null)
        setDiff(null)
        setRepoPath(saved)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadWorkspaces])

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

  // Poll only while the window is focused and the panel is on screen, at a
  // cadence that backs off when nothing changes. A poll is two routes and, on
  // the host side, one `git status`; the rail is read on its own slower clock.
  // See poll.ts for the loop and the numbers behind it.
  React.useEffect(() => {
    const focusedNow = () =>
      typeof document === 'undefined' || typeof document.hasFocus !== 'function' ? true : document.hasFocus()
    let focused = focusedNow()

    const loop = startPollLoop({
      readStatus: async () => {
        const next = await loadStatus({ silent: true })
        await refreshDiff(next)
        return next
      },
      readRefs: (branch) => void loadRefs(branch),
      stopped: () => (typeof document !== 'undefined' && document.visibilityState === 'hidden') || !focused,
      busy: () => busyRef.current,
      now: () => Date.now(),
      setTimer: (run, ms) => setTimeout(run, ms),
      clearTimer: (handle) => clearTimeout(handle),
    })
    wakePollRef.current = () => loop.wake()

    const onFocus = () => {
      focused = true
      loop.wake()
    }
    const onBlur = () => {
      // The loop stops scheduling on its own; nothing to poll while we are away.
      focused = false
    }
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        focused = false
        return
      }
      // Visible is not focused: a window can be on screen behind another app.
      if (!focusedNow()) return
      focused = true
      loop.wake()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisible)
    // The mount effect above already read status and refs; don't ask twice.
    loop.wake()
    return () => {
      wakePollRef.current = null
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisible)
      loop.stop()
    }
  }, [loadStatus, loadRefs, refreshDiff])

  const toggle = React.useCallback(
    async (entry: GitFileEntry, side: EntrySide) => {
      if (busyRef.current) return
      if (entry.conflicted || side === 'conflicted') {
        setActionError(t('conflictsBlockCommit'))
        return
      }
      const generation = statusGeneration
      busyRef.current = true
      setBusy(true)
      setActionError('')
      try {
        const result =
          side === 'staged'
            ? await unstagePaths([entry.path], repoPath || undefined)
            : await stagePaths([entry.path], repoPath || undefined)
        if (!result.ok) throw new Error(result.error || (side === 'staged' ? t('unstageFailed') : t('stageFailed')))
        const next = await loadStatus({ silent: true })
        if (generation !== repoGeneration.current) return
        if (selected?.path === entry.path && next?.ok) {
          const updated = findEntry(next, entry.path)
          if (updated) await openDiff(updated, sideOf(updated))
        }
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error))
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [loadStatus, openDiff, repoPath, selected, statusGeneration, t],
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

  const copyText = React.useCallback(
    async (text: string, toast: string, failureToast?: string): Promise<boolean> => {
      const fallback = () => showToast(failureToast ?? text)
      try {
        const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
        if (!clipboard || typeof clipboard.writeText !== 'function') {
          fallback()
          return false
        }
        await clipboard.writeText(text)
        showToast(toast)
        return true
      } catch {
        fallback()
        return false
      }
    },
    [showToast],
  )

  const commitThis = React.useCallback(
    async (entry: GitFileEntry, side: EntrySide) => {
      if (entry.conflicted || busyRef.current) return
      busyRef.current = true
      setBusy(true)
      setActionError('')
      try {
        if (side !== 'staged') {
          const staged = await stagePaths([entry.path], repoPath || undefined)
          if (!staged.ok) throw new Error(staged.error || t('stageFailed'))
          await loadStatus({ silent: true })
        }
        setCommitFold(false)
        setTimeout(() => {
          if (commitInput.current && commitInput.current.focus) commitInput.current.focus()
        }, 0)
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error))
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [loadStatus, repoPath, setCommitFold, t],
  )

  const submitDiscard = React.useCallback(async () => {
    const path = dialog?.path ?? ''
    const side = dialog?.side === 'staged' ? 'staged' : 'unstaged'
    setDialogBusy(true)
    setDialogError('')
    try {
      const result = await discardPaths([path], side, repoPath || undefined)
      if (!result.ok) throw new Error(result.error || t('branchActionFailed'))
      closeDialog()
      showToast(t('discardDone') + ' · ' + path)
      setSelected(null)
      setDiff(null)
      await loadStatus()
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : String(error))
    } finally {
      setDialogBusy(false)
    }
  }, [closeDialog, dialog?.path, dialog?.side, loadStatus, repoPath, showToast, t])

  const submitRemove = React.useCallback(async () => {
    const path = dialog?.path ?? ''
    const untracked = dialog?.kind === 'remove-untracked'
    setDialogBusy(true)
    setDialogError('')
    try {
      const result = await removePaths([path], untracked, repoPath || undefined)
      if (!result.ok) throw new Error(result.error || result.failed?.[0]?.error || t('branchActionFailed'))
      closeDialog()
      showToast(t('removeDone') + ' · ' + path)
      setSelected(null)
      setDiff(null)
      await loadStatus()
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : String(error))
    } finally {
      setDialogBusy(false)
    }
  }, [closeDialog, dialog?.kind, dialog?.path, loadStatus, repoPath, showToast, t])

  const submitBatchStage = React.useCallback(async () => {
    const paths = (status?.entries ?? [])
      .filter((entry) => entry.unstaged && !entry.conflicted && batchSelected.has(entry.path))
      .map((entry) => entry.path)
    if (paths.length === 0 || busyRef.current || statusGeneration !== repoGeneration.current) return
    const encoder = new TextEncoder()
    let remaining = paths.slice()
    let stagedCount = 0
    busyRef.current = true
    setBusy(true)
    setActionError('')
    try {
      while (remaining.length > 0) {
        if (statusGeneration !== repoGeneration.current) return
        const chunk: string[] = []
        let bytes = 0
        for (const path of remaining) {
          const nextBytes = encoder.encode(path).length + 1
          if (chunk.length > 0 && (chunk.length >= 500 || bytes + nextBytes > 48 * 1024)) break
          chunk.push(path)
          bytes += nextBytes
        }
        const result = await stagePaths(chunk, repoPath || undefined)
        if (statusGeneration !== repoGeneration.current) return
        if (!result.ok) throw new Error(result.error || t('stageFailed'))
        stagedCount += chunk.length
        remaining = remaining.slice(chunk.length)
        const done = new Set(chunk)
        setBatchSelected((current) => new Set([...current].filter((path) => !done.has(path))))
      }
      showToast(t('batchStageDone') + ' · ' + String(stagedCount))
    } catch (error) {
      if (statusGeneration !== repoGeneration.current) return
      const detail = error instanceof Error ? error.message : String(error)
      const message = t('batchStagePartial') + ' · ' + t('batchStageConfirmed') + ': ' + String(stagedCount) + ' · ' + detail
      setActionError(message)
      showToast(message)
    } finally {
      await loadStatus()
      busyRef.current = false
      setBusy(false)
    }
  }, [batchSelected, loadStatus, repoPath, showToast, status, statusGeneration, t])

  const submitBatchRemove = React.useCallback(async () => {
    const paths = dialog?.paths ?? []
    if (paths.length === 0 || dialog?.generation !== repoGeneration.current || statusGeneration !== repoGeneration.current) return
    busyRef.current = true
    setBusy(true)
    setDialogBusy(true)
    setDialogError('')
    let remaining = paths.slice()
    const failures: string[] = []
    const retryPaths: string[] = []
    let removedCount = 0
    try {
      while (remaining.length > 0) {
        if (statusGeneration !== repoGeneration.current) return
        const chunk = remaining.slice(0, 500)
        const result = await removePaths(chunk, true, repoPath || undefined)
        if (statusGeneration !== repoGeneration.current) return
        if (!result.ok && !result.failed) throw new Error(result.error || t('batchRemoveFailed'))
        removedCount += (result.removed ?? []).length
        failures.push(...(result.failed ?? []).map((item) => item.path + (item.error ? ' — ' + item.error : '')))
        const failedPaths = (result.failed ?? []).map((item) => item.path)
        remaining = remaining.slice(chunk.length)
        if (failedPaths.length) {
          // Process later chunks too, but keep failed paths for the retry dialog.
          retryPaths.push(...failedPaths)
        }
      }
      if (failures.length) throw new Error(t('batchRemoveFailed') + ': ' + failures.join('; '))
      closeDialog()
      const deleted = new Set(paths)
      setBatchSelected((current) => new Set([...current].filter((path) => !deleted.has(path))))
      showToast(t('batchRemoveDone') + ' · ' + String(removedCount))
      if (selected && paths.includes(selected.path)) {
        setSelected(null)
        setDiff(null)
      }
    } catch (error) {
      if (statusGeneration !== repoGeneration.current) return
      const pending = [...retryPaths, ...remaining]
      const pendingSet = new Set(pending)
      const removed = new Set(paths.filter((path) => !pendingSet.has(path)))
      setDialog((current) => current?.kind === 'remove-untracked-batch' ? { ...current, paths: pending } : current)
      setBatchSelected((current) => new Set([...current].filter((path) => !removed.has(path))))
      setDialogError((removedCount ? t('batchRemoveDone') + ': ' + removedCount + '. ' : '') +
        (error instanceof Error ? error.message : String(error)))
    } finally {
      await loadStatus()
      busyRef.current = false
      setBusy(false)
      setDialogBusy(false)
    }
  }, [closeDialog, dialog?.generation, dialog?.paths, loadStatus, repoPath, selected, showToast, statusGeneration, t])

  const submitPush = React.useCallback(async () => {
    setDialogBusy(true)
    setDialogError('')
    try {
      const result = await pushBranch(repoPath || undefined)
      if (!result.ok) throw new Error(result.error || t('pushFailed'))
      closeDialog()
      showToast(t('pushed') + ' · ' + (result.upstream || status?.branch || ''))
      await afterPush()
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : String(error))
    } finally {
      setDialogBusy(false)
    }
  }, [afterPush, closeDialog, repoPath, showToast, status?.branch, t])

  const submitMerge = React.useCallback(async () => {
    const branch = dialog?.branch ?? ''
    setDialogBusy(true)
    setDialogError('')
    try {
      const result = await mergeBranch(branch, repoPath || undefined)
      if (!result.ok) throw new Error(result.error || t('mergeFailed'))
      closeDialog()
      showToast(t('merged') + ' · ' + branch)
      setSelected(null)
      setDiff(null)
      setHistorySha('')
      await loadStatus()
      await loadRefs()
      if (view !== 'status') await loadHistory(true)
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : String(error))
      await loadStatus()
      await loadRefs()
    } finally {
      setDialogBusy(false)
    }
  }, [closeDialog, dialog?.branch, loadHistory, loadRefs, loadStatus, repoPath, showToast, t, view])

  const refMenu = (record: RefRecord, kind: RefKind, event: any) => {
    const items: ContextMenuEntry[] =
      kind !== 'branch'
        ? [
            { label: t('history'), onSelect: () => openRef(record, kind) },
            { label: t('copyRefName'), onSelect: () => copyText(record.name, t('copiedPath')) },
            ...(kind === 'remote' ? [{
              label: t('deleteRemoteBranch'), danger: true,
              onSelect: () => requestRemoteDelete(record),
            }] : []),
          ]
        : [
            {
              label: t('checkout'),
              disabled: record.current,
              hint: record.current ? t('currentBranchCannotDelete') : undefined,
              onSelect: () => void checkout(record.name),
            },
            {
              label: t('mergeIntoCurrent'),
              disabled: record.current,
              hint: record.current ? t('mergeSelfHint') : undefined,
              onSelect: () => { setDialogError(''); setDialog({ kind: 'merge', branch: record.name }) },
            },
            { label: t('renameBranch'), onSelect: () => { setDialogError(''); setDialog({ kind: 'rename', branch: record.name }) } },
            {
              label: t('deleteBranch'),
              danger: true,
              disabled: record.current,
              hint: record.current ? t('currentBranchCannotDelete') : undefined,
              onSelect: () => requestBranchDelete(record.name),
            },
            {
              label: t('forceDeleteBranch'),
              danger: true,
              disabled: record.current,
              hint: record.current ? t('currentBranchCannotDelete') : undefined,
              onSelect: () => requestBranchDelete(record.name, true),
            },
            { divider: true },
            { label: t('copyRefName'), onSelect: () => copyText(record.name, t('copiedPath')) },
          ]
    setContextMenu({ x: event.clientX, y: event.clientY, title: record.name, items })
  }

  const commitMenu = (commit: HistoryCommit, event: any) => {
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      title: commit.sha.slice(0, 12),
      items: [
        { label: t('copySha'), onSelect: () => copyText(commit.sha, t('copiedPath')) },
        {
          label: t('branchFromCommit'),
          onSelect: () => {
            setDialogError('')
            setDialog({ kind: 'create', start: commit.sha })
          },
        },
        { label: t('copyCommitMessage'), onSelect: () => copyText(commit.subject, t('copiedPath')) },
      ],
    })
  }

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

  /** Ask the model to merge one conflicted file; nothing is written yet. */
  const resolveConflictWithAi = React.useCallback(
    async (path: string) => {
      const generation = statusGeneration
      if (generation !== repoGeneration.current) return
      setConflictBusy('resolve')
      setActionError('')
      setConflictError('')
      try {
        const result = await resolveConflict(path, repoPath || undefined)
        if (generation !== repoGeneration.current) return
        if (!result.ok || typeof result.content !== 'string' || !result.sourceHash) {
          throw new Error(result.error || t('mergeModelFailed'))
        }
        setConflictResolve({
          path,
          content: result.content,
          sourceHash: result.sourceHash,
          generation,
          diff: { ok: true, files: result.diff?.files, stats: result.diff?.stats },
          provider: result.provider || '',
          model: result.model || '',
        })
      } catch (error) {
        if (generation !== repoGeneration.current) return
        const text = error instanceof Error ? error.message : String(error)
        setActionError(text)
        showToast(text)
      } finally {
        if (generation === repoGeneration.current) setConflictBusy('')
      }
    },
    [repoPath, showToast, statusGeneration, t],
  )

  /** The conflict-block count for one path, read from the open diff or fetched. */
  const conflictBlocksOf = React.useCallback(
    async (path: string): Promise<number> => {
      if (selected?.path === path && diff?.conflict) return diff.conflict.blocks
      try {
        const payload = await fetchDiff({ path, side: 'conflicted', cwd: repoPath || undefined })
        return payload?.conflict?.blocks ?? 0
      } catch {
        // An uncounted file still gets a prompt; the count line is optional.
        return 0
      }
    },
    [diff, repoPath, selected],
  )

  /**
   * Hand the conflicted file to a DSH session: match the repository to its
   * workspace, open the blank Session and leave the prompt in the composer
   * (never sent). Nothing is written, staged or committed by this panel.
   */
  const handoffConflict = React.useCallback(
    async (path: string) => {
      setActionError('')
      setHandoffBusy(true)
      const repo = status?.repoRoot || status?.cwd || repoPath || ''
      const blocks = await conflictBlocksOf(path)
      const prompt = buildConflictPrompt({ repo, path, branch: status?.branch || '', blocks }, t)
      const result: HandoffResult | 'failed' = props.handoff ? props.handoff.open(repo, prompt) : 'unavailable'
      // Every failure hands the prompt over: the click already asked for it, and
      // the dialog stays up only to explain why no session opened.
      const fallBack = async (reason: HandoffFailure) => {
        setHandoffBusy(false)
        // The click already asked for this text, so hand it over silently; the
        // dialog explains the reason and only shows the prompt if copying failed.
        const copied = await copyText(prompt, t('handoffCopied'), t('handoffCopyFailed'))
        setHandoffDialog({ prompt, reason, copyFailed: !copied })
      }
      if (result !== 'requested') {
        void fallBack(result)
        return
      }
      // The panel is replaced by the session; if that never happens (the host
      // refused it), recover instead of leaving a dead busy button.
      if (handoffTimer.current) clearTimeout(handoffTimer.current)
      handoffTimer.current = setTimeout(() => void fallBack('failed'), 4000)
    },
    [conflictBlocksOf, copyText, props.handoff, repoPath, status, t],
  )

  /** Copy button inside the fallback dialog (re-copy, or copy after editing). */
  const copyHandoffPrompt = React.useCallback(() => {
    void copyText(handoffDialog?.prompt ?? '', t('handoffCopied'), t('handoffCopyFailed'))
  }, [copyText, handoffDialog, t])

  const refreshAfterConflict = React.useCallback(
    async (path: string) => {
      const generation = statusGeneration
      if (generation !== repoGeneration.current) return
      const next = await loadStatus({ silent: true })
      if (generation !== repoGeneration.current) return
      const updated = next?.ok ? findEntry(next, path) : null
      if (updated) await openDiff(updated, 'conflicted')
    },
    [openDiff, repoPath, loadStatus, statusGeneration],
  )

  const applyConflictResolution = React.useCallback(async () => {
    const pending = conflictResolve
    if (!pending || pending.generation !== repoGeneration.current) return
    setConflictBusy('apply')
    setConflictError('')
    try {
      const result = await applyConflict(pending.path, pending.content, pending.sourceHash, repoPath || undefined)
      if (pending.generation !== repoGeneration.current) return
      if (!result.ok) throw new Error(result.error || t('conflictApplyFailed'))
      setConflictResolve(null)
      showToast(t('resolutionApplied') + ' · ' + pending.path)
      await refreshAfterConflict(pending.path)
      await loadRefs()
    } catch (error) {
      if (pending.generation === repoGeneration.current) setConflictError(error instanceof Error ? error.message : String(error))
    } finally {
      if (pending.generation === repoGeneration.current) setConflictBusy('')
    }
  }, [conflictResolve, loadRefs, refreshAfterConflict, repoPath, showToast, t])

  const submitConflictRevert = React.useCallback(async () => {
    const path = dialog?.path ?? ''
    setDialogBusy(true)
    setDialogError('')
    try {
      const result = await revertConflict(path, repoPath || undefined)
      if (!result.ok) throw new Error(result.error || t('conflictRevertFailed'))
      closeDialog()
      showToast(t('conflictReverted') + ' · ' + path)
      await refreshAfterConflict(path)
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : String(error))
    } finally {
      setDialogBusy(false)
    }
  }, [closeDialog, dialog?.path, refreshAfterConflict, repoPath, showToast, t])

  const markResolved = React.useCallback(
    async (path: string) => {
      setConflictBusy('mark')
      setActionError('')
      try {
        const result = await markConflictResolved(path, repoPath || undefined)
        if (!result.ok) throw new Error(result.error || t('markResolvedFailed'))
        showToast(t('resolvedMarked') + ' · ' + path)
        await refreshAfterConflict(path)
        await loadRefs()
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error)
        setActionError(text)
        showToast(text)
      } finally {
        setConflictBusy('')
      }
    },
    [loadRefs, refreshAfterConflict, repoPath, showToast, t],
  )

  // The diff header's conflict actions: one stable handler each, so the memoised
  // pane keeps its identity while the list around it re-renders.
  const conflictHandoff = React.useCallback(() => {
    if (selected) void handoffConflict(selected.path)
  }, [handoffConflict, selected])

  const conflictRevert = React.useCallback(() => {
    if (!selected) return
    setDialogError('')
    setDialog({ kind: 'conflict-revert', path: selected.path })
  }, [selected])

  const conflictMarkResolved = React.useCallback(() => {
    if (selected) void markResolved(selected.path)
  }, [markResolved, selected])

  /** Right-click menu for one row. Stable: the list hands it to every row. */
  const fileMenu = React.useCallback(
    (entry: GitFileEntry, side: EntrySide, event: any) => {
      if (busyRef.current) return
      const conflict = side === 'conflicted' || entry.conflicted
      const untracked = entry.kind === 'untracked'
      const items: ContextMenuEntry[] = []
      if (conflict) {
        // One primary hand-off, plus the older in-panel model merge kept as a
        // deliberate secondary (it writes the file itself, the session does not).
        items.push({ label: t('handoff'), onSelect: () => void handoffConflict(entry.path) })
        items.push({
          label: t('modelMergePreview'),
          disabled: conflictBusy !== '',
          onSelect: () => void resolveConflictWithAi(entry.path),
        })
        items.push({ divider: true })
      }
      items.push(
        {
          label: t('commitThis'),
          disabled: conflict,
          hint: conflict ? t('conflictsBlockCommit') : '⌘↵',
          onSelect: () => void commitThis(entry, side),
        },
        { divider: true },
      )
      if (!conflict) {
        items.push({
          label: side === 'staged' ? t('unstageFile') : t('stageFile'),
          onSelect: () => void toggle(entry, side),
        })
      }
      if (!untracked) {
        items.push({
          label: t('discardChanges'),
          danger: true,
          disabled: conflict,
          hint: conflict ? t('conflictsBlockCommit') : undefined,
          onSelect: () => {
            setDialogError('')
            setDialog({ kind: 'discard', path: entry.path, side })
          },
        })
      }
      items.push({
        label: untracked ? t('removeUntracked') : t('removeFile'),
        danger: true,
        onSelect: () => {
          setDialogError('')
          setDialog({ kind: untracked ? 'remove-untracked' : 'remove', path: entry.path })
        },
      })
      items.push({ divider: true })
      items.push({ label: t('copyPath'), onSelect: () => copyPath(entry) })
      setContextMenu({ x: event.clientX, y: event.clientY, title: entry.path, items })
    },
    [commitThis, conflictBusy, copyPath, handoffConflict, resolveConflictWithAi, t, toggle],
  )

  /** Fetch only: updates ahead/behind and remote-tracking refs, never the tree. */
  const fetchNow = React.useCallback(
    async (options?: { silent?: boolean }) => {
      const generation = statusGeneration
      if (generation !== repoGeneration.current) return
      setFetching(true)
      try {
        const result = await fetchRemote(repoPath || undefined)
        if (generation !== repoGeneration.current) return
        if (!result.ok) throw new Error(result.error || t('fetchFailed'))
        await loadStatus({ silent: true })
        await loadRefs()
        if (view !== 'status') await loadHistory(true)
        if (!options?.silent) showToast(t('fetched') + (result.remote ? ' · ' + result.remote : ''))
      } catch (error) {
        if (generation !== repoGeneration.current) return
        if (!options?.silent) {
          const text = error instanceof Error ? error.message : String(error)
          setActionError(text)
          showToast(text)
        }
      } finally {
        if (generation === repoGeneration.current) setFetching(false)
      }
    },
    [loadHistory, loadRefs, loadStatus, repoPath, showToast, statusGeneration, t, view],
  )

  /** Pull the current branch: fast-forward, or merge when the user asks for it. */
  const pullNow = React.useCallback(
    async (mode: 'ff-only' | 'merge') => {
      setPulling(true)
      setActionError('')
      try {
        const result = await pullBranch(mode, repoPath || undefined)
        if (!result.ok) {
          if (result.code === 'diverged' && mode === 'ff-only') {
            setDialogError('')
            setDialog({ kind: 'pull-diverged' })
            return
          }
          throw new Error(result.error || t('pullFailed'))
        }
        closeDialog()
        const count = result.pulled ?? 0
        showToast(count > 0 ? t('pulled') + ' · ' + String(count) + ' ' + t('commitsUnit') : t('pullUpToDate'))
        await afterPush()
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error)
        setActionError(text)
        showToast(text)
        await loadStatus({ silent: true })
      } finally {
        setPulling(false)
      }
    },
    [afterPush, closeDialog, loadStatus, repoPath, showToast, t],
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
      const receipt = [t('commitDone'), result.shortSha, result.subject].filter(Boolean).join(' · ')
      setMessage('')
      setSelected(null)
      setDiff(null)
      if (pushAfter) {
        let note = ''
        try {
          const pushed = await pushBranch(repoPath || undefined)
          note = pushed.ok
            ? ' · ' + t('pushed')
            : ' · ' + t('pushFailed') + '：' + (pushed.error || '')
        } catch (error) {
          note = ' · ' + t('pushFailed') + '：' + (error instanceof Error ? error.message : String(error))
        }
        showToast(receipt + note)
      } else {
        showToast(receipt)
      }
      setPushAfter(false)
      await afterPush()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }, [afterPush, message, pushAfter, repoPath, showToast, status, t])

  // One arrow for the commit card's primary button: `commit` changes whenever the
  // draft or the status it commits changes, so this stays put between those.
  const commitAction = React.useCallback(() => {
    void commit()
  }, [commit])

  const switchWorkspace = React.useCallback(
    (path: string) => {
      if (path === repoPath) return
      repoGeneration.current += 1
      selectedRef.current = null
      setRefs(null)
      setConflictResolve(null)
      setConflictBusy('')
      setAiBusy(false)
      setFetching(false)
      setPulling(false)
      setHistoryLoading(false)
      setCommitDetailLoading(false)
      setCommitFileDiffLoading(false)
      setDiffLoading(false)
      setStatus(null)
      setStatusError('')
      setDialog(null)
      setDialogBusy(false)
      setRepoPath(path)
      setBatchSelected(new Set())
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
      setHistoryScope('all')
      setHistoryCommits([])
      setHistorySha('')
      setPushAfter(false)
      // Count the switch, then re-read the ordered list (pins and counts moved).
      void recordRepositoryOpen(path)
        .then(() => loadWorkspaces())
        .catch(() => {})
    },
    [loadWorkspaces, repoPath],
  )

  const toggleRepositoryPin = React.useCallback(
    async (path: string, pinned: boolean) => {
      try {
        const result = await setRepositoryPin(path, pinned)
        if (!result.ok) throw new Error(result.error || t('pinFailed'))
        await loadWorkspaces()
        showToast(pinned ? t('pinnedDone') + ' · ' + path : t('unpinnedDone') + ' · ' + path)
      } catch (error) {
        showToast(error instanceof Error ? error.message : String(error))
      }
    },
    [loadWorkspaces, showToast, t],
  )

  React.useEffect(() => {
    if (!status) return
    const eligible = new Set((status.entries ?? []).filter((entry) => entry.unstaged && !entry.conflicted).map((entry) => entry.path))
    setBatchSelected((current) => {
      const next = new Set([...current].filter((path) => eligible.has(path)))
      return next.size === current.size ? current : next
    })
  }, [status])

  const entries = status?.entries ?? []
  const rows = splitEntries(entries)
  // Stable identities for the row props: the change list re-renders on every
  // selection tick, and each row can skip that unless its own flag moved.
  const toggleBatchPath = React.useCallback((path: string) => {
    if (busyRef.current) return
    setBatchSelected((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])
  const selectAllUnstaged = React.useCallback(() => {
    if (!busyRef.current) setBatchSelected(new Set(rows.unstaged.map((entry) => entry.path)))
  }, [rows])
  const clearBatchSelection = React.useCallback(() => {
    if (!busyRef.current) setBatchSelected(new Set())
  }, [])
  const stageBatch = React.useCallback(() => void submitBatchStage(), [submitBatchStage])
  const copyBatchPaths = React.useCallback(
    () => void copyText([...batchSelected].join('\n'), t('copiedPaths'), t('copyFailed')),
    [batchSelected, copyText, t],
  )
  const removeBatch = React.useCallback(() => {
    const paths = rows.unstaged.filter((entry) => entry.kind === 'untracked' && batchSelected.has(entry.path)).map((entry) => entry.path)
    if (paths.length === 0) return
    setDialogError('')
    setDialog({ kind: 'remove-untracked-batch', paths, generation: statusGeneration })
  }, [batchSelected, rows, statusGeneration])
  const selectedKey = selected ? rowKey(selected.path, selected.side) : ''
  const selectedEntry = selected ? findEntry(status, selected.path) : null
  const diffSelection = selected && selectedEntry ? { entry: selectedEntry, side: selected.side } : null
  const truncated = status?.truncated === true
  const canPush = (status?.remotes?.length ?? 0) > 0
  const canFetch = canPush

  // Fresh ahead/behind numbers on open / repository switch, without nagging:
  // the automatic fetch stays silent, manual ones report.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await fetchRemote(repoPath || undefined).catch(() => null)
      if (cancelled || !result || !result.ok) return
      await loadStatus({ silent: true })
      await loadRefs()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath])

  const autoSelectRef = React.useRef('')
  React.useEffect(() => {
    if (view !== 'status' || status === null) return
    const key = (repoPath || status.cwd || '') + '|' + (status.oid || '')
    if (autoSelectRef.current === key) return
    autoSelectRef.current = key
    if (selected !== null) return
    const split = splitEntries(status.entries ?? [])
    // Prefer an entry that actually has a diff: untracked files open onto an
    // empty pane, which made the primary screen look blank.
    const tracked = (list: GitFileEntry[]) => list.find((entry) => entry.kind !== 'untracked')
    const first =
      split.conflicted[0] ??
      tracked(split.staged) ??
      tracked(split.unstaged) ??
      split.staged[0] ??
      split.unstaged[0]
    if (!first) return
    const side: EntrySide = split.conflicted.includes(first)
      ? 'conflicted'
      : split.staged.includes(first)
        ? 'staged'
        : 'unstaged'
    void openDiff(first, side)
  }, [status, view, selected, repoPath, openDiff])

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
          error: historyScope.startsWith('remote:') && refs?.ok &&
            !(refs.remotes ?? []).some((record) => 'remote:' + record.name === historyScope)
              ? t('remoteBranchGone') : historyError,
          scope: historyScope,
          selectedSha: historySha,
          detail: historySha === '' ? null : commitDetail,
          detailLoading: historySha === '' ? false : commitDetailLoading,
          detailError: historySha === '' ? '' : commitDetailError,
          selectedFile: historySha === '' ? '' : commitFile,
          fileDiff: historySha === '' ? null : commitFileDiff,
          fileDiffLoading: historySha === '' ? false : commitFileDiffLoading,
          t,
          onScope: (scope: HistoryScope) => {
            setHistoryScope(scope)
            setHistorySha('')
          },
          onClearScope: () => {
            setHistoryScope('all')
            setHistorySha('')
          },
          onSelect: (commit: HistoryCommit) => selectCommit(commit.sha),
          onSelectFile: (path: string) => void openCommitFile(path),
          onParent: selectCommit,
          onContextMenu: (commit: HistoryCommit, event: any) => commitMenu(commit, event),
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
          batchSelected,
          onBatchSelect: toggleBatchPath,
          onBatchSelectAll: selectAllUnstaged,
          onBatchClear: clearBatchSelection,
          onBatchStage: stageBatch,
          onBatchCopy: copyBatchPaths,
          onBatchRemove: removeBatch,
          diffSelection,
          diff,
          diffLoading,
          message,
          busy,
          actionError,
          t,
          commitInputRef: commitInput,
          commitCollapsed,
          onToggleCommitCollapsed: toggleCommitFold,
          conflict: {
            busy: conflictBusy !== '',
            opening: handoffBusy,
            onHandoff: conflictHandoff,
            onRevert: conflictRevert,
            onMarkResolved: conflictMarkResolved,
          },
          // Stable callbacks, not arrows: the diff pane and the commit card are
          // memoised on their props. `openDiff`/`toggle`/`copyPath`/`fileMenu` are
          // the useCallbacks themselves, so a list-only render leaves both alone.
          onSelect: openDiff,
          onToggle: toggle,
          onCopyPath: copyPath,
          onContextMenu: fileMenu,
          canPush,
          pushAfter,
          onPushAfter: setPushAfter,
          onMessage: setMessage,
          onCommit: commitAction,
          ai: aiCommit,
        })
    }
  }

  return h(
    'div',
    {
      className: 'dgt-root',
      'data-plugin': 'dsh-git-tree',
      onPointerEnter: () => wakePollRef.current?.(),
    },
    h(TopBar, {
      status,
      workspaces,
      currentPath: repoPath || status?.repoRoot || status?.cwd || '',
      busy: refreshing || busy,
      opening,
      t,
      onRefresh: () => void refreshAll(),
      onOpen: (target: OpenTarget) => void openLocalAction(target),
      onSelectWorkspace: switchWorkspace,
      onTogglePin: (path: string, pinned: boolean) => void toggleRepositoryPin(path, pinned),
      canPush,
      canFetch,
      hasUpstream: Boolean(status?.upstream),
      fetching,
      pulling,
      onFetch: () => void fetchNow(),
      onPull: () => void pullNow('ff-only'),
      onPush: () => {
        setDialogError('')
        setDialog({ kind: 'push' })
      },
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
          onMerge: (name: string) => {
            setDialogError('')
            setDialog({ kind: 'merge', branch: name })
          },
          onCopyRef: copyRef,
          onContextMenu: (record: RefRecord, kind: RefKind, event: any) => refMenu(record, kind, event),
          onCreate: () => {
            setDialogError('')
            setDialog({ kind: 'create' })
          },
          onRename: (name: string) => {
            setDialogError('')
            setDialog({ kind: 'rename', branch: name })
          },
          onDelete: (name: string) => requestBranchDelete(name),
          onForceDelete: (name: string) => requestBranchDelete(name, true),
          onDeleteRemote: requestRemoteDelete,
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
    dialog?.kind === 'delete' || dialog?.kind === 'delete-remote'
      ? h(ConfirmDialog, {
          key: dialog.kind + ':' + dialog.branch + ':' + dialog.force,
          title: t(dialog.kind === 'delete-remote' ? 'deleteRemoteBranch' : dialog.force ? 'forceDeleteBranch' : 'deleteBranch'),
          body: (dialog.branch ?? '') + ' — ' + t(dialog.kind === 'delete-remote' ? 'deleteRemoteBranchConfirm' : dialog.force ? 'forceDeleteBranchConfirm' : 'deleteBranchConfirm'),
          submitLabel: t('delete'),
          busy: dialogBusy,
          error: dialogError,
          t,
          onCancel: () => { if (!dialogBusy) closeDialog() },
          onConfirm: () => void submitDelete(),
        })
      : null,
    handoffDialog
      ? h(HandoffDialog, {
          reason: handoffDialog.reason,
          prompt: handoffDialog.prompt,
          copyFailed: handoffDialog.copyFailed,
          t,
          onCopy: copyHandoffPrompt,
          onClose: () => setHandoffDialog(null),
        })
      : null,
    conflictResolve
      ? h(ConflictDialog, {
          path: conflictResolve.path,
          content: conflictResolve.content,
          diff: conflictResolve.diff,
          provider: conflictResolve.provider,
          model: conflictResolve.model,
          busy: conflictBusy === 'apply',
          error: conflictError,
          t,
          onCancel: () => {
            setConflictResolve(null)
            setConflictError('')
          },
          onApply: () => void applyConflictResolution(),
        })
      : null,
    contextMenu ? h(ContextMenu, { state: contextMenu, onClose: () => setContextMenu(null) }) : null,
    dialog?.kind === 'push'
      ? h(ConfirmDialog, {
          title: t('pushTitle'),
          body: status?.upstream
            ? (status?.branch || '—') +
              ' → ' +
              status.upstream +
              ' · ' +
              String(status?.ahead ?? 0) +
              ' ' +
              t('ahead') +
              ' · ' +
              t('pushBody')
            : (status?.branch || '—') + ' · ' + t('pushFirst') + ' · ' + t('pushBody'),
          submitLabel: t('push'),
          tone: 'primary',
          busy: dialogBusy,
          error: dialogError,
          t,
          onCancel: closeDialog,
          onConfirm: () => void submitPush(),
        })
      : null,
    dialog?.kind === 'pull-diverged'
      ? h(ConfirmDialog, {
          title: t('pullDivergedTitle'),
          body:
            (status?.branch || '—') +
            ' ↔ ' +
            (status?.upstream || 'origin') +
            ' · ' +
            t('pullDivergedBody'),
          submitLabel: t('pullMerge'),
          tone: 'primary',
          busy: pulling,
          error: dialogError,
          t,
          onCancel: closeDialog,
          onConfirm: () => void pullNow('merge'),
        })
      : null,
    dialog?.kind === 'merge'
      ? h(ConfirmDialog, {
          title: t('mergeTitle'),
          body: (dialog.branch ?? '') + ' — ' + t('mergeBody') + ' (' + (status?.branch || '—') + ')',
          submitLabel: t('mergeIntoCurrent'),
          tone: 'primary',
          busy: dialogBusy,
          error: dialogError,
          t,
          onCancel: closeDialog,
          onConfirm: () => void submitMerge(),
        })
      : null,
    dialog?.kind === 'discard'
      ? h(ConfirmDialog, {
          title: t('discardTitle'),
          body: (dialog.path ?? '') + ' — ' + t('discardBody'),
          submitLabel: t('discardChanges'),
          busy: dialogBusy,
          error: dialogError,
          t,
          onCancel: closeDialog,
          onConfirm: () => void submitDiscard(),
        })
      : null,
    dialog?.kind === 'conflict-revert'
      ? h(ConfirmDialog, {
          title: t('revertConflictTitle'),
          body: (dialog.path ?? '') + ' — ' + t('revertConflictBody'),
          submitLabel: t('revertConflict'),
          busy: dialogBusy,
          error: dialogError,
          t,
          onCancel: closeDialog,
          onConfirm: () => void submitConflictRevert(),
        })
      : null,
    dialog?.kind === 'remove-untracked-batch'
      ? h(ConfirmDialog, {
          title: t('batchRemoveTitle'),
          body: String(dialog.paths?.length ?? 0) + ' ' + t('batchRemoveBody'),
          submitLabel: t('deleteSelectedUntracked'),
          busy: dialogBusy,
          error: dialogError,
          t,
          onCancel: () => { if (!dialogBusy) closeDialog() },
          onConfirm: () => void submitBatchRemove(),
        })
      : null,
    dialog?.kind === 'remove' || dialog?.kind === 'remove-untracked'
      ? h(ConfirmDialog, {
          title: t('removeTitle'),
          body:
            (dialog.path ?? '') +
            ' — ' +
            (dialog.kind === 'remove-untracked' ? t('removeUntrackedBody') : t('removeBody')),
          submitLabel: t('removeFile'),
          busy: dialogBusy,
          error: dialogError,
          t,
          onCancel: closeDialog,
          onConfirm: () => void submitRemove(),
        })
      : null,
    toast ? h('div', { className: 'dgt-toast', role: 'status' }, toast) : null,
    notice ? h('div', { className: 'dgt-toast', role: 'status' }, notice) : null,
  )
}
