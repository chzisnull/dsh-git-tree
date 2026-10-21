// Small presentational atoms shared by the workspace panes.

import { h } from '../react'

export function Chip(props: { tone?: 'ok' | 'warn' | 'brand' | 'muted'; title?: string; children?: any }): any {
  return h('span', { className: 'dgt-chip', 'data-tone': props.tone ?? 'muted', title: props.title }, props.children)
}
