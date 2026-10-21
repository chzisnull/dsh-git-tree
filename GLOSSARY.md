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

**Rail** (左栏 / 引用树):
The left column of the workspace panel that lists branches, remotes and tags.
_Avoid_: Sidebar, navigator, tree

**Entry row**:
One clickable row in the change list, bound to a path and to the side (staged, unstaged or conflict) it was listed under.
_Avoid_: File row, list item
