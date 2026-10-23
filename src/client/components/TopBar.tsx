// Toolbar: repository switcher, branch and sync state, and the actions the
// panel really supports (refresh, reveal in Finder, open a terminal, focus the
// commit box, and the keycap badge that toggles the panel). The two local open
// actions only exist on macOS; elsewhere they are not rendered at all rather
// than shown as dead buttons. The badge renders nothing when the keyboard
// command is unbound.

import { h, React } from '../react'
import type { GitStatusPayload, OpenTarget, Translate, WorkspaceRecord } from '../types'
import { lastSegment } from '../model'
import { Chip, ShortcutCaps } from './atoms'
import { CommitIcon, FetchIcon, FolderIcon, PinIcon, PullIcon, PushIcon, RefreshIcon, TerminalIcon } from '../icons'
import { usePopover } from '../menu'
import { togglePanelFromUi, useShortcutCaps } from '../shortcut'

export function TopBar(props: {
  status: GitStatusPayload | null
  workspaces: WorkspaceRecord[]
  currentPath: string
  busy: boolean
  opening: boolean
  t: Translate
  onRefresh: () => void
  onOpen: (target: OpenTarget) => void
  onCommitFocus: () => void
  onSelectWorkspace: (path: string) => void
  onTogglePin: (path: string, pinned: boolean) => void
  canFetch: boolean
  hasUpstream: boolean
  fetching: boolean
  pulling: boolean
  onFetch: () => void
  onPull: () => void
}): any {
  const { status, t } = props
  const popover = usePopover()
  const open = popover.open
  const [filter, setFilter] = React.useState('')
  const visible = props.workspaces.filter((workspace) => {
    const needle = filter.trim().toLowerCase()
    if (needle === '') return true
    return (workspace.title + ' ' + workspace.path).toLowerCase().includes(needle)
  })
  const branch = status?.branch && status.branch !== '(detached)' ? status.branch : status?.branch || '—'
  const ahead = status?.ahead ?? 0
  const behind = status?.behind ?? 0
  const staged = status?.counts?.staged ?? 0
  const pinnedVisible = visible.filter((workspace) => workspace.pinned === true)
  const otherVisible = visible.filter((workspace) => workspace.pinned !== true)
  const repoPath = props.currentPath || status?.repoRoot || status?.cwd || ''
  const current = props.workspaces.find((workspace) => workspace.path === repoPath)
  const title = current?.title || (status?.repoRoot ? lastSegment(status.repoRoot) : t('panel'))
  // Keycaps for the panel toggle, straight from the live shortcut catalog: an
  // unbound (or unavailable) command renders no badge at all.
  const caps = useShortcutCaps()

  const renderRow = (workspace: WorkspaceRecord): any =>
    h(
      'div',
      {
        key: workspace.id,
        className: 'dgt-repo-row',
        role: 'option',
        tabIndex: 0,
        'aria-selected': workspace.path === repoPath,
        'data-current': workspace.path === repoPath || undefined,
        title:
          (workspace.openCount ?? 0) > 0
            ? workspace.path + ' · ' + t('openedTimes') + ' ' + String(workspace.openCount)
            : workspace.path,
        onClick: () => {
          popover.close()
          props.onSelectWorkspace(workspace.path)
        },
        onKeyDown: (event: any) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            popover.close()
            props.onSelectWorkspace(workspace.path)
          }
        },
      },
      h(
        'span',
        { className: 'dgt-repo-row-main' },
        h(
          'span',
          { className: 'dgt-repo-menu-title' },
          workspace.path === repoPath ? h('span', { className: 'dgt-repo-check' }, '✓') : null,
          workspace.title,
        ),
        h('span', { className: 'dgt-repo-menu-path' }, workspace.path),
      ),
      (workspace.openCount ?? 0) > 0
        ? h('span', { className: 'dgt-repo-count', title: t('openedTimes') }, String(workspace.openCount))
        : null,
      h(
        'button',
        {
          type: 'button',
          className: 'dgt-repo-pin',
          'data-pinned': workspace.pinned ? true : undefined,
          'aria-pressed': workspace.pinned === true,
          'aria-label': workspace.pinned ? t('unpinRepository') : t('pinRepository'),
          title: workspace.pinned ? t('unpinRepository') : t('pinRepository'),
          onClick: (event: any) => {
            event.stopPropagation()
            props.onTogglePin(workspace.path, workspace.pinned !== true)
          },
          onKeyDown: (event: any) => event.stopPropagation(),
        },
        h(PinIcon, { filled: workspace.pinned === true }),
      ),
    )

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
          ref: popover.triggerRef,
          onClick: popover.toggle,
        },
        h('span', { className: 'dgt-repo-name' }, title),
        h('span', { className: 'dgt-repo-caret', 'aria-hidden': 'true' }, '▾'),
      ),
      h('span', { className: 'dgt-repo-path', title: repoPath }, repoPath || '—'),
      open
        ? h(
            'div',
            { className: 'dgt-repo-menu', role: 'listbox', 'aria-label': t('switchRepository'), ref: popover.menuRef },
            h('input', {
              className: 'dgt-repo-filter',
              value: filter,
              placeholder: t('repoFilter'),
              'aria-label': t('repoFilter'),
              spellCheck: false,
              autoFocus: true,
              onChange: (event: any) => setFilter(event.target.value),
            }),
            visible.length === 0
              ? h('div', { className: 'dgt-repo-menu-empty' }, t('noRepositories'))
              : h(
                  'div',
                  { className: 'dgt-repo-sections' },
                  pinnedVisible.length > 0
                    ? h(
                        'div',
                        { className: 'dgt-repo-section' },
                        h(
                          'div',
                          { className: 'dgt-repo-section-head' },
                          h(PinIcon, { filled: true }),
                          h('span', null, t('pinnedSection')),
                          h('span', { className: 'dgt-repo-section-count' }, String(pinnedVisible.length)),
                        ),
                        pinnedVisible.map(renderRow),
                      )
                    : null,
                  otherVisible.length > 0
                    ? h(
                        'div',
                        { className: 'dgt-repo-section' },
                        h(
                          'div',
                          { className: 'dgt-repo-section-head' },
                          h('span', null, pinnedVisible.length > 0 ? t('allRepositories') : t('repositoriesSection')),
                          h('span', { className: 'dgt-repo-section-count' }, String(otherVisible.length)),
                        ),
                        otherVisible.map(renderRow),
                      )
                    : null,
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
          title: props.canFetch ? t('fetch') : t('pushNoRemote'),
          'aria-label': t('fetch'),
          'data-busy': props.fetching || undefined,
          disabled: !props.canFetch || props.busy || props.fetching || props.pulling,
          onClick: props.onFetch,
        },
        h(FetchIcon),
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'dgt-iconbtn',
          title: !props.canFetch
            ? t('pushNoRemote')
            : props.hasUpstream && behind === 0
              ? t('pullUpToDate')
              : t('pull') + (behind > 0 ? ' · ↓' + String(behind) : ''),
          'aria-label': t('pull') + ' ' + branch,
          'data-busy': props.pulling || undefined,
          disabled:
            !props.canFetch || (props.hasUpstream && behind === 0) || props.busy || props.pulling || props.fetching,
          onClick: props.onPull,
        },
        h(PullIcon),
        behind > 0 ? h('span', { className: 'dgt-iconbtn-count' }, String(behind)) : null,
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'dgt-iconbtn',
          title: props.canPush
            ? t('push') + ' ' + branch + (ahead > 0 ? ' · ↑' + String(ahead) : '')
            : t('pushNoRemote'),
          'aria-label': t('push') + ' ' + branch,
          disabled: !props.canPush || props.busy,
          onClick: props.onPush,
        },
        h(PushIcon),
      ),
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
      status?.platform === 'darwin'
        ? h(
            'button',
            {
              type: 'button',
              className: 'dgt-iconbtn',
              title: t('revealInFinder'),
              'aria-label': t('revealInFinder'),
              'aria-busy': props.opening || undefined,
              disabled: props.opening,
              onClick: () => props.onOpen('finder'),
            },
            h(FolderIcon),
          )
        : null,
      status?.platform === 'darwin'
        ? h(
            'button',
            {
              type: 'button',
              className: 'dgt-iconbtn',
              title: t('openInTerminal'),
              'aria-label': t('openInTerminal'),
              'aria-busy': props.opening || undefined,
              disabled: props.opening,
              onClick: () => props.onOpen('terminal'),
            },
            h(TerminalIcon),
          )
        : null,
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
      caps.length > 0
        ? h(
            'button',
            {
              type: 'button',
              className: 'dgt-kbd',
              title: t('shortcutToggle'),
              'aria-label': t('shortcutToggle'),
              onClick: togglePanelFromUi,
            },
            h(ShortcutCaps, { caps }),
          )
        : null,
    ),
  )
}
