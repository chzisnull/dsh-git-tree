// History view: commits newest-first with a lane graph, five columns, a branch
// scope switch and paged loading. Selecting a commit opens the detail pane with
// its changed files and the per-file diff.

import { h } from '../../react'
import type { CommitDetailPayload, DiffPayload, HistoryCommit, HistoryScope, Translate } from '../../types'
import { DiffFileBlock } from '../DiffView'

const LANE_GAP = 14
const GRAPH_WIDTH = 88
const ROW_HEIGHT = 24

function laneX(lane: number): number {
  return 12 + lane * LANE_GAP
}

function formatDate(value: string): string {
  const text = String(value || '')
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(text)
  return match ? match[1] + '-' + match[2] + '-' + match[3] + ' ' + match[4] + ':' + match[5] : text
}

function graphOf(commit: HistoryCommit): any {
  const y = ROW_HEIGHT / 2
  const x = laneX(commit.lane)
  const edges = commit.parentLanes.map((parentLane, index) =>
    h('line', {
      key: 'edge:' + String(index),
      x1: x,
      y1: y + 4,
      x2: laneX(parentLane),
      y2: ROW_HEIGHT,
      stroke: 'currentColor',
      strokeWidth: 1.6,
    }),
  )
  return h(
    'svg',
    {
      className: 'dgt-graph',
      width: GRAPH_WIDTH,
      height: ROW_HEIGHT,
      'aria-hidden': 'true',
      focusable: 'false',
      style: { color: 'var(--dgt-lane-' + String(commit.lane % 5) + ')' },
    },
    edges,
    h('circle', { cx: x, cy: y, r: 4, fill: 'currentColor' }),
  )
}

function Detail(props: {
  detail: CommitDetailPayload | null
  detailLoading: boolean
  detailError: string
  selectedFile: string
  fileDiff: DiffPayload | null
  fileDiffLoading: boolean
  t: Translate
  onSelectFile: (path: string) => void
  onParent: (sha: string) => void
}): any {
  const { detail, t } = props
  if (props.detailLoading && detail === null) {
    return h('div', { className: 'dgt-detail' }, h('div', { className: 'dgt-placeholder' }, t('loading')))
  }
  if (props.detailError !== '') {
    return h('div', { className: 'dgt-detail' }, h('div', { className: 'dgt-placeholder dgt-error' }, props.detailError))
  }
  if (detail === null) {
    return h('div', { className: 'dgt-detail' }, h('div', { className: 'dgt-placeholder' }, t('selectCommit')))
  }

  const files = detail.files ?? []
  const parents = detail.parents ?? []

  return h(
    'div',
    { className: 'dgt-detail' },
    h(
      'div',
      { className: 'dgt-detail-side' },
      h(
        'div',
        { className: 'dgt-detail-meta' },
        h('div', { className: 'dgt-detail-subject', title: detail.subject }, detail.subject ?? ''),
        h('div', { className: 'dgt-detail-sha' }, detail.sha ?? ''),
        h('div', { className: 'dgt-detail-line' }, (detail.author ?? '') + (detail.authorEmail ? ' <' + detail.authorEmail + '>' : '')),
        h('div', { className: 'dgt-detail-line' }, formatDate(detail.date ?? '')),
        parents.length > 0
          ? h(
              'div',
              { className: 'dgt-detail-line' },
              h('span', { className: 'dgt-detail-label' }, t('parentsField') + ': '),
              parents.map((sha, index) =>
                h(
                  'button',
                  {
                    key: sha + ':' + String(index),
                    type: 'button',
                    className: 'dgt-link',
                    onClick: () => props.onParent(sha),
                  },
                  sha.slice(0, 8),
                ),
              ),
            )
          : null,
        detail.body ? h('pre', { className: 'dgt-detail-body' }, detail.body) : null,
      ),
      h('div', { className: 'dgt-detail-head' }, t('changedFiles')),
      files.length === 0
        ? h('div', { className: 'dgt-placeholder' }, t('noFiles'))
        : h(
            'div',
            { className: 'dgt-detail-list' },
            files.map((file) =>
              h(
                'button',
                {
                  key: file.path,
                  type: 'button',
                  className: 'dgt-detail-file',
                  'data-active': props.selectedFile === file.path || undefined,
                  title: file.origPath ? file.path + ' ← ' + file.origPath : file.path,
                  onClick: () => props.onSelectFile(file.path),
                },
                h('span', { className: 'dgt-detail-letter', 'data-status': file.status }, file.status[0].toUpperCase()),
                h('span', { className: 'dgt-detail-path' }, file.path),
              ),
            ),
          ),
    ),
    h(
      'div',
      { className: 'dgt-detail-diff' },
      props.selectedFile === ''
        ? h('div', { className: 'dgt-placeholder' }, t('selectCommitFile'))
        : props.fileDiffLoading
          ? h('div', { className: 'dgt-placeholder' }, t('loading'))
          : props.fileDiff && props.fileDiff.ok === false
            ? h('div', { className: 'dgt-placeholder dgt-error' }, props.fileDiff.error || t('diffFailed'))
            : props.fileDiff && props.fileDiff.binary
              ? h('div', { className: 'dgt-placeholder' }, t('binaryFile'))
              : props.fileDiff && props.fileDiff.files && props.fileDiff.files.length > 0
                ? props.fileDiff.files.map((file, index) =>
                    h(DiffFileBlock, { key: 'detail-file:' + String(index), file, t }),
                  )
                : h('div', { className: 'dgt-placeholder' }, t('noDiff')),
    ),
  )
}

