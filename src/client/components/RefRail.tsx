// Reference rail: workspace views, then the real branch / remote / tag tree.
// Rows are display-only here; switching views needs the history and search
// slices, so those two are shown as unavailable rather than as dead links.

import { h } from '../react'
import type { GitStatusPayload, RefRecord, RefsPayload, Translate } from '../types'

function Section(props: { title: string; count?: number; children?: any }): any {
  return h(
    'div',
    { className: 'dgt-rail-section' },
    h(
      'div',
      { className: 'dgt-rail-title' },
      h('span', null, props.title),
      typeof props.count === 'number' && props.count > 0 ? h('span', null, String(props.count)) : null,
    ),
    props.children,
  )
}

function RefRow(props: { record: RefRecord }): any {
  const ref = props.record
  return h(
    'div',
    {
      className: 'dgt-rail-row',
      'data-current': ref.current || undefined,
      title: ref.subject ? ref.name + ' — ' + ref.subject : ref.name,
    },
    ref.current ? h('span', { className: 'dgt-rail-dot' }) : null,
    h('span', { className: 'dgt-rail-name' }, ref.name),
  )
}

export function RefRail(props: { status: GitStatusPayload | null; refs: RefsPayload | null; t: Translate }): any {
  const { refs, t } = props
  const branches = refs?.branches ?? []
  const remotes = refs?.remotes ?? []
  const tags = refs?.tags ?? []

  return h(
    'aside',
    { className: 'dgt-rail', 'aria-label': t('refs') },
    h(
      Section,
      { title: t('workspace') },
      h(
        'div',
        { className: 'dgt-rail-row', 'data-active': true },
        h('span', { className: 'dgt-rail-name' }, t('fileStatus')),
      ),
      h('div', { className: 'dgt-rail-row', 'data-muted': true, title: t('readOnly') }, h('span', { className: 'dgt-rail-name' }, t('history'))),
      h('div', { className: 'dgt-rail-row', 'data-muted': true, title: t('readOnly') }, h('span', { className: 'dgt-rail-name' }, t('search'))),
    ),
    h(
      Section,
      { title: t('branches'), count: branches.length },
      branches.length > 0
        ? branches.map((ref) => h(RefRow, { key: 'b:' + ref.name, record: ref }))
        : h('div', { className: 'dgt-rail-empty' }, '—'),
    ),
    h(
      Section,
      { title: t('remotes'), count: remotes.length },
      remotes.length > 0
        ? remotes.map((ref) => h(RefRow, { key: 'r:' + ref.name, record: ref }))
        : h('div', { className: 'dgt-rail-empty' }, '—'),
    ),
    h(
      Section,
      { title: t('tags'), count: tags.length },
      tags.length > 0
        ? tags.map((ref) => h(RefRow, { key: 't:' + ref.name, record: ref }))
        : h('div', { className: 'dgt-rail-empty' }, '—'),
    ),
  )
}
