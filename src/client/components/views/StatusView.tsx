// File status view: the change list, the diff and the commit box. The workspace
// shell owns all state and host calls; this view only lays the status surface
// out, so history and search can be swapped in beside it.
//
// This is also the seam where the two expensive children are fitted with stable
// props: the shell rebuilds its handlers and value objects every render (a
// checkbox click in the list is a status render too), while the diff pane and
// the commit card must keep their identity. Anything handed to them below keeps
// the identity it had, unless its own content moved.

import { h, React } from '../../react'
import type {
  AiCommitControls,
  DiffPayload,
  EntrySide,
  GitFileEntry,
  GitStatusPayload,
  Translate,
} from '../../types'
import { ChangeList } from '../ChangeList'
import { DiffView } from '../DiffView'
import { CommitBox } from '../CommitBox'

/**
 * The commit card renders a handful of nodes but shares a parent with the change
 * list: without memo it redraws for every batch-selection change in the list.
 * It is only memoised here (the card module is untouched); the `ai` object and
 * the handlers below are what make the comparison hold.
 */
const MemoCommitBox = React.memo(CommitBox)

export function StatusView(props: {
  status: GitStatusPayload | null
  statusError: string
  rows: { staged: GitFileEntry[]; unstaged: GitFileEntry[]; conflicted: GitFileEntry[] }
  entries: GitFileEntry[]
  selectedKey: string
  batchSelected: Set<string>
  onBatchSelect: (path: string) => void
  onBatchSelectAll: () => void
  onBatchClear: () => void
  onBatchStage: () => void
  onBatchCopy: () => void
  onBatchRemove: () => void
  diffSelection: { entry: GitFileEntry; side: EntrySide } | null
  diff: DiffPayload | null
  diffLoading: boolean
  message: string
  busy: boolean
  actionError: string
  t: Translate
  commitInputRef: any
  onSelect: (entry: GitFileEntry, side: EntrySide) => void
  onToggle: (entry: GitFileEntry, side: EntrySide) => void
  onCopyPath: (entry: GitFileEntry) => void
  onContextMenu: (entry: GitFileEntry, side: EntrySide, event: any) => void
  onMessage: (value: string) => void
  onCommit: () => void
  canPush: boolean
  pushAfter: boolean
  onPushAfter: (value: boolean) => void
  commitCollapsed: boolean
  onToggleCommitCollapsed: () => void
  conflict: {
    busy: boolean
    opening: boolean
    onHandoff: () => void
    onRevert: () => void
    onMarkResolved: () => void
  }
  ai: AiCommitControls
}): any {
  const { t } = props

  // Both objects arrive freshly built from the shell. Rebuild them here from
  // their fields so an unchanged diff/commit surface keeps the same identity.
  const conflict = React.useMemo(
    () => ({
      busy: props.conflict.busy,
      opening: props.conflict.opening,
      onHandoff: props.conflict.onHandoff,
      onRevert: props.conflict.onRevert,
      onMarkResolved: props.conflict.onMarkResolved,
    }),
    [
      props.conflict.busy,
      props.conflict.opening,
      props.conflict.onHandoff,
      props.conflict.onRevert,
      props.conflict.onMarkResolved,
    ],
  )
  const ai: AiCommitControls = React.useMemo(
    () => ({
      loading: props.ai.loading,
      busy: props.ai.busy,
      groups: props.ai.groups,
      failures: props.ai.failures,
      active: props.ai.active,
      error: props.ai.error,
      onGenerate: props.ai.onGenerate,
      onSelect: props.ai.onSelect,
    }),
    [
      props.ai.loading,
      props.ai.busy,
      props.ai.groups,
      props.ai.failures,
      props.ai.active,
      props.ai.error,
      props.ai.onGenerate,
      props.ai.onSelect,
    ],
  )

  return h(
    'div',
    { className: 'dgt-main' },
    h(
      'div',
      { className: 'dgt-panes' },
      h(ChangeList, {
        status: props.status,
        statusError: props.statusError,
        rows: props.rows,
        selectedKey: props.selectedKey,
        batchSelected: props.batchSelected,
        onBatchSelect: props.onBatchSelect,
        onBatchSelectAll: props.onBatchSelectAll,
        onBatchClear: props.onBatchClear,
        onBatchStage: props.onBatchStage,
        onBatchCopy: props.onBatchCopy,
        onBatchRemove: props.onBatchRemove,
        batchBusy: props.busy,
        t,
        onSelect: props.onSelect,
        onToggle: props.onToggle,
        onCopyPath: props.onCopyPath,
        onContextMenu: props.onContextMenu,
      }),
      h(
        'div',
        { className: 'dgt-right' },
        h(DiffView, {
          entry: props.diffSelection ? props.diffSelection.entry : null,
          side: props.diffSelection ? props.diffSelection.side : 'unstaged',
          diff: props.diff,
          loading: props.diffLoading,
          hasChanges: props.entries.length > 0,
          t,
          onToggle: props.onToggle,
          conflict,
        }),
        h(MemoCommitBox, {
          status: props.status,
          message: props.message,
          busy: props.busy,
          hint: props.actionError,
          hintTone: props.actionError ? 'error' : 'muted',
          t,
          inputRef: props.commitInputRef,
          canPush: props.canPush,
          pushAfter: props.pushAfter,
          onPushAfter: props.onPushAfter,
          onMessage: props.onMessage,
          onCommit: props.onCommit,
          collapsed: props.commitCollapsed,
          onToggleCollapsed: props.onToggleCommitCollapsed,
          ai,
        }),
      ),
    ),
  )
}
