// One row of the change list: status letter and path for a single entry.

import { h } from '../react'
import type { GitFileEntry } from '../types'

export function FileRow(props: {
  entry: GitFileEntry
  active: boolean
  onSelect: (entry: GitFileEntry) => void
}): any {
  const entry = props.entry
  const code = (entry.x + entry.y).trim() || '??'
  return h(
    'button',
    {
      type: 'button',
      className: 'dgt-file',
      'data-active': props.active || undefined,
      'data-kind': entry.kind,
      title: entry.path,
      onClick: () => props.onSelect(entry),
    },
    h(
      'span',
      {
        className: 'dgt-file-code',
        'data-status':
          entry.x === '?' ? '?' : entry.x === 'A' ? 'A' : entry.y === 'M' || entry.x === 'M' ? 'M' : 'D',
      },
      code,
    ),
    h('span', { className: 'dgt-file-path' }, entry.path),
  )
}
