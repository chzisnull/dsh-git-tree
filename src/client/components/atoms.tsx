// Small presentational atoms shared by the workspace panes.

import { h } from '../react'

export function Chip(props: { tone?: 'ok' | 'warn' | 'brand' | 'muted'; title?: string; children?: any }): any {
  return h('span', { className: 'dgt-chip', 'data-tone': props.tone ?? 'muted', title: props.title }, props.children)
}

/**
 * One keycap per part of the panel-toggle binding. The caller owns the
 * surrounding control and decides what an empty list means (nothing renders
 * when the command is unbound), so the toolbar badge and the empty-pane hint
 * share exactly one shape.
 */
export function ShortcutCaps(props: { caps: string[]; className?: string }): any {
  if (!Array.isArray(props.caps) || props.caps.length === 0) return null
  return h(
    'span',
    { className: props.className ?? 'dgt-kbd-caps' },
    props.caps.map((cap, index) => h('kbd', { key: 'cap:' + String(index), className: 'dgt-kbd-key' }, cap)),
  )
}

