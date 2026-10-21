// Commit box pinned to the bottom, Sourcetree's shape: author, branch, staged
// count, a message editor, and one primary action. There is no second confirm
// dialog — the box itself is the confirmation, as in Sourcetree.

import { h } from '../react'
import type { GitStatusPayload, Translate } from '../types'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function CommitBox(props: {
  status: GitStatusPayload | null
  message: string
  busy: boolean
  hint: string
  hintTone: 'error' | 'muted'
  t: Translate
  onMessage: (value: string) => void
  onCommit: () => void
  inputRef?: any
  canPush: boolean
  pushAfter: boolean
  onPushAfter: (value: boolean) => void
}): any {
  const { status, t } = props
  const identity = status?.identity
  const staged = status?.counts?.staged ?? 0
  const conflicts = status?.counts?.conflicted ?? 0
  const branch = status?.branch || '—'
  const blocked = conflicts > 0
  const canCommit = staged > 0 && props.message.trim() !== '' && !blocked && !props.busy

  const defaultHint = blocked
    ? t('conflictsBlockCommit')
    : staged === 0
      ? t('commitHint')
      : props.message.trim() === ''
        ? t('commitMessageEmpty')
        : t('commitShortcut')

  return h(
    'div',
    { className: 'dgt-commit' },
    h(
      'div',
      { className: 'dgt-commit-meta' },
      h('span', { className: 'dgt-avatar' }, initials(identity?.name || '') ),
      h(
        'span',
        { className: 'dgt-commit-author' },
        identity?.name ? identity.name + (identity.email ? ' <' + identity.email + '>' : '') : t('author') + ': —',
      ),
      h('span', { className: 'dgt-commit-branch' }, '⎇ ' + branch),
      h('span', { className: 'dgt-commit-branch' }, String(staged) + ' ' + t('filesChanged')),
    ),
    h(
      'div',
      { className: 'dgt-commit-label' },
      h('span', null, t('commitMessageLabel')),
    ),
    h('textarea', {
      className: 'dgt-commit-input',
      ref: props.inputRef,
      value: props.message,
      placeholder: t('commitPlaceholder'),
      spellCheck: false,
      onChange: (event: any) => props.onMessage(event.target.value),
      onKeyDown: (event: any) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          if (canCommit) props.onCommit()
        }
      },
    }),
    h(
      'label',
      {
        className: 'dgt-commit-check',
        'data-disabled': props.canPush ? undefined : true,
        title: props.canPush ? undefined : t('pushNoRemote'),
      },
      h('input', {
        type: 'checkbox',
        checked: props.pushAfter,
        disabled: !props.canPush,
        onChange: (event: any) => props.onPushAfter(event.target.checked),
      }),
      h('span', null, t('pushAfterCommit')),
      props.canPush ? null : h('em', null, t('pushNoRemote')),
    ),
    h(
      'div',
      { className: 'dgt-commit-foot' },
      h(
        'span',
        { className: 'dgt-hint', 'data-tone': props.hintTone === 'error' ? 'error' : undefined },
        props.hint || defaultHint,
      ),
      h(
        'button',
        { type: 'button', className: 'dgt-clear', onClick: () => props.onMessage('') },
        t('clear'),
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'dgt-primary',
          disabled: !canCommit,
          onClick: props.onCommit,
        },
        props.busy ? t('loading') : t('commit'),
      ),
    ),
  )
}
