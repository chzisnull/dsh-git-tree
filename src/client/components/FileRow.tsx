// One row of the change list. Sourcetree's row shape: checkbox, status letter,
// path (directory muted, name emphasized), and a hover-only menu.

import { h } from '../react'
import type { EntrySide, GitFileEntry, Translate } from '../types'
import { splitPath, statusLetter, statusTone } from '../model'
import { MoreIcon } from '../icons'
import { usePopover } from '../menu'

export function FileRow(props: {
  entry: GitFileEntry
  side: EntrySide
  active: boolean
  t: Translate
  onSelect: (entry: GitFileEntry, side: EntrySide) => void
  onToggle: (entry: GitFileEntry, side: EntrySide) => void
  onCopyPath: (entry: GitFileEntry) => void
}): any {
  const popover = usePopover()
  const menuOpen = popover.open
  const anchor = menuOpen && popover.triggerRef.current ? popover.triggerRef.current.getBoundingClientRect() : null
  const menuStyle = anchor ? { position: 'fixed', left: anchor.right + 4, top: anchor.top - 4, right: 'auto' } : undefined
  const entry = props.entry
  const side = props.side
  const t = props.t
  const letter = statusLetter(entry, side)
  const tone = statusTone(letter)
  const { dir, name } = splitPath(entry.path)
  const conflict = side === 'conflicted' || entry.conflicted
  const actionLabel = side === 'staged' ? t('unstageFile') : t('stageFile')
  const title = entry.origPath ? entry.path + ' — ' + t('renameFrom') + ' ' + entry.origPath : entry.path

  return h(
    'div',
    {
      className: 'dgt-row',
      'data-active': props.active || undefined,
      'data-side': side,
      'data-menu': menuOpen || undefined,
      role: 'button',
      tabIndex: 0,
      title,
      onClick: () => props.onSelect(entry, side),
      onKeyDown: (event: any) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          props.onSelect(entry, side)
        }
      },
    },
    h('input', {
      type: 'checkbox',
      className: 'dgt-check',
      checked: side === 'staged',
      disabled: conflict,
      'aria-label': actionLabel,
      title: conflict ? t('conflictsBlockCommit') : actionLabel,
      onClick: (event: any) => event.stopPropagation(),
      onChange: () => props.onToggle(entry, side),
    }),
    h('span', { className: 'dgt-letter', 'data-tone': tone }, letter),
    h(
      'span',
      { className: 'dgt-path' },
      dir ? h('span', { className: 'dgt-path-dir' }, dir) : null,
      h('span', { className: 'dgt-path-name' }, name),
    ),
    h(
      'button',
      {
        type: 'button',
        className: 'dgt-more',
        'data-open': menuOpen || undefined,
        title: t('fileActions'),
        'aria-label': t('fileActions'),
        ref: popover.triggerRef,
        onClick: (event: any) => {
          event.stopPropagation()
          popover.toggle()
        },
      },
      h(MoreIcon),
    ),
    menuOpen
      ? h(
          'div',
          {
            className: 'dgt-menu',
            ref: popover.menuRef,
            style: menuStyle,
            'data-flyout': true,
            onClick: (event: any) => event.stopPropagation(),
          },
          conflict
            ? null
            : h(
                'button',
                {
                  type: 'button',
                  onClick: () => {
                    popover.close()
                    props.onToggle(entry, side)
                  },
                },
                actionLabel,
              ),
          h(
            'button',
            {
              type: 'button',
              onClick: () => {
                popover.close()
                props.onCopyPath(entry)
              },
            },
            t('copyPath'),
          ),
        )
      : null,
  )
}
