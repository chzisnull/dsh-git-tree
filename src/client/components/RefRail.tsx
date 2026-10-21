// Reference rail: workspace view switcher, then the local branch / tag tree.
// Remote refs are out of scope for this version and are not shown at all.

import { h } from '../react'
import type { GitStatusPayload, RefRecord, RefsPayload, Translate, ViewKind } from '../types'
import { BranchIcon, TagIcon } from '../icons'

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

function RefRow(props: { record: RefRecord; kind: 'branch' | 'tag' }): any {
  const ref = props.record
  const Icon = props.kind === 'branch' ? BranchIcon : TagIcon
  return h(
    'div',
    {
      className: 'dgt-rail-row',
      'data-current': ref.current || undefined,
      title: ref.subject ? ref.name + ' — ' + ref.subject : ref.name,
    },
    h('span', { className: 'dgt-rail-icon' }, h(Icon)),
    ref.current ? h('span', { className: 'dgt-rail-dot' }) : null,
    h('span', { className: 'dgt-rail-name' }, ref.name),
  )
}

function ViewRow(props: { label: string; active: boolean; onSelect: () => void }): any {
  return h(
    'button',
    {
      type: 'button',
      className: 'dgt-rail-row dgt-rail-btn',
      'data-active': props.active || undefined,
      onClick: props.onSelect,
    },
    h('span', { className: 'dgt-rail-name' }, props.label),
  )
}

export function RefRail(props: {
  status: GitStatusPayload | null
  refs: RefsPayload | null
  view: ViewKind
  t: Translate
  onView: (view: ViewKind) => void
}): any {
  const { refs, t } = props
  const branches = refs?.branches ?? []
  const tags = refs?.tags ?? []

  return h(
    'aside',
    { className: 'dgt-rail', 'aria-label': t('refs') },
    h(
      Section,
      { title: t('workspace') },
      h(ViewRow, { label: t('fileStatus'), active: props.view === 'status', onSelect: () => props.onView('status') }),
      h(ViewRow, { label: t('history'), active: props.view === 'history', onSelect: () => props.onView('history') }),
      // Search arrives with its own slice; until then it is not rendered at all
      // rather than shown as a dead row.
    ),
    h(
      Section,
      { title: t('branches'), count: branches.length },
      branches.length > 0
        ? branches.map((ref) => h(RefRow, { key: 'b:' + ref.name, record: ref, kind: 'branch' }))
        : h('div', { className: 'dgt-rail-empty' }, '—'),
    ),
    h(
      Section,
      { title: t('tags'), count: tags.length },
      tags.length > 0
        ? tags.map((ref) => h(RefRow, { key: 't:' + ref.name, record: ref, kind: 'tag' }))
        : h('div', { className: 'dgt-rail-empty' }, '—'),
    ),
  )
}
