// Change list pane: conflict, staged and unstaged groups with counts, plus the
// loading and empty states.

import { h } from '../react'
import { FileRow } from './FileRow'
import type { EntrySide, GitFileEntry, GitStatusPayload, Translate } from '../types'

function Group(props: {
  label: string
  tone?: 'error'
  rows: GitFileEntry[]
  side: EntrySide
  activeKey: string
  t: Translate
  onSelect: (entry: GitFileEntry, side: EntrySide) => void
  onToggle: (entry: GitFileEntry, side: EntrySide) => void
  onCopyPath: (entry: GitFileEntry) => void
  onContextMenu: (entry: GitFileEntry, side: EntrySide, event: any) => void
}): any {
  if (props.rows.length === 0) return null
  return h(
    'div',
    { className: 'dgt-group-wrap' },
    h(
      'div',
      { className: 'dgt-group', 'data-tone': props.tone },
      h('span', null, props.label),
      h('span', { className: 'dgt-group-count' }, String(props.rows.length)),
    ),
    props.rows.map((entry) =>
      h(FileRow, {
        key: props.side + ':' + entry.path,
        entry,
        side: props.side,
        active: props.activeKey === props.side + '\u0000' + entry.path,
        t: props.t,
        onSelect: props.onSelect,
        onToggle: props.onToggle,
        onCopyPath: props.onCopyPath,
        onContextMenu: props.onContextMenu,
      }),
    ),
  )
}

export function ChangeList(props: {
  status: GitStatusPayload | null
  statusError: string
  rows: { staged: GitFileEntry[]; unstaged: GitFileEntry[]; conflicted: GitFileEntry[] }
  selectedKey: string
  t: Translate
  onSelect: (entry: GitFileEntry, side: EntrySide) => void
  onToggle: (entry: GitFileEntry, side: EntrySide) => void
  onCopyPath: (entry: GitFileEntry) => void
  onContextMenu: (entry: GitFileEntry, side: EntrySide, event: any) => void
}): any {
  const { status, statusError, rows, t } = props
  const total = (status?.entries ?? []).length
  const empty = rows.staged.length === 0 && rows.unstaged.length === 0 && rows.conflicted.length === 0

  return h(
    'section',
    { className: 'dgt-list', 'aria-label': t('fileStatus') },
    h(
      'div',
      { className: 'dgt-list-head' },
      h('span', null, t('changes')),
      h('span', { className: 'dgt-group-count' }, String(total) + ' ' + t('itemsUnit')),
    ),
    status === null && statusError === ''
      ? h('div', { className: 'dgt-placeholder' }, t('loading'))
      : empty
        ? h(
            'div',
            { className: 'dgt-empty' },
            h('span', null, t('nothingToCommit')),
            h('span', { className: 'dgt-empty-hint' }, t('nothingHint')),
          )
        : h(
            'div',
            { className: 'dgt-scroll' },
            h(Group, {
              label: t('conflicts'),
              tone: 'error',
              rows: rows.conflicted,
              side: 'conflicted',
              activeKey: props.selectedKey,
              t,
              onSelect: props.onSelect,
              onToggle: props.onToggle,
              onCopyPath: props.onCopyPath,
              onContextMenu: props.onContextMenu,
            }),
            h(Group, {
              label: t('stagedFiles'),
              rows: rows.staged,
              side: 'staged',
              activeKey: props.selectedKey,
              t,
              onSelect: props.onSelect,
              onToggle: props.onToggle,
              onCopyPath: props.onCopyPath,
              onContextMenu: props.onContextMenu,
            }),
            h(Group, {
              label: t('unstagedFiles'),
              rows: rows.unstaged,
              side: 'unstaged',
              activeKey: props.selectedKey,
              t,
              onSelect: props.onSelect,
              onToggle: props.onToggle,
              onCopyPath: props.onCopyPath,
              onContextMenu: props.onContextMenu,
            }),
          ),
  )
}
