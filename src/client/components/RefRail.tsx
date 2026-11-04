// Remote tracking refs are a local snapshot. Deletion targets the server and
// always opens a confirmation; local branches also offer explicit force delete.

import { h } from '../react'
import type { GitStatusPayload, RefKind, RefRecord, RefsPayload, Translate, ViewKind } from '../types'
import { BranchIcon, MoreIcon, TagIcon } from '../icons'
import { usePopover } from '../menu'

function Section(props: { title: string; count?: number; action?: any; children?: any }): any {
  return h(
    'div',
    { className: 'dgt-rail-section' },
    h(
      'div',
      { className: 'dgt-rail-title' },
      h('span', null, props.title),
      h(
        'span',
        { className: 'dgt-rail-title-right' },
        typeof props.count === 'number' && props.count > 0 ? h('span', null, String(props.count)) : null,
        props.action ?? null,
      ),
    ),
    props.children,
  )
}

function RefRow(props: {
  record: RefRecord
  kind: RefKind
  label?: string
  t: Translate
  onOpen: (record: RefRecord, kind: RefKind) => void
  onCheckout: (name: string) => void
  onMerge: (name: string) => void
  onCopy: (name: string) => void
  onRename: (name: string) => void
  onDelete: (name: string) => void
  onForceDelete: (name: string) => void
  onDeleteRemote: (record: RefRecord) => void
  onContextMenu: (record: RefRecord, kind: RefKind, event: any) => void
}): any {
  const popover = usePopover()
  const menuOpen = popover.open
  const anchor = menuOpen && popover.triggerRef.current ? popover.triggerRef.current.getBoundingClientRect() : null
  const menuStyle = anchor ? { position: 'fixed', left: anchor.right + 4, top: anchor.top, right: 'auto' } : undefined
  const ref = props.record
  const Icon = props.kind === 'tag' ? TagIcon : BranchIcon
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
      onContextMenu: (event: any) => {
        event.preventDefault()
        props.onContextMenu(ref, props.kind, event)
      },
      onDoubleClick: () => {
        if (props.kind === 'branch') props.onCheckout(ref.name)
      },
      onKeyDown: (event: any) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          props.onOpen(ref, props.kind)
        }
      },
    },
    h('span', { className: 'dgt-rail-icon' }, h(Icon)),
    ref.current ? h('span', { className: 'dgt-rail-dot' }) : null,
    h('span', { className: 'dgt-rail-name' }, props.label ?? ref.name),
    h(
      'button',
      {
        type: 'button',
        className: 'dgt-rail-more',
        title: props.t('fileActions'),
        'aria-label': props.t('fileActions'),
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
          props.kind === 'branch'
            ? h(
                'button',
                {
                  type: 'button',
                  onClick: () => {
                    popover.close()
                    props.onCheckout(ref.name)
                  },
                },
                props.t('checkout'),
              )
            : null,
          props.kind === 'branch'
            ? h(
                'button',
                {
                  type: 'button',
                  disabled: ref.current,
                  title: ref.current ? props.t('mergeSelfHint') : undefined,
                  onClick: () => {
                    if (ref.current) return
                    popover.close()
                    props.onMerge(ref.name)
                  },
                },
                props.t('mergeIntoCurrent'),
              )
            : null,
          props.kind === 'branch'
            ? h(
                'button',
                {
                  type: 'button',
                  onClick: () => {
                    popover.close()
                    props.onRename(ref.name)
                  },
                },
                props.t('renameBranch'),
              )
            : null,
          props.kind === 'branch'
            ? h(
                'button',
                {
                  type: 'button',
                  disabled: ref.current,
                  title: ref.current ? props.t('currentBranchCannotDelete') : undefined,
                  onClick: () => {
                    if (ref.current) return
                    popover.close()
                    props.onDelete(ref.name)
                  },
                },
                props.t('deleteBranch'),
              )
            : null,
          props.kind === 'branch'
            ? h('button', {
                type: 'button',
                'data-danger': true,
                disabled: ref.current,
                title: ref.current ? props.t('currentBranchCannotDelete') : undefined,
                onClick: () => { if (!ref.current) { popover.close(); props.onForceDelete(ref.name) } },
              }, props.t('forceDeleteBranch'))
            : null,
          props.kind === 'remote'
            ? h('button', {
                type: 'button',
                'data-danger': true,
                onClick: () => { popover.close(); props.onDeleteRemote(ref) },
              }, props.t('deleteRemoteBranch'))
            : null,
          props.kind !== 'branch'
            ? h('button', {
                type: 'button',
                onClick: () => { popover.close(); props.onOpen(ref, props.kind) },
              }, props.t('history'))
            : null,
          h(
            'button',
            {
              type: 'button',
              onClick: () => {
                popover.close()
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
  onOpenRef: (record: RefRecord, kind: RefKind) => void
  onCheckout: (name: string) => void
  onMerge: (name: string) => void
  onCopyRef: (name: string) => void
  onCreate: () => void
  onRename: (name: string) => void
  onDelete: (name: string) => void
  onForceDelete: (name: string) => void
  onDeleteRemote: (record: RefRecord) => void
  onContextMenu: (record: RefRecord, kind: RefKind, event: any) => void
}): any {
  const { refs, t } = props
  const branches = refs?.branches ?? []
  const tags = refs?.tags ?? []
  const remotes = refs?.remotes ?? []
  const remoteNames = [...(refs?.remoteNames ?? props.status?.remotes ?? [])].sort((a, b) => b.length - a.length)
  const groups = new Map<string, RefRecord[]>(remoteNames.map((name) => [name, []]))
  for (const record of remotes) {
    const remote = remoteNames.find((name) => record.name.startsWith(name + '/')) ?? record.name.split('/')[0]
    if (!groups.has(remote)) groups.set(remote, [])
    groups.get(remote)!.push(record)
  }

  return h(
    'aside',
    { className: 'dgt-rail', 'aria-label': t('refs') },
    h(
      Section,
      { title: t('workspace') },
      h(ViewRow, { label: t('fileStatus'), active: props.view === 'status', onSelect: () => props.onView('status') }),
      h(ViewRow, { label: t('history'), active: props.view === 'history', onSelect: () => props.onView('history') }),
      h(ViewRow, { label: t('search'), active: props.view === 'search', onSelect: () => props.onView('search') }),
    ),
    h(
      Section,
      {
        title: t('branches'),
        count: branches.length,
        action: h(
          'button',
          {
            type: 'button',
            className: 'dgt-rail-add',
            title: t('newBranch'),
            'aria-label': t('newBranch'),
            onClick: props.onCreate,
          },
          '+',
        ),
      },
      branches.length > 0
        ? branches.map((ref) =>
            h(RefRow, {
              key: 'b:' + ref.name,
              record: ref,
              kind: 'branch',
              t,
              onOpen: props.onOpenRef,
              onCheckout: props.onCheckout,
              onMerge: props.onMerge,
              onCopy: props.onCopyRef,
              onRename: props.onRename,
              onDelete: props.onDelete,
              onForceDelete: props.onForceDelete,
              onDeleteRemote: props.onDeleteRemote,
              onContextMenu: props.onContextMenu,
            }),
          )
        : h('div', { className: 'dgt-rail-empty' }, '—'),
    ),
    h(
      Section,
      { title: t('remotes'), count: remotes.length },
      h('div', { className: 'dgt-rail-note' }, t('remoteSnapshot')),
      refs === null
        ? h('div', { className: 'dgt-rail-empty', role: 'status' }, t('loading'))
        : null,
      refs?.ok === false
        ? h('div', { className: 'dgt-rail-empty dgt-error', role: 'alert' }, refs.error || t('refsFailed'))
        : null,
      [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([name, records]) =>
        h('details', { key: name, className: 'dgt-remote-group', open: true },
          h('summary', { className: 'dgt-remote-title' },
            h('span', { className: 'dgt-rail-name' }, name),
            h('span', { className: 'dgt-remote-count' }, String(records.length))),
          records.length === 0
            ? h('div', { className: 'dgt-rail-empty' }, t('noRemoteBranches'))
            : records.map((record) => h(RefRow, {
                key: 'r:' + record.name,
                record,
                kind: 'remote',
                label: record.name.startsWith(name + '/') ? record.name.slice(name.length + 1) : record.name,
                t,
                onOpen: props.onOpenRef,
                onCheckout: props.onCheckout,
                onMerge: props.onMerge,
                onCopy: props.onCopyRef,
                onRename: props.onRename,
                onDelete: props.onDelete,
                onForceDelete: props.onForceDelete,
                onDeleteRemote: props.onDeleteRemote,
                onContextMenu: props.onContextMenu,
              })),
        )),
      refs?.ok && groups.size === 0
        ? h('div', { className: 'dgt-rail-empty' }, t('noRemotes'))
        : null,
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
              onMerge: props.onMerge,
              onCopy: props.onCopyRef,
              onRename: props.onRename,
              onDelete: props.onDelete,
              onForceDelete: props.onForceDelete,
              onDeleteRemote: props.onDeleteRemote,
              onContextMenu: props.onContextMenu,
            }),
          )
        : h('div', { className: 'dgt-rail-empty' }, '—'),
    ),
  )
}
