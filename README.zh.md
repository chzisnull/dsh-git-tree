# dsh-git-tree

一个 DeepSeek Harness 插件：把 Sourcetree 那套 Git 工作区搬进 Web GUI——占满主面板的三栏布局（左侧「工作区 / 分支 / 标签 / 远端」导航、已暂存 / 未暂存文件列表、diff 视图），就在对话旁边，不用再切到另一个 App。

[English](README.md)

![Git 工作区面板](docs/design/frame2-workspace.png)

## 0.6.1 能做什么

这一版是**本地 Git 工作台**：文件状态、历史、搜索、本地分支——读改动、暂存、提交、切分支、看任意一次提交，全在面板里完成，并支持推送当前分支。fetch / pull、远程分支和远端管理还没有做。

- **一个 `main` 面板**，入口是左侧图标栏里的 `Git` 一行——和「插件」页面用的是同一类座位，所以它自动拿到整个中栏、窗口顶部安全区和 DSH 的深浅色。
- **顶部仓库切换**：列出 DSH 已注册的 workspace，选中哪个，所有路由就作用在哪个仓库。
- **分支与同步状态**：当前分支、upstream、ahead/behind、仓库根目录。
- **Sourcetree 的改动模型**：冲突 / 已暂存 / 未暂存三组带计数；重命名保留原路径；同一文件两侧都有改动时两栏各出现一次（数据来自 `git status --porcelain=v2 --branch -z`）。
- **结构化 diff**：宿主解析成 files → hunks → lines，渲染双行号、hunk 头、整行底色与 `+N −M`。
- **暂存 / 取消暂存 / 提交**：行内复选框、悬停菜单、diff 头部文件级动作，底部提交区（作者、分支、暂存数、⌘↵）。
- **历史视图**：提交泳道图 + 描述 / 短 SHA / 作者 / 日期，「所有分支 / 仅当前分支」过滤，每页 200 条分页加载。
- **提交详情**：选中提交看信息、作者、日期、父级、refs 与变更文件；点文件看该提交内 diff；父级链接可跳转。
- **搜索视图**：按提交信息 / 作者 / 文件路径搜提交，结果复用历史列表与详情。
- **分支**：单击看该分支历史、双击检出；可新建 / 重命名 / 删除本地分支；脏工作区检出会被拒绝，不会自动 stash。
- **右键操作**：改动行可提交（暂存并聚焦提交框）、暂存/取消暂存、放弃更改、删除文件 / 删除未跟踪文件、复制路径；分支行可检出、重命名、删除、复制名称；提交行可复制 SHA、从此提交新建分支、复制提交信息。危险操作先确认，只有可执行的破坏项是红色。
- **推送**：把当前分支推到它的 upstream（首次推送自动建立跟踪）。永不 force；认证失败和非快进会被翻译成可读的下一步提示。
- **提交并推送**：提交卡片里的复选框，提交成功后立即推送；推送失败不会回滚提交。
- **本地动作**：在 Finder 中显示、在终端打开（macOS）。
- **实时**：面板可见时每 2 秒刷新，写操作后立即刷新。
- **写操作面很小**：stage / unstage / commit、放弃更改、删除、分支新建-重命名-删除、检出、合并到当前分支，以及一个永不 force 的当前分支推送。没有 `reset --hard`、没有 force push、没有 amend、没有 rebase、没有 stash 路由。

## 状态

| 能力 | 0.6.1 |
| --- | --- |
| `main` 面板 + 侧栏入口 | 已完成 |
| 仓库切换（DSH workspaces） | 已完成 |
| 分支 / ahead / behind / 引用树 | 已完成 |
| 冲突 / 已暂存 / 未暂存分组 | 已完成 |
| 结构化单文件 diff | 已完成 |
| 暂存 / 取消暂存 / 提交 | 已完成 |
| 历史视图（泳道 / 分页 / 过滤） | 已完成 |
| 提交详情 + 提交内 diff | 已完成 |
| 搜索（信息 / 作者 / 路径） | 已完成 |
| 分支导航 + 检出 | 已完成 |
| 分支新建 / 重命名 / 删除 | 已完成 |
| 右键操作 + 放弃更改 / 删除文件 | 已完成 |
| 推送 / 提交并推送 | 已完成 |
| Finder / 终端 | 已完成 |
| 自动刷新 | 已完成 |
| 推送当前分支 | 已完成 |
| fetch / pull / 远程分支 / 远端管理 | 未做 |
| 合并 / 变基 / 贮藏 / 冲突 UI | 不做 |
| 大仓库虚拟滚动 | 不做（按决定取消） |
| 与 Agent 共用操作 | 未做 |

完整计划（包括布局依据的实测 UI 规格）在 [`docs/PLAN.md`](docs/PLAN.md)。

## 设计取舍

