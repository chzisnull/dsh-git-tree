# dsh-git-tree

一个 DeepSeek Harness 插件：把 Sourcetree 那套 Git 工作区搬进 Web GUI——占满主面板的三栏布局（左侧「工作区 / 分支 / 标签 / 远端」导航、已暂存 / 未暂存文件列表、diff 视图），就在对话旁边，不用再切到另一个 App。

[English](README.md)

![Git 工作区面板](docs/design/frame2-workspace.png)

## 0.1.0 能做什么

这一版是**只读的第一刀**，不藏着：面板读取工作区并渲染，还不能暂存、提交或推送。

- **一个 `main` 面板**，入口是左侧图标栏里的 `Git` 一行——和「插件」页面用的是同一类座位，所以它自动拿到整个中栏、窗口顶部安全区和 DSH 的深浅色。
- **分支与同步状态**：当前分支、upstream、ahead/behind、仓库根目录。
- **已暂存 / 未暂存双列表**，按 Sourcetree 的方式分组，数据来自 `git status --porcelain=v2 --branch -z`——重命名、未跟踪、冲突都保留真实的 XY 状态，不会被压平成「已修改」。
- **选中文件的 diff**，用的是和 DSH 自己的 workspace-changes 相同的 `--` 保护、无颜色的 `git diff`。
- **构造上只读**：宿主半边只会执行 `status`、`rev-parse`、`diff`。这一版根本不存在写操作路由。

## 状态

| 能力 | 0.1.0 |
| --- | --- |
| `main` 面板 + 侧栏入口 | 已完成 |
| 分支 / ahead / behind | 已完成 |
| 已暂存 + 未暂存列表 | 已完成 |
| 单文件 diff | 已完成 |
| 暂存 / 取消暂存 / 提交 | 计划中（P2） |
| 历史泳道 | 计划中（P3） |
| 右侧栏窄面板形态 | 计划中 |
| 与 Agent 共用操作 | 计划中 |

完整计划（包括布局依据的实测 UI 规格）在 [`docs/PLAN.md`](docs/PLAN.md)。

## 设计取舍

面板抄的是 Sourcetree 的**信息架构**，不是它那层皮。布局数字是量出来的，不是估的：来自运行中 App 的 Accessibility 树，以及解码它的 Interface Builder 归档——见 [`docs/sourcetree-ui.md`](docs/sourcetree-ui.md) 和 [`docs/ib-summary.md`](docs/ib-summary.md)。

两个值得一提的结论：

- Sourcetree 的 diff **没有语法高亮**，只用整行底色区分增删。这个面板刻意保持一致——diff 里「哪几行变了」比「哪个 token 是关键字」重要。
- 所有颜色都是 `--dsw-alias-*` 主题 token，深浅色不用做第二套设计。一旦有人写死颜色，`npm test` 会直接失败。

## 在 DSH 里怎么接

| 半边 | 文件 | 作用 |
| --- | --- | --- |
| Host | `index.js`（纯 ESM，无构建） | 用 `ctx.connection.fetch.register` 注册两条带鉴权的 exact Fetch 路由，用 `ctx.subprocess` 跑 git |
| Client | `client.js`（由 `src/client/index.tsx` 构建） | 把侧栏图标注册进 `sidebar.panellist`、把面板注册进 `main`，两者共用 id `git-tree` |

```
GET /api/git-tree/status          → { branch, upstream, ahead, behind, entries[] }
GET /api/git-tree/diff?path=…     → { path, staged, text }
```

git 不走 shell；子进程环境带 `GIT_TERMINAL_PROMPT=0`（永不卡在认证）、`GIT_OPTIONAL_LOCKS=0`（不在你的仓库里拿可选锁）、`GIT_CONFIG_COUNT=0`，输出与耗时都有上限。绝对路径、含 `..`、以 `-` 开头的路径在进入 `argv` 之前就被拒绝；工作区之外的 `cwd` 一律 403。

宿主机制的取证（slot id、Fetch 路由通道、subprocess 安全、主题 token）都在 [`docs/dsh-plugin-api.md`](docs/dsh-plugin-api.md)，每条都带 `app.asar` 内的 `file:line` 引用。

## 安装

从本地检出安装：

```sh
dsh plugin add /Library/aiProject/dsh-git-tree
```

或者在有 plugin manager 的会话里安装 bundle，路径指向包目录：

```
plugin_manager action=install_bundle target=/Library/aiProject/dsh-git-tree
```

如果客户端模块没有立刻出现，刷新或重启 DSH 页面。插件只读，不会写你的仓库。

## 开发

```sh
node build.mjs     # src/client/index.tsx → client.js（产物入库）
npm run check      # 两个半边 node --check
npm test           # 18 条断言：清单、宿主路由、bundle 契约
```

`build.mjs` 先找本包的 `node_modules` 里的 esbuild，再找已安装的 `dsh-workbench`；都没有就停下并打印修复命令（`npm i -D esbuild`）。

测试不需要 DSH、不需要 git、不需要浏览器：

- `test/manifest.test.mjs` —— 加载器会校验的东西（platform、exports、patch 行、图标、语言包）。
- `test/routes.test.mjs` —— 用假 context 跑 `apply()`：两条路由注册、porcelain v2 解析、路径前有 `--`、穿越/绝对/选项形路径被拒、subprocess 缺失时降级而不是抛错。
- `test/ui-contract.test.mjs` —— 构建产物：loader 包装、恰好两次 slot 注册且共用 id、调用两条路由、只用主题 token、不碰 `document.body`。

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
