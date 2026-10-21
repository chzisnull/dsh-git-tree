// Reference rail: workspace view switcher, then the local branch / tag tree.
// A branch opens its history on click, checks out on double click or from its
// menu. Remote refs are out of scope and are not rendered at all.

import { h, React } from '../react'
import type { GitStatusPayload, RefRecord, RefsPayload, Translate, ViewKind } from '../types'
import { BranchIcon, MoreIcon, TagIcon } from '../icons'

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

function RefRow(props: {
  record: RefRecord
  kind: 'branch' | 'tag'
  t: Translate
  onOpen: (record: RefRecord, kind: 'branch' | 'tag') => void
  onCheckout: (name: string) => void
  onCopy: (name: string) => void
}): any {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const ref = props.record
  const Icon = props.kind === 'branch' ? BranchIcon : TagIcon
  return h(
    'div',
    {
      className: 'dgt-rail-row dgt-rail-ref',
      'data-current': ref.current || undefined,
      'data-menu': menuOpen || undefined,
      role: 'button',
      tabIndex: 0,
      title: ref.subject ? ref.name + ' — ' + ref.subject : ref.name,
      onClick: () => props.onOpen(ref, props.kind),
      onDoubleClick: () => {
        if (props.kind === 'branch') props.onCheckout(ref.name)
      },
      onKeyDown: (event: any) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          props.onOpen(ref, props.kind)
        }
      },
    },
    h('span', { className: 'dgt-rail-icon' }, h(Icon)),
    ref.current ? h('span', { className: 'dgt-rail-dot' }) : null,
    h('span', { className: 'dgt-rail-name' }, ref.name),
    h(
      'button',
      {
        type: 'button',
        className: 'dgt-rail-more',
        title: props.t('fileActions'),
        'aria-label': props.t('fileActions'),
        onClick: (event: any) => {
          event.stopPropagation()
          setMenuOpen(!menuOpen)
        },
      },
      h(MoreIcon),
    ),
    menuOpen
      ? h(
          'div',
          { className: 'dgt-menu', onClick: (event: any) => event.stopPropagation() },
          props.kind === 'branch'
            ? h(
                'button',
                {
                  type: 'button',
                  onClick: () => {
                    setMenuOpen(false)
                    props.onCheckout(ref.name)
                  },
                },
                props.t('checkout'),
              )
            : null,
          h(
            'button',
            {
              type: 'button',
              onClick: () => {
                setMenuOpen(false)
                props.onCopy(ref.name)
              },
            },
            props.t('copyRefName'),
          ),
        )
      : null,
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
  onOpenRef: (record: RefRecord, kind: 'branch' | 'tag') => void
  onCheckout: (name: string) => void
  onCopyRef: (name: string) => void
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
    ),
    h(
      Section,
      { title: t('branches'), count: branches.length },
      branches.length > 0
        ? branches.map((ref) =>
            h(RefRow, {
              key: 'b:' + ref.name,
              record: ref,
              kind: 'branch',
              t,
              onOpen: props.onOpenRef,
              onCheckout: props.onCheckout,
              onCopy: props.onCopyRef,
            }),
          )
        : h('div', { className: 'dgt-rail-empty' }, '—'),
    ),
    h(
      Section,
      { title: t('tags'), count: tags.length },
      tags.length > 0
        ? tags.map((ref) =>
            h(RefRow, {
              key: 't:' + ref.name,
              record: ref,
              kind: 'tag',
              t,
              onOpen: props.onOpenRef,
              onCheckout: props.onCheckout,
              onCopy: props.onCopyRef,
            }),
          )
        : h('div', { className: 'dgt-rail-empty' }, '—'),
    ),
  )
}
