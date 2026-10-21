# 把 Sourcetree 的 Git UI 搬进 DSH —— 插件方案

> 目标：在 DeepSeek Harness 里做一个「像 Sourcetree 那样好用」的 Git 界面，形态是插件，而不是外挂窗口。
> 证据来源：Sourcetree 4.2.19 运行窗口的 AX 树 + REA 抓取 + 应用包解码；DSH Desktop 已安装的 `app.asar`（182 MB，18312 个文件）里 307 个 `@deepseek-ai/*` 包的真实实现。
> 效果图：`docs/design/frame1-docked.png` … `frame4-states.png`（本文写于方案阶段，路径已按仓库结构整理）

---

## 1. 一句话方案

**做一个 `dsh-git-tree` 插件，拆成两个挂载面：**

| 挂载面 | 是什么 | 干什么 |
|---|---|---|
| **主面板**（`main` keyed slot，入口在左侧图标栏，和「插件 / 自动化任务」并列） | 全高页面 | Sourcetree 的主窗口体验：导航栏 / 待定文件 / diff / 提交区 / 历史泳道 |
| **右侧栏页签**（`sidebar.right.pane.tab`，DSH 右侧栏多一个「Git」页签） | 常驻窄面板 | 扫一眼状态、勾选暂存、写提交信息，不打断对话 |

**关键取舍：抄信息架构，不抄皮。** Sourcetree 的布局与操作流是二十年打磨出来的，值得照搬；但它的 Cocoa 灰色 chrome（暖灰 `#E8EAE9`、12 个挤在一起的 40px 图标按钮、2015 年的边框）放进 DSH 会像贴上去的。所以：**结构 1:1，视觉用 DSH 的 token 重画。**

**加一条 Sourcetree 没有的：UI 和 Agent 共用同一批操作。** 每一个 UI 动作（暂存、提交、放弃区块）在宿主侧都是一个操作，既能被按钮触发，也能被 Agent 通过工具调用；Agent 改完文件，面板自己刷新。

---

## 2. 取证：Sourcetree 到底长什么样（有数字的那种）

### 2.1 窗口模型

Sourcetree 不是单窗口应用：

- **书签窗口**（480×628）：仓库列表，每行 = 图标 + 仓库名 + ahead/behind 徽标 + 当前分支胶囊；顶部 `本地 / 远端 / 新建…` 分段控件 + 过滤框。
- **每仓库一个窗口**（实测 1935×1185）：这才是真正的工作界面。同时能开多个（本机当前就开着 4 个：data-console、web-console、api-service 等）。

→ 搬到 DSH 里，书签窗口对应「工作区切换器」，仓库窗口对应主面板。

### 2.2 实测尺寸（AX 树 + 截图双重测量，单位 pt）

| 部件 | 实测值 | 备注 |
|---|---|---|
| 仓库窗口 | 1935 × 1185（另测 1512×857 / 1512×949） | 标题固定 `<repo> (Git)`，高度可自由缩放 |
| 书签窗口 | 480 × 628 | 深蓝标题栏 56，行高 50，图标 44×44 |
| 标题栏 + 工具栏 | 高 **52** | 工具按钮 40×52；宽按钮 91 / 97；右边距 8 |
| 左侧导航栏 | **346.5** 宽（窄窗口 306） | 分组标题行 34，条目行 26；图标 22×22 @x17；文字 @x50 |
| 侧栏底部筛选框 | 292 × 21 | 常驻 |
| 文件列表列 | **386.5** 宽 | 列表头 27 / 组头 27 / 行高 27 |
| 文件行内部 | 复选框 16×16 @x354 · 状态图标 13.5 @x394.5 · 路径 @x415 · `•••` @x677 | 缩进是算出来的，不是猜的 |
| diff 区 | 1201.5 宽 | 文件头 30 / hunk 头 28.5 / **代码行高 16** / 行号槽 59（新旧两列） |
| diff 区块按钮 | 58 × 18 | 「暂存区块 / 放弃区块」 |
| 提交区 | 起点 y=871；作者行 41；消息框 1503×225；底栏 46 | 取消/提交各 48×22 |
| 提交区复选框 | 200×20（立即推送）/ 117×18（更正） | 文案带分支名 |
| 历史视图 | 工具条 27 / 表头 26 / 行高 ≈20.5 | 列宽：图 83 · 描述弹性 · 提交 250 · 作者 116 · 日期 194；lane 宽 88，节点直径 9 |