面板抄的是 Sourcetree 的**信息架构**，不是它那层皮。布局数字是量出来的，不是估的：来自运行中 App 的 Accessibility 树，以及解码它的 Interface Builder 归档——见 [`docs/sourcetree-ui.md`](docs/sourcetree-ui.md) 和 [`docs/ib-summary.md`](docs/ib-summary.md)。

两个值得一提的结论：

- Sourcetree 的 diff **没有语法高亮**，只用整行底色区分增删。这个面板刻意保持一致——diff 里「哪几行变了」比「哪个 token 是关键字」重要。
- 所有颜色都是 `--dsw-alias-*` 主题 token，深浅色不用做第二套设计。一旦有人写死颜色，`npm test` 会直接失败。

## 在 DSH 里怎么接

| 半边 | 文件 | 作用 |
| --- | --- | --- |
| Host | `index.js`（纯 ESM，无构建） | 用 `ctx.connection.fetch.register` 注册七条带鉴权的 exact Fetch 路由，用 `ctx.subprocess` 跑 git |
| Client | `client.js`（由 `src/client/index.tsx` 构建） | 把侧栏图标注册进 `sidebar.panellist`、把面板注册进 `main`，两者共用 id `git-tree` |

```
GET  /api/git-tree/workspaces          → DSH 已注册 workspace
GET  /api/git-tree/status?cwd=…        → 分支、upstream、ahead/behind、entries、counts
GET  /api/git-tree/diff?path=…&side=…  → files → hunks → lines、统计
GET  /api/git-tree/refs?cwd=…          → 分支、远程、标签
POST /api/git-tree/stage               → { paths[] }
POST /api/git-tree/unstage             → { paths[] }
POST /api/git-tree/commit              → { message } → { sha, shortSha, subject }
```

git 不走 shell；子进程环境带 `GIT_TERMINAL_PROMPT=0`（永不卡在认证）、`GIT_OPTIONAL_LOCKS=0`（不在你的仓库里拿可选锁）、`GIT_CONFIG_COUNT=0`，输出与耗时都有上限。绝对路径、含 `..`、以 `-` 开头的路径在进入 `argv` 之前就被拒绝；工作区之外的 `cwd` 一律 403。

宿主机制的取证（slot id、Fetch 路由通道、subprocess 安全、主题 token）都在 [`docs/dsh-plugin-api.md`](docs/dsh-plugin-api.md)，每条都带 `app.asar` 内的 `file:line` 引用。

## 安装

从 npm 按名称安装（包里同时带宿主半、客户端半和 bundle patch）：

```sh
dsh plugin --profile <profile> add dsh-git-tree
```

或者在带 plugin manager 的会话里：

```
plugin_manager action=install_bundle target=dsh-git-tree
```

从本地检出安装：

```sh
dsh plugin --profile <profile> add /Library/aiProject/dsh-git-tree
```

装完要**重启 DSH**（宿主半在 App 启动时装配）。在你的按下暂存或提交之前，插件不会写你的仓库。

## 开发

```sh
node build.mjs     # src/client/index.tsx → client.js（产物入库）
npm run check      # 两个半边 node --check
npm test           # 78 条断言：清单、宿主路由、解析器、客户端启动、导入守卫
```

`build.mjs` 先找本包的 `node_modules` 里的 esbuild，再找已安装的 `dsh-workbench`；都没有就停下并打印修复命令（`npm i -D esbuild`）。

测试不需要 DSH、不需要 git、不需要浏览器：

- `test/manifest.test.mjs` —— 加载器会校验的东西（platform、exports、patch 行、图标、语言包）。
- `test/routes.test.mjs` —— 用假 context 跑 `apply()`：七条路由、真实改动模型、仓库切换、路径前有 `--`、穿越/绝对/选项形路径被拒、提交前检查。
- `test/host-modules.test.mjs` —— 解析器作为纯函数：porcelain v2（rename / 冲突 / 双侧）、unified diff、refs。
- `test/ui-contract.test.mjs` —— 构建产物：loader 包装、恰好两次 slot 注册且共用 id、调用路由、只用主题 token、不碰 `document.body`。
- `test/client-boot.test.mjs` —— 在 Node 里执行构建产物、物化插件，用「未声明服务即抛错」的 Cortis 式 ctx 调 `apply()`。

## 效果图

`docs/design/` 里是实现对照的四张画板：

| 文件 | 内容 |
| --- | --- |
| [`overview.png`](docs/design/overview.png) | 四张总览 |
| [`frame1-docked.png`](docs/design/frame1-docked.png) | 对话旁边的窄面板形态 |
| [`frame2-workspace.png`](docs/design/frame2-workspace.png) | 全页工作区：导航 / 文件 / diff / 提交区 |
| [`frame3-history.png`](docs/design/frame3-history.png) | 历史泳道与提交详情 |
| [`frame4-states.png`](docs/design/frame4-states.png) | 行状态、尺寸栅格、主题 token、数据流 |

## 许可

MIT
