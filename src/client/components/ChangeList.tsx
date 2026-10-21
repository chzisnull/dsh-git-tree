// Change list pane, laid out like Sourcetree: a "待定的文件" header, then two
// stacked regions — staged files and unstaged files — each with its own header,
// count and scroll area. Conflicts get their own region above them.

import { h } from '../react'
import { FileRow } from './FileRow'
import type { EntrySide, GitFileEntry, GitStatusPayload, Translate } from '../types'

function Rows(props: {
  rows: GitFileEntry[]
  side: EntrySide
  activeKey: string
  t: Translate
  onSelect: (entry: GitFileEntry, side: EntrySide) => void
  onToggle: (entry: GitFileEntry, side: EntrySide) => void
  onCopyPath: (entry: GitFileEntry) => void
  onContextMenu: (entry: GitFileEntry, side: EntrySide, event: any) => void
}): any {
  return props.rows.map((entry) =>
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
  )
}

function Region(props: {
  label: string
  count: number
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
  return h(
    'div',
    { className: 'dgt-region', 'data-kind': props.side },
    h(
      'div',
      { className: 'dgt-group', 'data-tone': props.tone },
      h('span', null, props.label),
      h('span', { className: 'dgt-group-count' }, String(props.count)),
    ),
    h(
      'div',
      { className: 'dgt-region-scroll' },
      props.count === 0
        ? null
        : h(Rows, {
            rows: props.rows,
            side: props.side,
            activeKey: props.activeKey,
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
  const shared = {
    activeKey: props.selectedKey,
    t,
    onSelect: props.onSelect,
    onToggle: props.onToggle,
    onCopyPath: props.onCopyPath,
    onContextMenu: props.onContextMenu,
  }

  return h(
    'section',
    { className: 'dgt-list', 'aria-label': t('pendingFiles') },
    h(
      'div',
      { className: 'dgt-list-head' },
      h('span', null, t('pendingFiles')),
      h('span', { className: 'dgt-list-sort' }, t('sortByPath')),
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
            { className: 'dgt-regions' },
            rows.conflicted.length > 0
              ? h(Region, {
                  label: t('conflicts'),
                  count: rows.conflicted.length,
                  tone: 'error',
                  rows: rows.conflicted,
                  side: 'conflicted',
                  ...shared,
                })
              : null,
            h(Region, {
              label: t('stagedFiles'),
              count: rows.staged.length,
              rows: rows.staged,
              side: 'staged',
              ...shared,
            }),
            h(Region, {
              label: t('unstagedFiles'),
              count: rows.unstaged.length,
              rows: rows.unstaged,
              side: 'unstaged',
              ...shared,
            }),
          ),
  )
}