一个反直觉的发现：**Sourcetree 的 diff 没有语法高亮**。上下文是纯深灰单色，只有增删用整行底色区分（删 `#BF4919` 字 / `#FDEFEB` 底，增 `#297558` 字 / `#EBFBF3` 底）。这反而是对的——diff 里最重要的是「哪几行变了」，不是「这行是什么语法」。我们的第一版也先不做高亮。

### 2.3 工具栏 11 个动作（顺序即真实顺序）

`提交 · 拉取 · 推送 · 抓取 · 分支 · 合并 · 贮藏 · 显示远程服务器 · 在 Finder 中显示 · 终端 · 设置`

注意两点：
- **前三项是 commit/pull/push**，说明 Sourcetree 把「提交」放在第一等公民位置；
- 后面三项是**系统胶水**（Finder / 终端 / 设置），这是桌面应用特有的，Web 端要换成「在编辑器中打开 / 打开终端 / 插件设置」。

### 2.4 左侧导航的 7 个分组

`WORKSPACE（文件状态 / 历史 / 搜索）· 分支 · 标签 · 远端 · 已贮藏 · 子模块 · 子树`

前 3 个是「视图切换」，后 4 个是「引用树」。分支行用实心点标当前分支，远端行带展开三角。

### 2.5 文件列表

- 两个分组：**已暂存 / 未暂存**，组头是浅灰底 + 右侧计数。
- 行高 26–30，行结构：`复选框 | 状态字母(M/A/D/?/R) | 路径（目录段灰色、文件名深色）| ⋯ 菜单`。
- 状态字母用颜色区分：M 橙、A 绿、D 红、? 灰。
- 空状态：居中的「没什么可提交的」+ 两个链接（在 Finder 中显示 / 在终端中打开）。

### 2.6 Diff 区

- 顶部一条：`文件路径 · +18 −6 · 放弃区块 / 暂存区块`（注意：Sourcetree 支持**按 hunk 暂存**，这是它比多数 GUI 强的地方）。
- hunk 头浅蓝底，`@@ -286,9 +296,13 @@` + 右侧「暂存区块 1 / 2」。
- 行号槽 44px 宽，diff 行高 21，新增浅绿底 + 左侧绿条，删除浅红底 + 左侧红条。

### 2.7 提交区

底部一条，从左到右：作者头像 + 邮箱 · 提交信息大输入框 · 两个复选框（立即推送 / 更正上一次提交）· 取消 + 提交。

### 2.8 结论：该抄什么

| 抄 | 不抄 |
|---|---|
| 三栏 + 提交区的信息架构 | 40px 图标按钮铺满的工具栏（Web 端用 28px 图标 + tooltip） |
| 已暂存/未暂存双分组 | 暖灰 chrome 配色 |
| hunk 级暂存/放弃 | 12pt 系统字体（DSH 用 12.5/13px） |
| 左侧「视图 + 引用树」混合导航 | 每仓库独立窗口（DSH 是单窗口多面板） |
| 提交区固定底部 | 「在 Finder 中显示」（换成「在编辑器中打开」） |
| 历史泳道 + 提交详情 | 表格化的提交列表（改成更宽松的行） |

### 2.9 组件级映射（nib 解码出来的真实类结构）

REA 把 17 个 nib 解码成 8,319 个对象节点后，Sourcetree 的界面拆解是清楚的——这直接就是我们要建的组件树：

| Sourcetree nib（解码所得） | 职责 | 我们的组件 |
|---|---|---|
| `GitRepoWindow` | 仓库窗口根 | `GitWorkspace`（`main` 面板根） |
| `RepoBrowserWindow` | 书签 / 仓库列表窗口 | `RepoSwitcher`（面板顶部） |
| `CommitAndFileStatusView` | 文件状态 + 提交的整体布局 | `WorkTreePage` |
| `FileStatusView2` | 待定文件列表 | `WorkTreePane` |
| `DiffView` / `DiffFileView` / `DiffHunkView` | diff 容器 / 单文件 / 单 hunk 三级 | `DiffPane` / `FileDiff` / `Hunk` |
| `CommitPaneView` | 提交区 | `CommitBox` |
| `LogView` + `RevisionFileListView` | 历史 + 提交内文件 | `HistoryView` / `CommitFileList` |
| `SearchView` | 提交搜索 | `CommitSearch` |
| `GitPushSheet` / `GitPullSheet` / `CommitSheet2` | 操作弹层 | `ConfirmDialog` / `PushSheet` |

