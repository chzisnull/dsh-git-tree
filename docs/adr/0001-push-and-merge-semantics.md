# 推送当前分支，合并交给 git 判断本地改动

早期 spec（`docs/specs/0002-history-search-branches.md`）把远端整体划出范围，因此没有 push、也没有为它保留禁用按钮。用户后来明确要求“推送 / 提交并推送 / 合并其他分支”，并要以 Sourcetree 的行为为准，这条边界被推翻，记录如下。

## 决定

- **推送只作用于当前分支**，并且总是显式给出远端与 refspec（`git push <remote> <branch>:<remoteBranch>`），不依赖 `push.default` 或远端级 push refspec。永不 force、不推标签、不推别的分支。
- **没有 upstream 时**，只有在存在 `origin` 的情况下才 `push -u origin <branch>` 建立跟踪；没有 origin 就拒绝并说明，不随便挑一个远端。
- **合并时的本地改动交给 git 判断**：不再预先要求工作区干净。不冲突的本地改动允许合并；只有会被覆盖时才失败，并把 git 的原因翻译成“先提交或贮藏”；未解决冲突单独报。绝不自动 stash。
- **认证不做 UI**：依赖系统 credential helper，失败时给出“去终端登录一次”的可操作提示。
- 远端能力仍是有边界的：fetch / pull、远程分支展示、远端管理都不做，README 必须如实标注，而不是留下一组灰按钮。

## 结果

- `docs/specs/0002` 里“远端不做”的条款被本 ADR 取代；README 的状态表同步更新。
- 用户仍然不能用面板 force push、rebase、stash 或解决冲突；这些继续交给终端或 Agent。
