// Change list pane, laid out like Sourcetree: a "待提交的更改" header, then two
// stacked regions — staged files and unstaged files — each with its own header,
// count and scroll area. Conflicts get their own region above them.

import { h, React } from '../react'
import { FileRow } from './FileRow'
import type { EntrySide, GitFileEntry, GitStatusPayload, Translate } from '../types'

// Selection state lives above this list, so every tick gives all rows new props;
// without memo each checkbox click re-renders the whole (up to 5000-row) list.
const Row = React.memo(FileRow)

function Rows(props: {
  rows: GitFileEntry[]
  side: EntrySide
  activeKey: string
  batchSelected: Set<string>
  batchBusy: boolean
  onBatchSelect: (path: string) => void
  t: Translate
  onSelect: (entry: GitFileEntry, side: EntrySide) => void
  onToggle: (entry: GitFileEntry, side: EntrySide) => void
  onCopyPath: (entry: GitFileEntry) => void
  onContextMenu: (entry: GitFileEntry, side: EntrySide, event: any) => void
}): any {
  return props.rows.map((entry) =>
    h(Row, {
      key: props.side + ':' + entry.path,
      entry,
      side: props.side,
      active: props.activeKey === props.side + '\u0000' + entry.path,
      batchSelected: props.side === 'unstaged' && props.batchSelected.has(entry.path),
      batchBusy: props.batchBusy,
      onBatchSelect: props.onBatchSelect,
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
  batchBar?: any
  tone?: 'error'
  rows: GitFileEntry[]
  side: EntrySide
  activeKey: string
  batchSelected: Set<string>
  batchBusy: boolean
  onBatchSelect: (path: string) => void
  t: Translate
  onSelect: (entry: GitFileEntry, side: EntrySide) => void
  onToggle: (entry: GitFileEntry, side: EntrySide) => void
  onCopyPath: (entry: GitFileEntry) => void
  onContextMenu: (entry: GitFileEntry, side: EntrySide, event: any) => void
}): any {
  return h(
    'div',
    { className: 'dgt-region', 'data-kind': props.side, 'data-empty': props.count === 0 || undefined },
    h(
      'div',
      { className: 'dgt-group', 'data-tone': props.tone },
      h('span', null, props.label),
      h('span', { className: 'dgt-group-count' }, String(props.count)),
    ),
    props.batchBar ?? null,
    h(
      'div',
      { className: 'dgt-region-scroll' },
      props.count === 0
        ? null
        : h(Rows, {
            rows: props.rows,
            side: props.side,
            activeKey: props.activeKey,
            batchSelected: props.batchSelected,
            batchBusy: props.batchBusy,
            onBatchSelect: props.onBatchSelect,
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
  batchSelected: Set<string>
  batchBusy: boolean
  onBatchSelect: (path: string) => void
  onBatchSelectAll: () => void
  onBatchClear: () => void
  onBatchStage: () => void
  onBatchCopy: () => void
  onBatchRemove: () => void
  t: Translate
  onSelect: (entry: GitFileEntry, side: EntrySide) => void
  onToggle: (entry: GitFileEntry, side: EntrySide) => void
  onCopyPath: (entry: GitFileEntry) => void
  onContextMenu: (entry: GitFileEntry, side: EntrySide, event: any) => void
}): any {
  const { status, statusError, rows, t } = props
  // The header counts files, not records: a path changed on both sides is one
  // file but two records, so the two numbers only part when that happens.
  const entries = status?.entries ?? []
  const total = new Set(entries.map((entry) => entry.path)).size
  const records = rows.conflicted.length + rows.staged.length + rows.unstaged.length
  const selected = props.batchSelected.size
  const untrackedSelected = rows.unstaged.filter((entry) => entry.kind === 'untracked' && props.batchSelected.has(entry.path)).length
  const allSelected = rows.unstaged.length > 0 && rows.unstaged.every((entry) => props.batchSelected.has(entry.path))
  const empty = rows.staged.length === 0 && rows.unstaged.length === 0 && rows.conflicted.length === 0
  const batchBar = rows.unstaged.length > 0
    ? h(
        'div',
        { className: 'dgt-batch-bar', 'data-selected': selected > 0 || undefined },
        h('div', { className: 'dgt-batch-summary' },
          h('span', { className: 'dgt-batch-count', role: 'status' },
            selected > 0 ? String(selected) + ' ' + t('selectedCount') : ''),
          // Clear sits to the left of select-all so the rightmost button keeps
          // its position and a double click cannot turn 全选 into 清空.
          selected > 0 && !allSelected
            ? h('button', {
                type: 'button',
                className: 'dgt-batch-action',
                'data-clear': true,
                disabled: props.batchBusy,
                onClick: props.onBatchClear,
              }, t('clearSelection'))
            : null,
          h('button', {
            type: 'button',
            className: 'dgt-batch-action',
            'data-select-all': true,
            disabled: props.batchBusy,
            onClick: allSelected ? props.onBatchClear : props.onBatchSelectAll,
            title: allSelected ? t('clearSelection') : t('selectAllUnstaged'),
          }, allSelected ? t('clearSelection') : t('selectAllUnstaged')),
        ),
        // Same height with or without a selection, so the rows below never jump;
        // idle it carries the hint instead of an empty band.
        h(
          'div',
          { className: 'dgt-batch-actions' },
          props.batchBusy
            ? h('span', { className: 'dgt-batch-busy', role: 'status' },
                h('span', { className: 'dgt-spinner', 'aria-hidden': 'true' }),
                ' ' + t('batchStaging'))
            : selected === 0
              ? h('span', { className: 'dgt-batch-hint' }, t('batchSelectHint'))
              : [
                  h('button', { key: 'stage', type: 'button', className: 'dgt-batch-action', 'data-primary': true, onClick: props.onBatchStage }, t('stageSelected')),
                  h('button', { key: 'copy', type: 'button', className: 'dgt-batch-action', onClick: props.onBatchCopy }, t('copySelectedPaths')),
                  h('span', { key: 'sep', className: 'dgt-batch-sep', 'aria-hidden': 'true' }),
                  untrackedSelected > 0
                    ? h('button', { key: 'remove', type: 'button', className: 'dgt-batch-action', 'data-danger': true, onClick: props.onBatchRemove }, t('deleteSelectedUntracked') + ' (' + String(untrackedSelected) + ')')
                    : null,
                ],
        ),
      )
    : null
  const shared = {
    activeKey: props.selectedKey,
    batchSelected: props.batchSelected,
    batchBusy: props.batchBusy,
    onBatchSelect: props.onBatchSelect,
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
      h(
        'span',
        {
          className: 'dgt-group-count',
          title: records !== total ? t('twoSidedHint') : undefined,
        },
        String(total) + ' ' + t('filesChanged') +
          (records !== total ? ' · ' + String(records) + ' ' + t('itemsUnit') : ''),
      ),
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
              batchBar,
              ...shared,
            }),
          ),
  )
}
