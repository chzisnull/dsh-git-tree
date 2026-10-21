// Diff pane: header with the selected path, body driven by the loaded diff.

import { h } from '../react'
import type { DiffPayload, GitFileEntry, Translate } from '../types'

export function DiffView(props: {
  selected: GitFileEntry | null
  loading: boolean
  diff: DiffPayload | null
  t: Translate
}): any {
  const { selected, loading, diff, t } = props
  return h(
    'section',
    { className: 'dgt-diff', 'aria-label': t('diff') },
    h(
      'div',
      { className: 'dgt-list-head' },
      h('span', null, t('diff')),
      h('span', { className: 'dgt-mono' }, selected?.path ?? ''),
    ),
    h(
      'div',
      { className: 'dgt-diff-body' },
      selected === null
        ? h('div', { className: 'dgt-placeholder' }, t('diffPlaceholder'))
        : loading
          ? h('div', { className: 'dgt-placeholder' }, t('loading'))
          : diff && diff.ok === false
            ? h('div', { className: 'dgt-placeholder dgt-error' }, diff.error || t('diffFailed'))
            : diff && diff.text
              ? h('pre', { className: 'dgt-premain' }, diff.text)
              : h(
                  'div',
                  { className: 'dgt-placeholder' },
                  selected.kind === 'untracked' ? t('untrackedNoDiff') : t('noDiff'),
                ),
    ),
  )
}
