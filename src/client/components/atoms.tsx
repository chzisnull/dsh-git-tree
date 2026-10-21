// Small presentational atoms shared by the workspace panes.

import { h } from '../react'

export function Chip(props: { tone?: 'ok' | 'warn' | 'muted'; children?: any }): any {
  return h('span', { className: 'dgt-chip', 'data-tone': props.tone ?? 'muted' }, props.children)
}

export function Spinner(): any {
  return h('span', { className: 'dgt-spinner', 'aria-hidden': 'true' })
}
