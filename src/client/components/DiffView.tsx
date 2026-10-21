// Diff pane: a file header with stats and a file-level action, then hunks
// rendered line by line (gutters, whole-row tint, hunk headers). No syntax
// highlighting, matching Sourcetree: which lines changed beats which token is
// a keyword.

import { h } from '../react'
import type { DiffFile, DiffLine, DiffPayload, EntrySide, GitFileEntry, Translate } from '../types'

function Line(props: { line: DiffLine }): any {
  const line = props.line
  const marker = line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : line.kind === 'meta' ? '' : ' '
  return h(
    'div',
    { className: 'dgt-line', 'data-kind': line.kind },
    h('span', { className: 'dgt-gutter' }, line.oldNo === null ? '' : String(line.oldNo)),
    h('span', { className: 'dgt-gutter' }, line.newNo === null ? '' : String(line.newNo)),
    h('span', { className: 'dgt-marker' }, marker),
    h('span', { className: 'dgt-text' }, line.text),
  )
}

export function DiffFileBlock(props: { file: DiffFile; t: Translate }): any {
  const file = props.file
  if (file.binary) {
    return h('div', { className: 'dgt-placeholder' }, props.t('binaryFile'))
  }
  const moved = Boolean(file.oldPath && file.newPath && file.oldPath !== file.newPath)
  return h(
    'div',
    { className: 'dgt-file-block' },
    moved
      ? h(
          'div',
          { className: 'dgt-hunk-head' },
          h('span', null, file.status),
          h('span', null, (file.oldPath ?? '') + ' → ' + (file.newPath ?? '')),
        )
      : null,
    file.hunks.map((hunk, hunkIndex) =>
      h(
        'div',
        { className: 'dgt-hunk', key: 'hunk:' + String(hunkIndex) },
        h('div', { className: 'dgt-hunk-head' }, h('span', null, hunk.header)),
        hunk.lines.map((line, lineIndex) => h(Line, { key: 'l:' + String(lineIndex), line })),
      ),
    ),
  )
}

export function DiffView(props: {
  selected: { entry: GitFileEntry; side: EntrySide } | null
  diff: DiffPayload | null
  loading: boolean
  hasChanges: boolean
  t: Translate
  onToggleFile: () => void
}): any {
  const { selected, diff, loading, t } = props
  const entry = selected?.entry ?? null
  const side = selected?.side ?? 'unstaged'
  const stats = diff?.stats
  const canAct = entry !== null && !entry.conflicted
  const actionLabel = side === 'staged' ? t('unstageFile') : t('stageFile')

  return h(
    'section',
    { className: 'dgt-diff', 'aria-label': t('code') },
    h(
      'div',
      { className: 'dgt-diff-head' },
      h('span', { className: 'dgt-diff-path' }, entry?.path ?? t('diff')),
      entry?.origPath
        ? h('span', { className: 'dgt-diff-orig' }, t('renameFrom') + ' ' + entry.origPath)
        : null,
      stats && (stats.additions > 0 || stats.deletions > 0)
        ? h(
            'span',
            { className: 'dgt-stats' },
            h('span', { className: 'dgt-stat-add' }, '+' + String(stats.additions)),
            h('span', { className: 'dgt-stat-del' }, '−' + String(stats.deletions)),
          )
        : null,
      canAct
        ? h(
            'button',
            {
              type: 'button',
              className: 'dgt-diff-action',
              'data-kind': side === 'staged' ? 'unstage' : 'stage',
              onClick: props.onToggleFile,
            },
            actionLabel,
          )
        : null,
    ),
    h(
      'div',
      { className: 'dgt-diff-body' },
      entry === null
        ? h('div', { className: 'dgt-empty' }, props.hasChanges ? t('noFileSelected') : t('nothingHint'))
        : loading
          ? h('div', { className: 'dgt-empty' }, t('loading'))
          : diff && diff.ok === false
            ? h('div', { className: 'dgt-empty' }, diff.error || t('diffFailed'))
            : diff && diff.binary
              ? h('div', { className: 'dgt-empty' }, t('binaryFile'))
              : diff && diff.files && diff.files.length > 0
                ? diff.files.map((file, index) => h(DiffFileBlock, { key: 'file:' + String(index), file, t }))
                : h(
                    'div',
                    { className: 'dgt-empty' },
                    entry.kind === 'untracked' ? t('untrackedNoDiff') : t('noDiff'),
                  ),
    ),
  )
}
