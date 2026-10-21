// Small modal dialogs for branch operations. One prompt (create / rename) and
// one confirm (delete); both keep the typed value and any failure on screen.

import { h, React } from '../react'
import type { Translate } from '../types'

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
          { type: 'button', className: 'dgt-primary dgt-danger', disabled: props.busy, onClick: props.onConfirm },
          props.submitLabel,
        ),
      ),
    ),
  )
}
