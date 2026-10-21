// Locale namespace and dictionaries. Visible copy always goes through the
// Client locale service so the panel follows the host language.

/** Locale namespace owning this plugin's client copy and sidebar label. */
export const NS = 'dsh-git-tree'

export const EN: Record<string, string> = {
  panel: 'Git',
  refresh: 'Refresh',
  refs: 'References',
  branches: 'Local branches',
  branchesPlaceholder: 'Branch list (skeleton)',
  remotes: 'Remotes',
  remotesPlaceholder: 'Remote list (skeleton)',
  tags: 'Tags',
  tagsPlaceholder: 'Tag list (skeleton)',
  changes: 'Changes',
  staged: 'Staged',
  working: 'Working tree',
  diff: 'Diff',
  diffPlaceholder: 'Select a changed file to preview its diff.',
  untrackedNoDiff: 'Untracked file: no diff until it is added.',
  noDiff: 'No diff for this file.',
  clean: 'Working tree clean.',
  loading: 'Loading…',
  statusFailed: 'git status failed.',
  diffFailed: 'git diff failed.',
  hostUnavailable: 'Host half not available',
}

export const ZH: Record<string, string> = {
  panel: 'Git',
  refresh: '刷新',
  refs: '引用',
  branches: '本地分支',
  branchesPlaceholder: '分支列表（骨架）',
  remotes: '远程',
  remotesPlaceholder: '远程列表（骨架）',
  tags: '标签',
  tagsPlaceholder: '标签列表（骨架）',
  changes: '改动',
  staged: '已暂存',
  working: '工作区',
  diff: '差异',
  diffPlaceholder: '选择左侧改动以预览差异。',
  untrackedNoDiff: '未跟踪文件：加入暂存前没有差异。',
  noDiff: '该文件没有差异。',
  clean: '工作区干净。',
  loading: '加载中…',
  statusFailed: 'git status 执行失败。',
  diffFailed: 'git diff 执行失败。',
  hostUnavailable: '宿主半未就绪',
}
