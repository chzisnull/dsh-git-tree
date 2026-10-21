// Toolbar: repository identity, branch and sync state, and the two actions the
// panel really supports (refresh, focus the commit box). Sourcetree's other
// toolbar actions are intentionally not shown as dead buttons.

import { h } from '../react'
import type { GitStatusPayload, Translate } from '../types'
import { lastSegment } from '../model'
import { Chip } from './atoms'
import { CommitIcon, RefreshIcon } from '../icons'

export function TopBar(props: {
  status: GitStatusPayload | null
  busy: boolean
  t: Translate
  onRefresh: () => void
  onCommitFocus: () => void
}): any {
  const { status, t } = props
  const branch = status?.branch && status.branch !== '(detached)' ? status.branch : status?.branch || '—'
  const ahead = status?.ahead ?? 0
  const behind = status?.behind ?? 0
  const staged = status?.counts?.staged ?? 0

  return h(
    'header',
    { className: 'dgt-topbar' },
    h(
      'div',
      { className: 'dgt-repo' },
      h('span', { className: 'dgt-repo-name' }, status?.repoRoot ? lastSegment(status.repoRoot) : t('panel')),
      h(
        'span',
        { className: 'dgt-repo-path', title: status?.repoRoot || status?.cwd || '' },
        status?.repoRoot || status?.cwd || '—',
      ),
    ),
    h(
      'div',
      { className: 'dgt-refs' },
      h(Chip, { tone: 'brand', title: t('branches') }, h('span', { 'aria-hidden': 'true' }, '⎇'), ' ', branch),
      ahead > 0 ? h(Chip, { tone: 'ok', title: t('ahead') }, '↑' + String(ahead)) : null,
      behind > 0 ? h(Chip, { tone: 'warn', title: t('behind') }, '↓' + String(behind)) : null,
      status?.upstream ? h('span', { className: 'dgt-upstream' }, status.upstream) : null,
    ),
    h(
      'div',
      { className: 'dgt-actions' },
      h(
        'button',
        {
          type: 'button',
          className: 'dgt-iconbtn',
          title: t('refresh'),
          'aria-label': t('refresh'),
          'data-busy': props.busy || undefined,
          disabled: props.busy,
          onClick: props.onRefresh,
        },
        h(RefreshIcon),
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'dgt-iconbtn',
          title: t('commit'),
          'aria-label': t('commit'),
          disabled: staged === 0,
          onClick: props.onCommitFocus,
        },
        h(CommitIcon),
      ),
    ),
  )
}
