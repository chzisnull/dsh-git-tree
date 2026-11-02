// One change row: checkbox, status badge, path, and a hover action. The row also
// answers right-click (and Shift+F10) with the panel context menu.

import { h } from '../react'
import type { EntrySide, GitFileEntry, Translate } from '../types'
import { splitPath, statusLetter, statusTone } from '../model'

function letterOf(entry: GitFileEntry, side: EntrySide): string {
  return statusLetter(entry, side)
}

export function FileRow(props: {
  entry: GitFileEntry
  side: EntrySide
  active: boolean
  batchSelected: boolean
  batchBusy: boolean
  onBatchSelect: (path: string) => void
  t: Translate
  onSelect: (entry: GitFileEntry, side: EntrySide) => void
  onToggle: (entry: GitFileEntry, side: EntrySide) => void
  onContextMenu: (entry: GitFileEntry, side: EntrySide, event: any) => void
}): any {
  const entry = props.entry
  const side = props.side
  const t = props.t
  const letter = letterOf(entry, side)
  const tone = statusTone(letter)
  const { dir, name } = splitPath(entry.path)
  const conflict = side === 'conflicted' || entry.conflicted
  const actionLabel = side === 'staged' ? t('unstageShort') : t('stageShort')
  const title = entry.origPath ? entry.path + ' — ' + t('renameFrom') + ' ' + entry.origPath : entry.path

  const openMenu = (event: any) => {
    event.preventDefault()
    props.onContextMenu(entry, side, event)
  }

  return h(
    'div',
    {
      className: 'dgt-row',
      'data-active': props.active || undefined,
      'data-batch-selected': props.batchSelected || undefined,
      'data-side': side,
      role: 'button',
      tabIndex: 0,
      title,
      onClick: () => props.onSelect(entry, side),
      onContextMenu: openMenu,
      onKeyDown: (event: any) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          props.onSelect(entry, side)
        }
        if (event.key === 'F10' && event.shiftKey) {
          event.preventDefault()
          const rect = event.currentTarget.getBoundingClientRect()
          props.onContextMenu(entry, side, { clientX: rect.left + 24, clientY: rect.top + 18, preventDefault() {} })
        }
      },
    },
    // The first cell is always there, so the badges, paths and switches of the
    // staged and the unstaged groups start on the same edge. Only unstaged rows
    // are selectable; the rest hold the column with an empty placeholder.
    side === 'unstaged'
      ? h('input', {
          type: 'checkbox',
          className: 'dgt-check dgt-batch-check',
          checked: props.batchSelected,
          disabled: props.batchBusy,
          'aria-label': t('selectFile') + ': ' + entry.path,
          title: t('selectFile'),
          onClick: (event: any) => event.stopPropagation(),
          onKeyDown: (event: any) => event.stopPropagation(),
          onChange: () => props.onBatchSelect(entry.path),
        })
      : h('span', { className: 'dgt-batch-placeholder', 'aria-hidden': true }),
    h('span', { className: 'dgt-badge', 'data-tone': tone }, letter),
    h(
      'span',
      { className: 'dgt-path' },
      dir ? h('span', { className: 'dgt-path-dir' }, dir) : null,
      h('span', { className: 'dgt-path-name' }, name),
    ),
    h(
      'span',
      { className: 'dgt-stage-control' },
      h('input', {
        type: 'checkbox',
        className: 'dgt-check dgt-stage-check',
        checked: side === 'staged',
        disabled: conflict || props.batchBusy,
        'aria-label': side === 'staged' ? t('unstageFile') : t('stageFile'),
        title: conflict ? t('conflictsBlockCommit') : actionLabel,
        onClick: (event: any) => event.stopPropagation(),
        onKeyDown: (event: any) => event.stopPropagation(),
        onChange: () => props.onToggle(entry, side),
      }),
      conflict
        ? h(
            'button',
            {
              type: 'button',
              className: 'dgt-rowact',
              'data-resolve': true,
              title: t('resolveConflictHint'),
              // Selecting the row is all this does: the resolution itself lives
              // in the diff pane, never in the list.
              onClick: (event: any) => {
                event.stopPropagation()
                props.onSelect(entry, side)
              },
              onKeyDown: (event: any) => event.stopPropagation(),
            },
            t('resolveConflict'),
          )
        : h(
            'button',
            {
              type: 'button',
              className: 'dgt-rowact',
              disabled: props.batchBusy,
              onClick: (event: any) => {
                event.stopPropagation()
                props.onToggle(entry, side)
              },
              onKeyDown: (event: any) => event.stopPropagation(),
            },
            actionLabel,
          ),
    ),
  )
}
