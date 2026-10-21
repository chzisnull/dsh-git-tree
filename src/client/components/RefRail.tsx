// Left rail: the references tree. This version still renders section headings
// with skeleton copy; the real branch/remote/tag data arrives with its own
// slice.

import { h } from '../react'
import type { Translate } from '../types'

export function RefRail(props: { t: Translate }): any {
  const t = props.t
  return h(
    'aside',
    { className: 'dgt-rail', 'aria-label': t('refs') },
    h('div', { className: 'dgt-section-title' }, t('branches')),
    h('div', { className: 'dgt-placeholder' }, t('branchesPlaceholder')),
    h('div', { className: 'dgt-section-title' }, t('remotes')),
    h('div', { className: 'dgt-placeholder' }, t('remotesPlaceholder')),
    h('div', { className: 'dgt-section-title' }, t('tags')),
    h('div', { className: 'dgt-placeholder' }, t('tagsPlaceholder')),
  )
}
