// Commit box pinned to the bottom, Sourcetree's shape: author, branch, staged
// count, a message editor, and one primary action. There is no second confirm
// dialog — the box itself is the confirmation, as in Sourcetree.
//
// Two auxiliary controls sit in the message label row: "AI generate" writes the
// message from the selected files, and the model chip picks which DSH model
// does it. The model list is the host's live catalog, so the panel never keeps
// a second copy of it.

import { h } from '../react'
import { usePopover } from '../menu'
import { SparkIcon } from '../icons'
import type { AiModelGroup, AiModelRoute, GitStatusPayload, Translate } from '../types'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** Short label the chip shows: the model name, trimmed to fit the card. */
function shortModelName(route: AiModelRoute | null, t: Translate): string {
  if (!route) return t('aiNoModel')
  const name = route.label || route.model
  return name.length > 26 ? name.slice(0, 25) + '…' : name
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
  ai: {
    loading: boolean
    busy: boolean
    groups: AiModelGroup[]
    failures: { id: string; name: string; message: string }[]
    active: AiModelRoute | null
    onGenerate: () => void
    onSelect: (provider: string, model: string) => void
  }
}): any {
  const { status, t, ai } = props
  const identity = status?.identity
  const staged = status?.counts?.staged ?? 0
  const unstaged = status?.counts?.unstaged ?? 0
  const conflicts = status?.counts?.conflicted ?? 0
  const branch = status?.branch || '—'
  const blocked = conflicts > 0
  const canCommit = staged > 0 && props.message.trim() !== '' && !blocked && !props.busy
  const hasChanges = staged + unstaged > 0
  const canGenerate = hasChanges && !ai.busy && !props.busy && !blocked && ai.active !== null
  const picker = usePopover()

  const defaultHint = blocked
    ? t('conflictsBlockCommit')
    : staged === 0
      ? t('commitHint')
      : props.message.trim() === ''
        ? t('commitMessageEmpty')
        : t('commitShortcut')

  const generateTitle = !hasChanges
    ? t('aiNoChanges')
    : blocked
      ? t('conflictsBlockCommit')
      : ai.active === null
        ? t('aiNoModelTip')
        : staged > 0
          ? t('aiFromStaged')
          : t('aiFromAll')

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
      h(
        'div',
        { className: 'dgt-ai' },
        h(
          'button',
          {
            type: 'button',
            className: 'dgt-ai-generate',
            'data-busy': ai.busy ? 'true' : undefined,
            disabled: !canGenerate,
            title: generateTitle,
            onClick: ai.onGenerate,
          },
          h(SparkIcon, null),
          ai.busy ? t('aiGenerating') : t('aiGenerate'),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dgt-ai-chip',
            title: t('aiModelTip'),
            'aria-haspopup': 'listbox',
            'aria-expanded': picker.open,
            ref: picker.triggerRef,
            onClick: picker.toggle,
          },
          h('span', { className: 'dgt-ai-chip-name' }, shortModelName(ai.active, t)),
          h('span', { className: 'dgt-ai-caret', 'aria-hidden': 'true' }, '▾'),
        ),
        picker.open
          ? h(
              'div',
              {
                className: 'dgt-ai-menu',
                role: 'listbox',
                'aria-label': t('aiModel'),
                ref: picker.menuRef,
              },
              h('div', { className: 'dgt-ai-menu-head' }, t('aiModelTip')),
              ai.loading
                ? h('div', { className: 'dgt-ai-menu-empty' }, t('loading'))
                : ai.groups.length === 0
                  ? h('div', { className: 'dgt-ai-menu-empty' }, ai.error || t('aiNoModelTip'))
                  : ai.groups.map((group) =>
                      h(
                        'div',
                        { className: 'dgt-ai-group', key: group.id },
                        h('div', { className: 'dgt-ai-group-title' }, group.name),
                        group.models.map((model) =>
                          h(
                            'button',
                            {
                              key: group.id + '/' + model.id,
                              type: 'button',
                              className: 'dgt-ai-option',
                              role: 'option',
                              'aria-selected': ai.active?.provider === group.id && ai.active?.model === model.id,
                              'data-current':
                                ai.active?.provider === group.id && ai.active?.model === model.id
                                  ? true
                                  : undefined,
                              onClick: () => {
                                picker.close()
                                ai.onSelect(group.id, model.id)
                              },
                            },
                            h(
                              'span',
                              { className: 'dgt-ai-option-check' },
                              ai.active?.provider === group.id && ai.active?.model === model.id ? '✓' : '',
                            ),
                            h('span', { className: 'dgt-ai-option-name' }, model.name || model.id),
                            model.name && model.name !== model.id
                              ? h('span', { className: 'dgt-ai-option-id' }, model.id)
                              : null,
                          ),
                        ),
                      ),
                    ),
              ai.failures.length > 0
                ? h(
                    'div',
                    { className: 'dgt-ai-menu-failure' },
                    t('aiPartialCatalog') + ' ' + ai.failures.map((failure) => failure.name).join('、'),
                  )
                : null,
            )
          : null,
      ),
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