export function HistoryView(props: {
  commits: HistoryCommit[]
  laneCount: number
  hasMore: boolean
  loading: boolean
  error: string
  scope: HistoryScope
  selectedSha: string
  detail: CommitDetailPayload | null
  detailLoading: boolean
  detailError: string
  selectedFile: string
  fileDiff: DiffPayload | null
  fileDiffLoading: boolean
  t: Translate
  onScope: (scope: HistoryScope) => void
  onSelect: (commit: HistoryCommit) => void
  onLoadMore: () => void
  onSelectFile: (path: string) => void
  onParent: (sha: string) => void
}): any {
  const { commits, t } = props

  return h(
    'div',
    { className: 'dgt-main' },
    h(
      'div',
      { className: 'dgt-history' },
      h(
        'div',
        { className: 'dgt-htoolbar' },
        h(
          'div',
          { className: 'dgt-seg', role: 'group' },
          h(
            'button',
            {
              type: 'button',
              className: 'dgt-seg-btn',
              'data-active': props.scope === 'all' || undefined,
              onClick: () => props.onScope('all'),
            },
            t('allBranches'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dgt-seg-btn',
              'data-active': props.scope === 'current' || undefined,
              onClick: () => props.onScope('current'),
            },
            t('currentBranchOnly'),
          ),
        ),
      ),
      h(
        'div',
        { className: 'dgt-hhead', role: 'row' },
        h('span', null, t('historyColumn')),
        h('span', null, t('description')),
        h('span', null, t('commitColumn')),
        h('span', null, t('authorColumn')),
        h('span', null, t('dateColumn')),
      ),
      h(
        'div',
        { className: 'dgt-hscroll' },
        props.loading && commits.length === 0
          ? h('div', { className: 'dgt-placeholder' }, t('loading'))
          : props.error !== ''
            ? h('div', { className: 'dgt-placeholder dgt-error' }, props.error)
            : commits.length === 0
              ? h('div', { className: 'dgt-empty' }, t('noCommits'))
              : h(
                  'div',
                  { className: 'dgt-hlist' },
                  commits.map((commit) =>
                    h(
                      'div',
                      {
                        key: commit.sha,
                        className: 'dgt-hrow',
                        'data-active': commit.sha === props.selectedSha || undefined,
                        role: 'button',
                        tabIndex: 0,
                        onClick: () => props.onSelect(commit),
                        onKeyDown: (event: any) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            props.onSelect(commit)
                          }
                        },
                      },
                      h('span', { className: 'dgt-hgraph' }, graphOf(commit)),
                      h(
                        'span',
                        { className: 'dgt-hsubject', title: commit.subject },
                        h('span', { className: 'dgt-hsubject-text' }, commit.subject),
                        commit.refs.map((ref) =>
                          h(
                            'span',
                            { key: ref.kind + ':' + ref.name, className: 'dgt-refchip', 'data-kind': ref.kind },
                            ref.name,
                          ),
                        ),
                      ),
                      h('span', { className: 'dgt-hsha' }, commit.sha.slice(0, 8)),
                      h('span', { className: 'dgt-hauthor', title: commit.author }, commit.author),
                      h('span', { className: 'dgt-hdate' }, formatDate(commit.date)),
                    ),
                  ),
                  props.hasMore
                    ? h(
                        'div',
                        { className: 'dgt-hmore' },
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'dgt-button',
                            onClick: props.onLoadMore,
                            disabled: props.loading,
                          },
                          t('loadMore'),
                        ),
                      )
                    : null,
                ),
      ),
      h(Detail, {
        detail: props.detail,
        detailLoading: props.detailLoading,
        detailError: props.detailError,
        selectedFile: props.selectedFile,
        fileDiff: props.fileDiff,
        fileDiffLoading: props.fileDiffLoading,
        t,
        onSelectFile: props.onSelectFile,
        onParent: props.onParent,
      }),
    ),
  )
}
