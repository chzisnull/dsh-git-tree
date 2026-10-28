// Diff pane: a file header with stats and a file-level action, then hunks
// rendered line by line (gutters, whole-row tint, hunk headers). No syntax
// highlighting, matching Sourcetree: which lines changed beats which token is
// a keyword.
//
// A conflicted file has no ordinary unified diff — git prints a combined one —
// so the host answers with the working-tree file and this pane renders its
// conflict blocks instead. The header offers the hand-off (open a session with
// the prompt) plus mark-resolved and restore; the in-panel model merge lives in
// the file row's context menu.
//
// The empty pane also carries the panel-toggle hint: it is the one surface a
// user stares at when nothing is selected, and it disappears together with the
// badge when the keybinding is unbound.

import { h } from '../react'
import type {
  ConflictLine,
  ConflictPayload,
  DiffFile,
  DiffLine,
  DiffPayload,
  EntrySide,
  GitFileEntry,
  Translate,
} from '../types'
import { useShortcutState } from '../shortcut'
import { ShortcutCaps } from './atoms'

/**
 * Empty-pane hint for the panel toggle: the one place a user is guaranteed to
 * look when the diff is blank. Renders nothing when the command is unbound.
 */
function ShortcutHint(props: { t: Translate }): any {
  const shortcut = useShortcutState()
  // No service means no settings page to point at; say nothing.
  if (shortcut.status === 'unavailable') return null
  if (shortcut.status === 'unbound') {
    return h('span', { className: 'dgt-shortcut-hint' }, props.t('shortcutUnbound'))
  }
  return h(
    'span',
    { className: 'dgt-shortcut-hint' },
    h('span', null, props.t('shortcutHintBefore')),
    h(ShortcutCaps, { caps: shortcut.caps }),
    h('span', null, props.t('shortcutHintAfter')),
  )
}

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

function ConflictLineRow(props: { line: ConflictLine; index: number }): any {
  const line = props.line
  return h(
    'div',
    { className: 'dgt-cfline', 'data-kind': line.kind },
    h('span', { className: 'dgt-cfline-no' }, String(props.index + 1)),
    h('span', { className: 'dgt-cfline-text' }, line.text === '' ? ' ' : line.text),
  )
}

function ConflictBody(props: { conflict: ConflictPayload; t: Translate }): any {
  const conflict = props.conflict
  return h(
    'div',
    { className: 'dgt-conflict' },
    h(
      'div',
      { className: 'dgt-conflict-head' },
      h(
        'span',
        { className: 'dgt-conflict-count', 'data-tone': conflict.blocks > 0 ? 'warn' : 'ok' },
        conflict.blocks > 0 ? String(conflict.blocks) + ' ' + props.t('conflictBlocks') : props.t('conflictClean'),
      ),
      h(
        'span',
        { className: 'dgt-conflict-meta' },
        (conflict.labels.ours || 'ours') +
          ' ' +
          String(conflict.ours) +
          ' ' +
          props.t('conflictLines') +
          ' · ' +
          (conflict.labels.theirs || 'theirs') +
          ' ' +
          String(conflict.theirs) +
          ' ' +
          props.t('conflictLines'),
      ),
    ),
    conflict.lines.map((line, index) => h(ConflictLineRow, { key: 'cf:' + String(index), line, index })),
  )
}

export function DiffView(props: {
  selected: { entry: GitFileEntry; side: EntrySide } | null
  diff: DiffPayload | null
  loading: boolean
  hasChanges: boolean
  t: Translate
  onToggleFile: () => void
  conflict: {
    busy: boolean
    opening: boolean
    onHandoff: () => void
    onRevert: () => void
    onMarkResolved: () => void
  }
}): any {
  const { selected, diff, loading, t } = props
  const entry = selected?.entry ?? null
  const side = selected?.side ?? 'unstaged'
  const stats = diff?.stats
  const conflicted = entry !== null && entry.conflicted
  const actionLabel = side === 'staged' ? t('unstageFile') : t('stageFile')
  const conflict = diff?.conflict
  const markersLeft = conflict ? conflict.blocks > 0 : true

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
      conflicted
        ? h(
            'div',
            { className: 'dgt-conflict-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'dgt-diff-action dgt-diff-action-ai',
                'data-kind': 'ai',
                'data-busy': props.conflict.opening || undefined,
                disabled: props.conflict.busy || props.conflict.opening,
                title: props.conflict.opening ? t('handoffOpening') : t('handoffTip'),
                onClick: props.conflict.onHandoff,
              },
              props.conflict.opening
                ? h(
                    'span',
                    { className: 'dgt-diff-action-busy' },
                    h('span', { className: 'dgt-spinner', 'aria-hidden': 'true' }),
                    t('handoffOpening'),
                  )
                : h(
                    'span',
                    { className: 'dgt-diff-action-busy' },
                    h('span', { className: 'dgt-diff-action-glyph', 'aria-hidden': 'true' }, '✦'),
                    t('handoff'),
                  ),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dgt-diff-action',
                'data-kind': 'ghost',
                disabled: props.conflict.busy || markersLeft,
                onClick: props.conflict.onMarkResolved,
                title: markersLeft ? t('markResolvedHint') : undefined,
              },
              t('markResolved'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dgt-diff-action',
                'data-kind': 'ghost',
                disabled: props.conflict.busy,
                onClick: props.conflict.onRevert,
              },
              t('revertConflict'),
            ),
          )
        : h(
            'button',
            {
              type: 'button',
              className: 'dgt-diff-action',
              'data-kind': side === 'staged' ? 'unstage' : 'stage',
              onClick: props.onToggleFile,
            },
            actionLabel,
          ),
    ),
    h(
      'div',
      { className: 'dgt-diff-body' },
      entry === null
        ? h(
            'div',
            { className: 'dgt-empty' },
            h('span', null, props.hasChanges ? t('noFileSelected') : t('nothingHint')),
            h(ShortcutHint, { t }),
          )
        : loading
          ? h('div', { className: 'dgt-empty' }, t('loading'))
          : diff && diff.ok === false
            ? h('div', { className: 'dgt-empty' }, diff.error || t('diffFailed'))
            : diff && diff.conflicted && diff.conflict
              ? h(ConflictBody, { conflict: diff.conflict, t })
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