注意 **`DiffHunkView` 是独立一层**——这正是 Sourcetree 能做到「按 hunk 暂存/放弃」的结构原因。我们要保留这个边界，别把 diff 拍成一个整块的 `<pre>`。

（以上是 IB 解码出的类名，不是运行时类名；`research/ib-summary.md` 有完整索引。）

---

## 3. 架构：插件长什么样

### 3.1 三个文件角色

DSH 插件 = **一个 npm 包，两个半区**：

```
dsh-git-tree/
  package.json          # 清单：bundle patch + dsh.client
  cordis.patch.yml      # 在哪一层装配里插入这一行
  index.js              # HOST 半边：Node 里跑，注册 /api 路由，调 git
  src/client/index.tsx  # CLIENT 半边源码：浏览器里跑，注册 slot
  build.mjs             # esbuild → lib/client.js（!ES module，是 __ModuleLoader__ 形态）
  lib/client.js         # 构建产物，浏览器真正加载的东西
  locale/{zh,en}.json   # 插件市场显示名
  icon.svg              # 图标
```

清单里最关键的四项（均已核对本机实现）：

```json
{
  "name": "dsh-git-tree",
  "type": "module",
  "exports": { ".": "./index.js", "./client": "./lib/client.js" },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-ui-renderer",
        "@deepseek-ai/dsh-client-ui-layout",
        "@deepseek-ai/dsh-client-ui-sidebar"
      ]
    }
  }
}
```

- `dsh.client.platform` 必须是 `"web"`，否则浏览器端不加载；
- `exports["./client"]` 缺失会直接报错 `declares dsh.client but exports no "./client" bundle`；
- `inject` 是**包级依赖顺序**（模块到达顺序 + 保活），不是 `require` 声明；
- 代码里唯一 `require` 的是 `react`（宿主基线模块表里有，所以不用写进 `external`）。

### 3.2 两个挂载点（都在已装版本里验证过）

**A. 主面板（重头戏）**

```js
// 左侧图标栏加一行
ctx.slots.inject('sidebar.panellist', () =>
  ctx.slots.register({ name: 'sidebar.panellist', id: 'git-tree', order: 30,
                       label: 'Git' }, GitIcon))

// 主区域注册同名 keyed 面板
ctx.slots.inject('main', () =>
  ctx.slots.register({ name: 'main', key: 'git-tree' }, GitWorkspace))
```

点图标 → `ctx.layout.selectPanel('git-tree')` → 整个中栏切成 Git 工作区。这就是「插件」「自动化任务」两个页面用的同一套机制，所以尺寸、留白、窗口拖动行为都天然一致。

**B. 右侧栏页签（轻量面）**

```js
ctx.sidebarRightTabs.register({ id: 'dsh-git-tree/status', kind: 'git-status',
                                title: () => 'Git' })
ctx.slots.register({ name: 'sidebar.right.pane.tab',
                     key: 'dsh-git-tree/status' }, GitStatusBody)
```

右侧栏支持拖宽、分屏（最多两栏）、全屏；`sidebar.right.pane.tab` 的 body 通过 `useTabInfo()` 拿到 `{ sidebar, panel, tab }`。

### 3.3 数据流

```
浏览器 (client)                       Node (host)
─────────────────                     ────────────────────────────
GitWorkspace 组件
  │ fetch('api/git-tree/status')   // 相对路径，同源
  ├──────────────────────────────────▶ connection.fetch.register 路由
  │                                     └─ ctx.subprocess.spawn(['git','status','--porcelain=v2'])
  │                                          cwd = 工作区根，env 已清洗
  │◀────────────────────────────────── { branch, ahead, behind, entries[] }
  │
  ├─ fetch('/api/git-tree/diff?path=…') ──▶ git diff -U3 -- path → 结构化 hunk
  ├─ POST /api/git-tree/stage {paths}  ──▶ git add
  └─ POST /api/git-tree/commit {msg}   ──▶ git commit（带二次确认）
```

**为什么不用 `ctx.remote.*`**：那是构建期固定装配的命名空间（`dsh-api-remotes` README 明写「capability set is fixed by explicit build-time value imports」），第三方插件加不了新 namespace。`ctx.connection.fetch.register` 是 DSH 自己的 deliverables 功能在用的路径，Connection 负责 Host/Origin + cookie 围栏，路由随插件 fiber 一起销毁。

