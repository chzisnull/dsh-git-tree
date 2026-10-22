# 远端再进一步：获取与拉取

ADR 0001 把 push 做完之后，fetch / pull 仍然划在范围外，理由是「与本地工作台定位冲突」。实际用起来最常遇到的问题是：`behind` 数字是本地引用的陈旧值，远端有人提交后，面板既不会知道，也没法在面板里更新。用户明确提出「缺少拉取代码的功能」，这条边界再放开一格。

## 决定

- **获取（fetch）与拉取（pull）分开**：获取只更新远端跟踪引用与 ahead/behind，不动工作区；拉取才会移动当前分支。Sourcetree 也是两个动作。
- **拉取默认只快进**：显式 `git fetch <remote> --prune` 之后 `git merge --ff-only <remote>/<branch>`，不读 `pull.rebase` 之类的全局配置，行为可预测。
- **分叉时给一次显式选择**：快进失败（`diverged`）时，面板弹确认，用户同意才用 `git merge --no-edit <remote>/<branch>` 合并；冲突走现有的冲突视图与 AI 解决。默认永远不会静默产生 merge commit。
- **upstream 缺失只认 origin**：没有 upstream 时，只有 origin 存在同名分支才允许拉取，否则拒绝并说明。这与推送的规则一致。
- **脏工作区交给 git 判断**：不预先拒绝；只有会被覆盖时才失败，并把 git 的原因翻译成「先提交或贮藏」。
- **自动获取一次**：面板打开 / 切换仓库时静默 fetch 一次，让 ahead/behind 是新鲜的；之后只在点「获取」时访问远端，不做定时轮询。
- **认证不做 UI**：复用推送的体系，失败提示去终端登录一次。

## 结果

- 新增 `POST /api/git-tree/fetch`、`POST /api/git-tree/pull`（`mode: "ff-only" | "merge"`）。
- 工具栏多出「获取」「拉取」两个按钮；拉取在 behind > 0 时显示数量角标，无 upstream 时仍可点（走 origin 同名分支）。
- 失败码沿用推送的词表并补两个：`diverged`、`network-failed`；拉取产生的冲突复用 `merge-conflict`。
- fetch / pull 与 ADR 0001 的 push 组成完整的一条远端链路；远程分支展示、远端管理与 pull --rebase 仍不做。
