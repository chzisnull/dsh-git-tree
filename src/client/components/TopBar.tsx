// Toolbar: repository switcher, branch and sync state, and the two actions the
// panel really supports (refresh, focus the commit box). Sourcetree's other
// toolbar actions are intentionally not shown as dead buttons.

import { h, React } from '../react'
import type { GitStatusPayload, Translate, WorkspaceRecord } from '../types'
import { lastSegment } from '../model'
import { Chip } from './atoms'
import { CommitIcon, RefreshIcon } from '../icons'

export function TopBar(props: {
  status: GitStatusPayload | null
  workspaces: WorkspaceRecord[]
  currentPath: string
  busy: boolean
  t: Translate
  onRefresh: () => void
  onCommitFocus: () => void
  onSelectWorkspace: (path: string) => void
}): any {
  const { status, t } = props
  const [open, setOpen] = React.useState(false)
  const branch = status?.branch && status.branch !== '(detached)' ? status.branch : status?.branch || '—'
  const ahead = status?.ahead ?? 0
  const behind = status?.behind ?? 0
  const staged = status?.counts?.staged ?? 0
  const repoPath = props.currentPath || status?.repoRoot || status?.cwd || ''
  const current = props.workspaces.find((workspace) => workspace.path === repoPath)
  const title = current?.title || (status?.repoRoot ? lastSegment(status.repoRoot) : t('panel'))

  return h(
    'header',
    { className: 'dgt-topbar' },
    h(
      'div',
      { className: 'dgt-repo' },
      h(
        'button',
        {
          type: 'button',
          className: 'dgt-repo-switch',
          title: t('switchRepository'),
          'aria-haspopup': 'listbox',
          'aria-expanded': open,
          onClick: () => setOpen(!open),
        },
        h('span', { className: 'dgt-repo-name' }, title),
        h('span', { className: 'dgt-repo-caret', 'aria-hidden': 'true' }, '▾'),
      ),
      h('span', { className: 'dgt-repo-path', title: repoPath }, repoPath || '—'),
      open
        ? h(
            'div',
            { className: 'dgt-repo-menu', role: 'listbox', 'aria-label': t('switchRepository') },
            props.workspaces.length === 0
              ? h('div', { className: 'dgt-repo-menu-empty' }, t('noRepositories'))
              : props.workspaces.map((workspace) =>
                  h(
                    'button',
                    {
                      key: workspace.id,
                      type: 'button',
                      className: 'dgt-repo-menu-item',
                      role: 'option',
                      'aria-selected': workspace.path === repoPath,
                      'data-current': workspace.path === repoPath || undefined,
                      onClick: () => {
                        setOpen(false)
                        props.onSelectWorkspace(workspace.path)
                      },
                    },
                    h('span', { className: 'dgt-repo-menu-title' }, workspace.title),
                    h('span', { className: 'dgt-repo-menu-path' }, workspace.path),
                  ),
                ),
          )
        : null,
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
