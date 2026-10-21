// Change list pane: staged and unstaged groups with counts, empty and loading
// states.

import { h } from '../react'
import { FileRow } from './FileRow'
import type { GitFileEntry, GitStatusPayload, Translate } from '../types'

export function ChangeList(props: {
  status: GitStatusPayload | null
  statusError: string
  entries: GitFileEntry[]
  staged: GitFileEntry[]
  working: GitFileEntry[]
  selected: GitFileEntry | null
  t: Translate
  onSelect: (entry: GitFileEntry) => void
}): any {
  const { status, statusError, entries, staged, working, selected, t, onSelect } = props
  return h(
    'section',
    { className: 'dgt-list', 'aria-label': t('changes') },
    h(
      'div',
      { className: 'dgt-list-head' },
      h('span', null, t('changes')),
      h('span', { className: 'dgt-count' }, String(entries.length)),
    ),
    status === null && statusError === ''
      ? h('div', { className: 'dgt-placeholder' }, t('loading'))
      : entries.length === 0
        ? h('div', { className: 'dgt-placeholder' }, t('clean'))
        : h(
            'div',
            { className: 'dgt-scroll' },
            staged.length > 0
              ? h('div', { className: 'dgt-group' }, t('staged'), ' · ', String(staged.length))
              : null,
            staged.map((entry) =>
              h(FileRow, {
                key: 's:' + entry.path,
                entry,
                active: selected?.path === entry.path,
                onSelect,
              }),
            ),
            working.length > 0
              ? h('div', { className: 'dgt-group' }, t('working'), ' · ', String(working.length))
              : null,
            working.map((entry) =>
              h(FileRow, {
                key: 'w:' + entry.path,
                entry,
                active: selected?.path === entry.path,
                onSelect,
              }),
            ),
          ),
  )
}
