// File status view: the change list, the diff and the commit box. The workspace
// shell owns all state and host calls; this view only lays the status surface
// out, so history and search can be swapped in beside it.

import { h } from '../../react'
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

export function StatusView(props: {
  status: GitStatusPayload | null
  statusError: string
  rows: { staged: GitFileEntry[]; unstaged: GitFileEntry[]; conflicted: GitFileEntry[] }
  entries: GitFileEntry[]
  selectedKey: string
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
  ai: AiCommitControls
}): any {
  const { t } = props

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
          selected: props.diffSelection,
          diff: props.diff,
          loading: props.diffLoading,
          hasChanges: props.entries.length > 0,
          t,
          onToggleFile: () => {
            if (props.diffSelection) props.onToggle(props.diffSelection.entry, props.diffSelection.side)
          },
        }),
        h(CommitBox, {
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
          ai: props.ai,
        }),
      ),
    ),
  )
}