**为什么不用 `ctx.webServer.register`**：dsh-workbench 用它，但它绕过 `/api` 桥和路由表，要手写 `requestRejection` 校验。除非需要裸 `node:http` 控制，否则不选。

### 3.4 Git 层怎么跑

用 `ctx.subprocess`，**不走 shell**：

```js
const executable = await ctx.subprocess.resolveExecutable('git')
const handle = ctx.subprocess.spawn({
  argv: [executable, 'status', '--porcelain=v2', '-z', '--branch'],
  cwd: workspaceRoot,
  stdio: { stdin: 'ignore', stdout: { maxBytes: 4 << 20 }, stderr: 'inherit' },
  graceMs: 5000,
})
const { exitCode } = await handle.done
```

三个必须处理的坑（都来自 DSH 自己的 git 集成说明）：

1. **macOS 的 `/usr/bin/git` 可能是 xcode 存根**，必须 `resolveExecutable('git')` + 探测，不能硬编码；
2. 环境必须清洗：`GIT_TERMINAL_PROMPT=0`（绝不弹认证）、`GIT_OPTIONAL_LOCKS=0`、`GIT_CONFIG_COUNT=0`；
3. `cwd` 必须落在工作区根内，越界拒绝——插件只操作已注册的工作区。

解析只用**稳定接口**：`status --porcelain=v2 -z`（含 renames/conflicts）、`diff --no-color -U3`、`log --date-order --pretty=<自定义分隔符>`。泳道布局自己算（`git log --graph` 的 ASCII 输出不适合渲染成 UI）。

---

## 4. 视觉与交互规格

### 4.1 三种形态

| 宽度 | 形态 |
|---|---|
| ≥ 1200px | 三栏：导航 196 / 文件列 372 / diff 自适应 |
| 900–1200px | 导航折叠成 48px 图标条 |
| < 900px | 抽屉式：文件列表 + 详情二级页 |

右侧栏页签永远是「窄面板形态」：只有分段控件（文件 / 历史）+ 文件列表 + 提交区。

### 4.2 尺寸栅格（8pt 制）

行高 30（紧凑 24）· 导航行 28 · diff 行 21 · 控件高 26 · 圆角 7 · 内边距 12。

### 4.3 颜色

全部走宿主 token，不硬编码品牌色：

`--dsw-alias-bg-base / -bg-layer-1 / -bg-layer-2`（三层表面）、`--dsw-alias-border-l1/l2`、`--dsw-alias-label-primary/secondary`、`--dsw-alias-brand-primary`（强调色）、`--dsw-alias-state-success/warn/error-primary`。

diff 的增删底色用 `color-mix()` 从 success/error 派生 8–10% 得到，深浅色自动跟随。**这一条直接决定了「深色模式下不用重做设计」。**

顺带一个好消息：这个 build 里已经有 `--dsw-alias-file-diff-*` 一族 token（增/删行底色、gutter、标记色），diff 视图可以直接吃现成的，连 `color-mix()` 都省了。半径 token 是 `xs4 / sm8 / md12 / lg16 / xl20 / panel28`。注意：**没有 spacing token**，间距得照抄宿主节奏（8pt 制、内边距 12）。

### 4.4 Agent 联动（差异化的地方）

- 文件行 hover 出「让 Agent 处理」；
- 提交框旁边有「✦ 生成提交信息」（读 diff → 建议 conventional commit）；
- 历史详情页有「✦ 让 Agent 解释」；
- 冲突文件有「让 Agent 合并」，Agent 给出逐块建议，人确认后落盘；
- Agent 改完文件 → 面板通过轮询/事件自动刷新（DSH 目前不允许插件注册宿主推送事件，所以是轮询 + 变更后主动 refetch）。

---

## 5. 分期路线

| 期 | 交付 | 验收标准 |
|---|---|---|
| **P0 骨架**（0.5 天） | 包结构 + 两个 slot 注册 + `/api/git-tree/status` + 假数据渲染 | 插件装上，左侧出现 Git 图标，点开是空三栏 |
| **P1 只读**（1–2 天） | 真读：status / diff / 分支树 / 空状态 / 大仓库虚拟滚动 | 在 web-console 和 8k 文件仓库上都不卡；diff 单文件 < 100ms |
| **P2 写操作**（2–3 天） | 暂存/取消、hunk 级暂存、提交、提交信息生成 | 所有写操作有二次确认；误操作可撤销（UI 层 undo） |
| **P3 历史**（2 天） | 提交列表 + 泳道 + 详情 diff + 引用胶囊 + 搜索 | 1000 commit 流畅滚动 |
| **P4 高级**（按需） | 分支操作、合并、冲突解决、贮藏、子模块、远端管理 | 冲突场景端到端跑通 |

