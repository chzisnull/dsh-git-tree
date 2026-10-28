# dsh-git-tree

A DeepSeek Harness plugin that gives the Web GUI a Git workspace panel. This glossary fixes the words the panel, its host half and its specs use about repositories and changes.

## Language

**Workspace**:
The folder DSH registered for the current session; the outer boundary for every git command this plugin runs.
_Avoid_: Repo root, project root, sandbox

**Repository**:
The git repository rooted at the repository root inside the workspace.
_Avoid_: Repo directory, checkout

**Repository root**:
The top-level directory of the repository, as reported by git itself.
_Avoid_: Workspace root, repo path

**Working copy** (工作区):
The files on disk in the repository, as opposed to what the index has staged.
_Avoid_: Working tree, worktree, filesystem

**Index** (暂存区):
The staged snapshot that the next commit will record.
_Avoid_: Stage, cache, staging area

**Staged entry** (已暂存条目):
A path whose index side differs from `HEAD`.
_Avoid_: Staged file, added file

**Unstaged entry** (未暂存条目):
A path whose working copy differs from the index.
_Avoid_: Modified file, pending file

**Two-sided change** (双侧改动):
A path changed on both the index side and the working copy side; it appears once under staged entries and once under unstaged entries.
_Avoid_: Mixed change, partial stage

**Conflict** (冲突 / 未合并):
A path git could not merge automatically and that therefore has no single index state; it must be resolved before a commit can be made.
_Avoid_: Merge conflict, unmerged file

**Rename**:
A path whose identity git reports as moved from an original path to a new path, rather than as a deletion plus an addition.
_Avoid_: Move, D+A pair

**Read operation**:
A git command that only inspects the repository (status, diff, refs lookup).
_Avoid_: Query, probe

**Write operation** (写操作):
A git command that mutates the index or history, and therefore the user's repository.
_Avoid_: Mutation, action, command

**Undo** (撤销):
Reversing the last write operation by issuing its inverse; it is not the git `revert` command.
_Avoid_: Revert, rollback

**Hunk** (区块):
One contiguous changed region of a file diff, introduced by an `@@` header line.
_Avoid_: Chunk, patch, block

**Diff line**:
One rendered line inside a hunk, classified as context, addition or deletion.
_Avoid_: Row, code line

**File status view** (文件状态视图):
The workspace view that lists the working copy's changes; the default view.
_Avoid_: Changes tab, working tree view

**History view** (历史视图):
The workspace view that lists commits newest-first as a lane graph with a detail pane for the selected commit.
_Avoid_: Log, commit browser

**Search view** (搜索视图):
The workspace view that lists commits matching a query (message, author or path) using the history view's list.
_Avoid_: Find, filter

**Lane**:
One column of the commit graph; a commit sits on a lane and lanes merge or split at merge commits.
_Avoid_: Branch line, swim lane, column

**Upstream** (上游):
The remote branch a local branch tracks by default; pushing without arguments uses it.
_Avoid_: Tracking branch target, origin ref

**Push** (推送):
Sending the current branch's commits to its upstream; it never rewrites or forces.
_Avoid_: Upload, sync

**Fast-forward** (快进):
A merge that only moves the current branch pointer forward because the merged branch already contains it.
_Avoid_: FF, linear merge

**Checkout** (检出):
Switching the repository to a branch, moving `HEAD` and the working copy to it.
_Avoid_: Switch, activate

**Dirty working copy** (脏工作区):
A working copy with staged, unstaged or conflicted changes; checkout refuses to run on one.
_Avoid_: Uncommitted state, modified tree

**Commit detail** (提交详情):
The pane describing one selected commit: message, author, date, parents, refs and the files it changed.
_Avoid_: Commit info, metadata

**Rail** (左栏 / 引用树):
The left column of the workspace panel that lists branches, remotes and tags.
_Avoid_: Sidebar, navigator, tree

**Entry row**:
One clickable row in the change list, bound to a path and to the side (staged, unstaged or conflict) it was listed under.
_Avoid_: File row, list item

**Commit message model** (提交信息模型):
The DSH model route that writes a commit message from the selected files' diff; a plugin setting stored under the DSH home, defaulting to the DSH default Agent model.
_Avoid_: AI model, generator

**AI commit message** (AI 生成提交信息):
A commit message drafted by the selected model from the files this commit would include; it only fills the message box and never commits.
_Avoid_: Auto-commit, generated commit

**Conflict view** (冲突视图):
The right-hand pane for an unmerged file: the working-tree copy rendered line by line, with `<<<<<<<` / `=======` / `>>>>>>>` marker rows and the two sides tinted.
_Avoid_: Combined diff, merge diff

**Conflict hand-off** (交给 AI 助手):
The header action that opens a DSH session in the repository's workspace and writes a ready prompt into the composer; nothing is sent and the panel writes nothing. The human marks the file resolved afterwards.
_Avoid_: AI resolve, auto-fix

**AI conflict resolution** (模型合并):
The in-panel path kept from an earlier decision: one conflicted file goes to the selected model, the answer is previewed as a diff, and the file is written only after Apply. Now reachable from the conflicted file's context menu.
_Avoid_: Auto-merge, conflict fixer

**Fetch** (获取):
Reading the remote's refs into the local remote-tracking branches; it updates ahead/behind and never touches the working tree.
_Avoid_: Sync, update

**Pull** (拉取):
Fetch, then fast-forward the current branch to its upstream; a diverged branch needs an explicit merge instead.
_Avoid_: Sync, update

**Diverged branches** (分叉):
Local and remote each have commits the other lacks, so the current branch cannot fast-forward.
_Avoid_: Out of date, conflict

**Pinned repository** (置顶仓库):
A workspace the user pinned in the repository switcher; pinned workspaces always list above the usage-ordered ones, in the order they were pinned.
_Avoid_: Favourite, bookmark

**Open count** (打开次数):
How many times the user deliberately switched to a repository from the panel; it orders the unpinned part of the switcher, together with the last-opened time.
_Avoid_: Visits, popularity

**Panel shortcut** (面板快捷键):
The registered application command that opens the Git panel, or returns to the conversation when the panel is already in front. It is owned by DSH's shortcut service, not by a listener inside the panel.
_Avoid_: Hotkey, keybinding script

**Shortcut hold** (快捷键挂起):
While a panel-owned overlay (confirm, prompt, AI preview, context menu) is open, the panel asks the shortcut to do nothing, because the desktop shell dispatches bound commands ahead of modal controls.
_Avoid_: Disabled shortcut, modal lock

**Keycap** (键帽):
One key of a displayed binding, rendered as its own small cap (`⌘`, `⇧`, `V`); the panel shows the live binding in a toolbar badge and in the empty diff pane.
_Avoid_: Shortcut text, key label

**Commit draft** (提交信息草稿):
What the user typed into the commit box, kept per repository for the page's lifetime so closing the panel (the shortcut, the sidebar, switching views) never loses it; a successful commit or Clear drops it.
_Avoid_: Unsaved message, pending text

**Poll tick** (轮询节拍):
One status read while the panel is on screen and the window is focused; a poll is one `git status` plus, on their own clocks, the refs rail and the cached repository facts.
_Avoid_: Refresh loop, heartbeat

**Idle backoff** (空闲退避):
Several polls in a row returning the same signature slow the tick down instead of repeating the same work; any change, focus, or pointer entry restores the fast cadence.
_Avoid_: Throttle, rate limit

**Repository statics** (仓库静态信息):
The repository root, the configured identity and the remote names: facts that only change when the repository does, cached for a minute instead of re-read on every poll.
_Avoid_: Metadata, repo info
