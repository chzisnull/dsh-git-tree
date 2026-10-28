// Small modal dialogs for branch operations. One prompt (create / rename) and
// one confirm (delete); both keep the typed value and any failure on screen.

import { h, React } from '../react'
import type { DiffPayload, Translate } from '../types'
import type { HandoffFailure } from '../handoff'
import { DiffFileBlock } from './DiffView'

export function PromptDialog(props: {
  title: string
  label: string
  initial: string
  submitLabel: string
  busy: boolean
  error: string
  t: Translate
  onCancel: () => void
  onSubmit: (value: string) => void
}): any {
  const [value, setValue] = React.useState(props.initial)
  const submit = () => {
    const next = value.trim()
    if (next !== '') props.onSubmit(next)
  }
  return h(
    'div',
    { className: 'dgt-overlay', role: 'presentation', onClick: props.onCancel },
    h(
      'div',
      { className: 'dgt-dialog', role: 'dialog', 'aria-modal': 'true', onClick: (event: any) => event.stopPropagation() },
      h('div', { className: 'dgt-dialog-title' }, props.title),
      h('label', { className: 'dgt-dialog-label' }, props.label),
      h('input', {
        className: 'dgt-dialog-input',
        value,
        autoFocus: true,
        spellCheck: false,
        onChange: (event: any) => setValue(event.target.value),
        onKeyDown: (event: any) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            submit()
          }
          if (event.key === 'Escape') props.onCancel()
        },
      }),
      props.error !== '' ? h('div', { className: 'dgt-dialog-error' }, props.error) : null,
      h(
        'div',
        { className: 'dgt-dialog-actions' },
        h('button', { type: 'button', className: 'dgt-button', onClick: props.onCancel }, props.t('cancel')),
        h(
          'button',
          { type: 'button', className: 'dgt-primary', disabled: props.busy || value.trim() === '', onClick: submit },
          props.submitLabel,
        ),
      ),
    ),
  )
}

export function ConfirmDialog(props: {
  title: string
  body: string
  submitLabel: string
  busy: boolean
  error: string
  t: Translate
  /** Destructive confirmations stay red; network/history ones read as primary. */
  tone?: 'danger' | 'primary'
  onCancel: () => void
  onConfirm: () => void
}): any {
  return h(
    'div',
    { className: 'dgt-overlay', role: 'presentation', onClick: props.onCancel },
    h(
      'div',
      { className: 'dgt-dialog', role: 'dialog', 'aria-modal': 'true', onClick: (event: any) => event.stopPropagation() },
      h('div', { className: 'dgt-dialog-title' }, props.title),
      h('div', { className: 'dgt-dialog-body' }, props.body),
      props.error !== '' ? h('div', { className: 'dgt-dialog-error' }, props.error) : null,
      h(
        'div',
        { className: 'dgt-dialog-actions' },
        h('button', { type: 'button', className: 'dgt-button', onClick: props.onCancel }, props.t('cancel')),
        h(
          'button',
          {
            type: 'button',
            className: (props.tone ?? 'danger') === 'primary' ? 'dgt-primary' : 'dgt-primary dgt-danger',
            disabled: props.busy,
            onClick: props.onConfirm,
          },
          props.submitLabel,
        ),
      ),
    ),
  )
}


/**
 * Preview of one AI conflict resolution. Nothing is written until "Apply":
 * the body shows the model's merged file as a diff against the conflicted
 * working copy, so the review is line by line rather than a wall of text.
 */
export function ConflictDialog(props: {
  path: string
  provider: string
  model: string
  content: string
  diff: DiffPayload | null
  busy: boolean
  error: string
  t: Translate
  onCancel: () => void
  onApply: () => void
}): any {
  const stats = props.diff?.stats
  const files = props.diff?.files ?? []
  return h(
    'div',
    { className: 'dgt-overlay', role: 'presentation', onClick: props.busy ? undefined : props.onCancel },
    h(
      'div',
      {
        className: 'dgt-dialog dgt-conflict-dialog',
        role: 'dialog',
        'aria-modal': 'true',
        onClick: (event: any) => event.stopPropagation(),
      },
      h('div', { className: 'dgt-dialog-title' }, props.t('conflictPreviewTitle')),
      h(
        'div',
        { className: 'dgt-conflict-dialog-meta' },
        h('span', { className: 'dgt-dialog-label' }, props.path),
        props.model !== ''
          ? h('span', { className: 'dgt-conflict-dialog-model' }, props.provider + ' / ' + props.model)
          : null,
        stats
          ? h(
              'span',
              { className: 'dgt-stats' },
              h('span', { className: 'dgt-stat-add' }, '+' + String(stats.additions)),
              h('span', { className: 'dgt-stat-del' }, '−' + String(stats.deletions)),
            )
          : null,
      ),
      h(
        'div',
        { className: 'dgt-conflict-dialog-body' },
        files.length > 0
          ? files.map((file, index) => h(DiffFileBlock, { key: 'cf:' + String(index), file, t: props.t }))
          : h('pre', { className: 'dgt-conflict-dialog-text' }, props.content),
      ),
      h('div', { className: 'dgt-dialog-label' }, props.t('conflictPreviewHint')),
      props.error !== '' ? h('div', { className: 'dgt-dialog-error' }, props.error) : null,
      h(
        'div',
        { className: 'dgt-dialog-actions' },
        h(
          'button',
          { type: 'button', className: 'dgt-button', disabled: props.busy, onClick: props.onCancel },
          props.t('cancel'),
        ),
        h(
          'button',
          { type: 'button', className: 'dgt-primary', disabled: props.busy, onClick: props.onApply },
          props.busy ? props.t('loading') : props.t('applyResolution'),
        ),
      ),
    ),
  )
}

/**
 * Fallback when no session can be opened: state the reason and hand the prompt
 * over, so the work is not stuck inside a panel that cannot start a session.
 */
const HANDOFF_BODY: Record<HandoffFailure, string> = {
  'no-workspace': 'handoffNoWorkspace',
  unavailable: 'handoffUnavailable',
  failed: 'handoffFailedBody',
}

export function HandoffDialog(props: {
  reason: HandoffFailure
  prompt: string
  /** The prompt is already on the clipboard; show it only when that failed. */
  showPrompt: boolean
  t: Translate
  onCopy: () => void
  onClose: () => void
}): any {
  const body = props.t(HANDOFF_BODY[props.reason])
  return h(
    'div',
    { className: 'dgt-overlay', role: 'presentation', onClick: props.onClose },
    h(
      'div',
      {
        className: 'dgt-dialog dgt-handoff-dialog',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': props.t('handoffFallbackTitle'),
        onClick: (event: any) => event.stopPropagation(),
      },
      h('div', { className: 'dgt-dialog-title' }, props.t('handoffFallbackTitle')),
      h('div', { className: 'dgt-dialog-label' }, body),
      props.showPrompt ? h('pre', { className: 'dgt-handoff-prompt', tabIndex: 0 }, props.prompt) : null,
      h(
        'div',
        { className: 'dgt-dialog-actions' },
        h('button', { type: 'button', className: 'dgt-button', onClick: props.onClose }, props.t('close')),
        props.showPrompt
          ? h('button', { type: 'button', className: 'dgt-primary', onClick: props.onCopy }, props.t('handoffCopy'))
          : null,
      ),
    ),
  )
}