P0/P1 就能给人看；P2 之后才是「能替代 Sourcetree」的起点。

---

## 6. 风险

| 风险 | 影响 | 对策 |
|---|---|---|
| **写操作烧掉工作区** | 极高 | 所有 mutating 操作默认二次确认；`reset --hard` / `push -f` 直接不做，交给 Agent 工具并强制确认；只操作已注册工作区 |
| **大仓库卡死** | 高 | 虚拟列表 + diff 按单文件懒加载 + 输出 `maxBytes` 上限 + 可取消的 spawn |
| **slot/API 版本漂移** | 中 | 全部基于本机已装版本核对；升级 DSH 后跑一次冒烟（两个 slot 是否还在） |
| **macOS git 路径** | 中 | `resolveExecutable` + 首次启动探测，失败给明确提示 |
| **rename / 二进制 / 子模块 / CRLF** | 中 | porcelain=v2 已覆盖；二进制显示「二进制文件」不给 diff |
| **和 dsh-workbench 功能重叠** | 低 | workbench 已做 repo 导航/MR，Git 面板只做本地工作区状态，二者互补；未来可互相跳转 |

---

## 7. 需要你拍板的 5 件事

1. **挂载形态**：主面板 + 右侧栏双形态（推荐）／只做主面板／只做右侧栏窄面板？
2. **写操作范围**：P2 就到「暂存 + 提交」（推荐）／一开始就要分支+合并+冲突全套／先纯只读看效果？
3. **视觉方向**：DSH 原生风（推荐）／Sourcetree 复刻风（暖灰、40px 图标栏）／两套主题可切换？
4. **仓库范围**：只当前工作区（推荐，最安全）／多工作区切换／整个 Sourcetree 书签列表导进来？
5. **和 Agent 的关系**：只做 UI（Agent 不参与）／UI + 提交信息生成（推荐）／UI + 冲突合并 + 解释历史全套？

---

## 8. 怎么验证做成了

1. `node build.mjs` 构建产物能加载；
2. 装进 profile 后，左侧图标出现、点开是面板（不是空白）；
3. `git status` 边上跑一次 `touch`，面板 1 秒内自己刷新；
4. 暂存 3 个文件 → 提交 → `git log -1` 对得上；
5. 深色模式切换，配色不缺不闪；
6. 8000 文件的仓库里滚动 60fps。

---

## 9. 交付物索引（仓库结构）

| 路径 | 内容 |
|---|---|
| `index.js` | 宿主半边：两条 `/api/git-tree/*` 路由 |
| `client.js` | 浏览器半边（由 `src/client/index.tsx` 构建，入库） |
| `src/client/index.tsx` | 面板源码：`sidebar.panellist` + `main` 两个 slot |
| `test/` | 清单 / 路由 / bundle 契约，共 18 条断言 |
| `docs/design/frame1-docked.png` | 右侧栏页签形态 |
| `docs/design/frame2-workspace.png` | 主面板三栏工作区 |
| `docs/design/frame3-history.png` | 历史泳道 + 提交详情 |
| `docs/design/frame4-states.png` | 行状态 / 尺寸栅格 / token / 分层数据流 |
| `docs/design/git-panel.html` | 效果图源文件（可直接改） |
| `docs/dsh-plugin-api.md` | DSH 插件机制的逐条取证（798 行，带 file:line 引用） |
| `docs/sourcetree-ui.md` | Sourcetree UI 取证（590 行，AX 树 + 截图 + nib 解码） |
| `docs/ib-summary.md` | NIB 解码摘要（类名 / outlet / action / 复现命令） |

## 10. 现在就能跑的东西

```bash
node build.mjs      # 构建（已验证通过）
npm run check       # 两个半边的语法检查
npm test            # 18 条断言
```

产物 `client.js` 已经是合法的 `window.__ModuleLoader__.load({ id: 'dsh-git-tree', factory })` 形态，装上 profile 即出现在左侧图标栏。安装走 `plugin_manager action=install_bundle target=<绝对路径>`（需要一次授权），不手改 `package.json` / `cordis.patch.yml`。
