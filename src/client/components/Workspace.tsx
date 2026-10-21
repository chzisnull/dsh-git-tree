// The workspace panel: state, host calls and the three-pane layout
// (references rail / change list / diff).

import { h, React } from '../react'
import type { DiffPayload, GitFileEntry, GitStatusPayload, Translate } from '../types'
import { fetchDiff, fetchStatus } from '../routes'
import { isStaged, lastSegment } from '../model'
import { Chip, Spinner } from './atoms'
import { RefRail } from './RefRail'
import { ChangeList } from './ChangeList'
import { DiffView } from './DiffView'

export function Workspace(props: { t?: Translate }): any {
  const t: Translate = typeof props.t === 'function' ? props.t : (key: string) => key

  const [status, setStatus] = React.useState<GitStatusPayload | null>(null)
  const [statusError, setStatusError] = React.useState('')
  const [refreshing, setRefreshing] = React.useState(false)
  const [selected, setSelected] = React.useState<GitFileEntry | null>(null)
  const [diff, setDiff] = React.useState<DiffPayload | null>(null)
  const [diffLoading, setDiffLoading] = React.useState(false)

  const loadStatus = React.useCallback(
    async (signal?: AbortSignal) => {
      setRefreshing(true)
      try {
        const next = await fetchStatus(signal)
        if (signal?.aborted) return
        if (next.ok) {
          setStatus(next)
          setStatusError('')
        } else {
          setStatus(null)
          setStatusError(next.error || t('statusFailed'))
        }
      } catch (error) {
        if (signal?.aborted) return
        // A missing host route means the host half is not active (or not built):
        // render the shell instead of crashing the slot entry.
        setStatus(null)
        setStatusError(error instanceof Error ? error.message : String(error))
      } finally {
        if (!signal?.aborted) setRefreshing(false)
      }
    },
    [t],
  )

  React.useEffect(() => {
    const controller = new AbortController()
    void loadStatus(controller.signal)
    return () => controller.abort()
  }, [loadStatus])

  const openDiff = React.useCallback(async (entry: GitFileEntry, signal?: AbortSignal) => {
    setSelected(entry)
    setDiff(null)
    if (entry.kind === 'ignored') return
    setDiffLoading(true)
    try {
      // A fully staged entry is previewed from the index (`git diff --cached`);
      // everything else is previewed against the index (plain `git diff`).
      const next = await fetchDiff(
        { path: entry.path, staged: isStaged(entry) ? '1' : '0' },
        signal,
      )
      if (!signal?.aborted) setDiff(next)
    } catch (error) {
      if (!signal?.aborted) setDiff({ ok: false, error: error instanceof Error ? error.message : String(error) })
    } finally {
      if (!signal?.aborted) setDiffLoading(false)
    }
  }, [])

  const entries = status?.entries ?? []
  const staged = entries.filter(isStaged)
  const working = entries.filter((entry) => !isStaged(entry))

  const branchLabel = status?.branch && status.branch !== '(detached)' ? status.branch : status?.branch || '—'

  return h(
    'div',
    { className: 'dgt-root', 'data-plugin': 'dsh-git-tree' },

    // top bar: repo identity, branch, ahead/behind, actions
    h(
      'header',
      { className: 'dgt-topbar' },
      h(
        'div',
        { className: 'dgt-repo' },
        h('span', { className: 'dgt-repo-name' }, status?.repoRoot ? lastSegment(status.repoRoot) : t('panel')),
        h(
          'span',
          { className: 'dgt-repo-path', title: status?.cwd || status?.repoRoot || '' },
          status?.repoRoot || status?.cwd || '—',
        ),
      ),
      h(
        'div',
        { className: 'dgt-refs' },
        h(Chip, { tone: 'muted' }, h('span', { className: 'dgt-branch-glyph', 'aria-hidden': 'true' }, '⎇'), ' ', branchLabel),
        typeof status?.ahead === 'number' && status.ahead > 0 ? h(Chip, { tone: 'ok' }, '↑' + String(status.ahead)) : null,
        typeof status?.behind === 'number' && status.behind > 0
          ? h(Chip, { tone: 'warn' }, '↓' + String(status.behind))
          : null,
        status?.upstream ? h('span', { className: 'dgt-upstream' }, status.upstream) : null,
      ),
      h(
        'div',
        { className: 'dgt-actions' },
        refreshing ? h(Spinner) : null,
        h(
          'button',
          {
            type: 'button',
            className: 'dgt-button',
            onClick: () => void loadStatus(),
            disabled: refreshing,
            title: t('refresh'),
          },
          '⟳ ' + t('refresh'),
        ),
      ),
    ),

    statusError !== ''
      ? h(
          'div',
          { className: 'dgt-banner', role: 'status' },
          h('strong', null, t('hostUnavailable')),
          h('span', null, statusError),
        )
      : null,

    // three-pane workspace: refs rail / change list / diff
    h(
      'div',
      { className: 'dgt-body' },
      h(RefRail, { t }),
      h(ChangeList, {
        status,
        statusError,
        entries,
        staged,
        working,
        selected,
        t,
        onSelect: (picked: GitFileEntry) => void openDiff(picked),
      }),
      h(DiffView, { selected, loading: diffLoading, diff, t }),
    ),
  )
}
