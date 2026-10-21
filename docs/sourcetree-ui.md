# Sourcetree 4.2.19 (macOS) UI 规格 — 逆向证据版

> 目标：为 DeepSeek Harness Web 插件重建 Sourcetree 的 Git UI 提供可复刻的布局/配色/交互事实。
> 对象：`/Applications/Sourcetree.app`，版本 **4.2.19（CFBundleVersion 317）**，Mach-O universal x86_64+arm64，Cocoa/AppKit，`.nib` 资源，运行 PID 552。
> 本文件只做 **只读** 观测：截图（`screencapture -l<windowId>`）、Accessibility 树（System Events AX）、`rea decode-interface-builder` 解码 NIB。**未对 App 做任何修改，未执行 stage/commit/push，未切换仓库复选框。**


> **关于证据截图**：本文件引用的全窗口截图与局部 crop 未随仓库分发——截图里含有本人的私有仓库名与公司业务代码路径。文中每条测量值都保留了来源标记与 crop 文件名，可以按其描述在自己的机器上复现（同一版本 Sourcetree + `screencapture -l<windowId>` + AX 树）。

## 0. 阅读约定

- **坐标系**：本文所有尺寸单位为 **pt（逻辑点）**，原点 = 窗口内容区左上角（不含投影）。截图是 2x Retina，像素 = pt×2。窗口外有 `screencapture` 阴影边（x 偏 46 px、y 偏 32 px），已裁掉。原始截图未随仓库分发（窗口里含有私有仓库名与业务代码路径），本文保留全部测量数据与结论。
- **证据标签**：
  - `[A]` = Accessibility 树实测（`research/ax/*.txt`）
  - `[S]` = 截图实测（原始截图未公开；对应的 crop 文件名保留在文中以便复核）
  - `[N]` = NIB 解码（`research/ib-decode.json` + `research/ib-summary.md`）
  - `[E]` = 由以上推导的估计值（字体大小、未直接量到的间距）
- **语言**：App 运行在中文（简体）环境，截图标签为中文；NIB 内英文原文在 `[N]` 中给出，便于做 i18n。
- **核心证据文件**：
  - AX 树：`research/ax/Sourcetree.txt`、`web-consoleGit.txt`、`api-serviceGit.txt`
  - NIB 解码：`research/ib-decode.json`（11.2 MB 原始 JSON）、`research/ib-summary.md`

---

## 1. 窗口模型

Sourcetree 是典型的多窗口 AppKit 应用：**一个书签/仓库启动器窗口 + 每个打开的仓库一个独立仓库窗口**。另有独立弹层（sheet/popover）不常驻。

| windowId | AX 标题 | 尺寸 (pt) | 屏幕位置 | 角色 | 证据 |
|---|---|---|---|---|---|
| **79** | `Sourcetree` | **480 × 628** | (1623, 264) | **书签启动器 / 仓库列表**（RepoBrowserWindow）。无侧栏；顶部深蓝品牌标题栏 + 本地/远端分段 + 新建…菜单 + 过滤搜索；列表每行一个仓库 | [A][S] `st_win_79.png` |
| **98** | `web-console (Git)` | **1935 × 1185** | (511, 363) | **每仓库主窗口**（文件状态视图）。左侧 7 组导航；中间「已暂存/未暂存」文件列表；右侧 diff；底部提交区 | [A][S] `st_win_98.png` |
| **99** | `api-service (Git)` | **1512 × 857** | (591, 583) | 同 98，另一个仓库窗口；用于验证宽度变化（侧栏 306 / 文件列表 386.5） | [A][S] `st_win_99.png` |
| **996** | `data-console (Git)` | **1512 × 949** | (758, 462) | 同 98/99，但工作区干净：显示「没什么可提交的」空态 + 电路板水印。**该窗口在本次取证期间被关闭**（17:18 捕获后，17:21 的窗口列表已无此窗），PNG 已保存 | [S] `st_win_996.png` |
| — | `web-console (Git)` 同窗切「历史视图」 | 1935 × 1185 | 同上 | 历史视图：提交图 + 列 + 下方选中提交的文件列表/diff/提交详情。通过「查看 → 历史视图（⌘2）」切换，取证后已切回文件状态视图 | [S] `st_win_98_history.png` |

补充：

- 仓库窗口标题格式固定为 `"<仓库目录名> (Git)"`；`Mercurial` 仓库对应 `(Hg)`（本次未打开）。
- 窗口最小尺寸：NIB 里 `GitRepoWindow` 为 `{700, 300}`、`RepoBrowserWindow` 为 `{480, 420}` [N]；运行时窗口 996 高度 949 < 1185，说明高度可自由缩放。
- 所有仓库窗口共享同一套布局与视图切换（文件状态 / 历史 / 搜索）；「文件状态视图」是默认打开页。
- 书签窗口与仓库窗口是**两个独立 window**，不是主从面板；书签窗双击仓库行会打开/聚焦对应仓库窗口（交互流见 §10）。
- NIB 窗口类：仓库窗 `NSWindow`（控制器 `STGitWindowController`）；书签窗 `STRepoBrowserWindow`（控制器 `STRepoBrowserWindowController`）[N]。

窗口截图总览：

| 书签启动器 | 仓库窗（文件状态） |
|---|---|

| 历史视图 | 空改动态 |
|---|---|

---

## 2. 全局尺寸表（实测）

> 除非注明，均来自 AX `[A]`（`web-consoleGit.txt` 的 `position/size` 换算成窗口内相对坐标），少量由截图 `[S]` 复核。

### 2.1 仓库窗口（1935×1185）

| 元素 | 数值 | 来源 |
|---|---|---|
| 统一标题栏 + 工具栏高度 | **52** | [A] `AXToolbar @363..415` |
| 交通灯（关闭/最小化/全屏） | 12×14，y=19；x=20/40/60 | [A] |
| 窗口标题文本 | 居中偏左（x≈87），13pt semibold | [S][E] |
| 主内容 split（标题栏下） | y=51，高 1134，宽 1935 | [A] |
| 左侧栏宽度 | **346.5**（98）/ **306**（99） | [A] `AXSplitter value` |
| 侧栏 splitter 粗 | 1 | [A] |
| 文件列表列宽 | **386.5** | [A] `AXSplitGroup @858..1245` |
| 文件列表/侧栏间 splitter | 1 | [A] |
| Diff 区宽度 | 1201.5（98）/ 817.5（99） | [A] |
| 列表头行（待定的文件…） | 27 | [A] `AXGroup h=27` |
| 「已暂存文件」组头 | 27 | [A] |
| 「未暂存文件」组头 | 27 | [A] |
| 文件行高 | **27** | [A] `AXTableRow h=27`；[S] 行距 27 |
| 文件列表内 splitter | 1 | [A] |
| Diff 文件头行 | **30**（76..106） | [S] 色彩带 + [A] |
| Diff hunk 头行 | **28.5**（108..136.5） | [S] 色彩带 + [A] |
| Diff 代码行高 | **16** | [S] 红/绿背景带 16pt |
| Diff 行号槽宽度 | 59（左）~71（AX 滚动区） | [A][S] |
| Diff 内搜索框 | 202×21，x=1686，y=52 | [A] |
| 提交区起点 | y=**871**（splitter 1pt） | [A] `AXSplitter @1126` |
| 作者行 | 872..913（**41**） | [A] |
| 消息编辑器 | x=395..1898，y=914..1139（**1503×225**） | [A] |
| 底部操作条 | 1139..1185（**46**） | [A] |
| 取消按钮 | **48×22**，x=1810，y=1151 | [A] |
| 提交按钮 | **48×22**，x=1868，y=1151 | [A] |
| 「立即推送…」复选框 | 200×20，x=395，y=1152 | [A] |
| 「更正上一次提交」复选框 | 117×18，x=603，y=1152 | [A] |
| 作者头像 | 27×27，x=362，y=884 | [A] |
| 提交选项 popup | 80×17，x=1836，y=888；左侧时钟 icon 36×16，x=1794 | [A] |

### 2.2 工具栏按钮

| 元素 | 数值 | 来源 |
|---|---|---|
| 普通工具按钮 | **40 × 52** | [A] |
| 「显示远程服务器」 | **91 × 52** | [A] |
| 「在 Finder 中显示」 | **97 × 52** | [A] |
| 右对齐终点 | x=1927（窗口宽 1935，右边距 **8**） | [A] |
| 按钮间距 | 组内 0；组间 **16**；右侧 4 个单项之间 1~2 | [A] 位置差 |
| 图标 | 22×22 左右，灰阶；标签 11pt 灰 | [S][E] |

### 2.3 侧栏

| 元素 | 数值 | 来源 |
|---|---|---|
| 分组标题行高 | **34** | [A] |
| 普通条目行高 | **26** | [A] |
| 分组图标 | 22×22，x=17（相对侧栏） | [A] |
| 分组标题文本 | x=43，11pt 大写/半粗，色 `#A8AAA9` | [A][S] |
| 普通条目文本 | x=50，13pt，色 `#1E2020` | [A][S] |
| 当前分支圆点 | 直径约 8，x≈37，色 `#1248A3` | [S] |
| 远程仓库子分支缩进 | +14（x=64） | [A] |
| 选中行 | 圆角矩形（半径约 6），左右缩进约 10，高 26，底色 `#D0D2D2` | [S][E] |
| 侧栏底部「筛选器」搜索框 | 292×21，x=7，窗口底部 y=1162（98） | [A] |

### 2.4 文件列表

| 元素 | 数值 | 来源 |
|---|---|---|
| 列表宽度 | 386.5 | [A] |
| 复选框 | **16×16**，x=354（距列表左 7） | [A] |
| 状态图标 | **13.5×13.5**，x=394.5 | [S] |
| 文件名文本起点 | x=**415** | [S] |
| 行尾「•••」 | 三圆点，x≈677..693（距右 40~56） | [S] |
| 组头复选框 | 16×16，x=354；组头文字 x=373，12pt | [A] |
| 选中行底色 | `#DCDCDC`，圆角约 6，左右缩进约 8 | [S] |

### 2.5 书签启动器（480×628）

| 元素 | 数值 | 来源 |
|---|---|---|
| 品牌标题栏 | **56** 高，深蓝 `#2346A2` | [A][S] |
| 交通灯 | 12×14，y=7（相对标题栏） | [A] |
| 分段控件（本地/远端） | 75×22，x=7，y=63；两段 38/37 | [A] |
| 「新建…」popup | 58×18，x=84，y=65 | [A] |
| 搜索框 | 292×24，x=153，y=61，占位「过滤仓库」 | [A][S] |
| 右侧「…」菜单 | 34×17，x=442，y=64 | [A] |
| 仓库行高 | **50** | [A] |
| 仓库图标 | **44×44**，x=32 | [A][S] |
| 仓库名 | x=82，13pt | [A] |
| 行右侧徽标/分支 chip | 右对齐，chip 高约 24 | [A][S] |
| 滚动条 | 17 宽 | [A] |

---

## 3. 顶部工具栏

### 3.1 运行时实际顺序（11 个动作）

> 证据：AX 中 `AXToolbar` 子按钮的顺序 + 截图。**不要** 用 NIB 中的字母序 item 定义顺序（NIB 里有 18 个定义，运行时只显示 11 个且顺序不同）。

| # | 中文标签（截图） | NIB 英文标识 | tooltip（NIB 原文） | 尺寸 | 备注 |
|---|---|---|---|---|---|
| — | （弹性空白） | `NSToolbarFlexibleSpaceItem` | — | — | 把所有按钮推到右侧 |
| 1 | **提交** | `Commit` | Commit your current changes | 40×52 | 截图中图标右上角曾出现深灰数字徽标「22」 |
| 2 | **拉取** | `Pull` | Pull commits from a remote | 40×52 | |
| 3 | **推送** | `Push` | Push commits to a remote | 40×52 | |
| 4 | **抓取** | `Fetch` | Fetch commits from remotes | 40×52 | |
| 5 | **分支** | `Branch` | Create or delete branches | 40×52 | |
| 6 | **合并** | `Merge` | Merge another branch into your current one | 40×52 | |
| 7 | **贮藏** | `Stash` | Stash your current changes away for later | 40×52 | |
| 8 | **显示远程服务器** | `Remote`（View Remote） | Open the repository's website | **91×52** | 宽按钮 |
| 9 | **在 Finder 中显示** | `Show in Finder` | Show repository's root directory in a new Finder window | **97×52** | 宽按钮 |
| 10 | **终端** | `Terminal` | Open a terminal window with your current working folder | 40×52 | |
| 11 | **设置** | `Settings` | Settings for this repository | 40×52 | 仓库设置 |

- 视觉分组（按 16pt 间隙推得）：`[提交]` · `[拉取 推送 抓取]` · `[分支 合并]` · `[贮藏]` `[显示远程服务器]` `[在 Finder 中显示]` `[终端]` `[设置]`。前后组之间是工具栏分隔（视觉上仅间距，无竖线）。
- NIB 还定义了 `Git Flow`、`Refresh`、`Refresh` tooltip、`Reset`、`Tag` 等 item [N]，但当前运行时工具栏 **未显示**（可能是版本默认集/窗口宽度/用户自定义，未知）。
- **启用/禁用状态**：四张截图里 11 个按钮均为同一灰阶图标 + 灰色文字；AX 未暴露 `DISABLED` 标记，无法区分 enabled/disabled。已知唯一状态差异是 **Commit 图标的数字徽标**：98 窗口在 17:26 的截图里有「22」，17:30 后消失（`crop_98_toolbar_right.png` 有徽标版本）。徽标语义未确认（推测为 incoming/pending commit 数，**未知**）。
- 图标造型（20~22pt 线性图标）：提交=圆形+加号（外圈）；拉取=下箭头圆；推送=上箭头圆；抓取=虚线圆+下箭头；分支=分叉点线；合并=两条汇入；贮藏=方盒；显示远程服务器=地球；在 Finder 中显示=托盘+下箭头；终端=`>_`；设置=齿轮。
- 工具按钮点击行为均打开对应 sheet/窗口（如 推送→GitPushSheet）或执行动作（终端/Finder）；NIB 中对应 action：`commit: pull: push: fetch: branch: merge: flowProcessNextAction: refreshIncludingIncomingOutgoing: openRepoWebsite: revert: repositorySettings: showRepoInFinder: createStash: addRemoveTag: openTerminal:` [N]。

局部证据：`assets/crops/crop_98_toolbar_right.png`。

---

## 4. 左侧导航栏

宽度 346.5（1935 窗口）/ 306（1512 窗口）；背景与标题栏同为 `#E8EAE9`（半透明 vibrancy 材质，采样值随桌面背景略有浮动）；右侧 1pt splitter。

### 4.1 分组结构（从上到下，7 组）

| # | 分组标题 | 图标（NIB 资源名）[N] | 子项 | 截图中的状态 |
|---|---|---|---|---|
| 1 | **WORKSPACE** | `Workspace`（显示器图标） | **文件状态**（默认选中）、**历史**、**搜索** | 三项；文件状态为灰色圆角选中态 |
| 2 | **分支** | `Branches`（分叉图标） | 本地分支列表；当前分支前置 8pt 蓝色圆点 + 粗体；分支文件夹（如 `claude`、`feature`）带展开三角 + 文件夹图标 | 98：feat/git-panel / **master** / test；99：claude（文件夹）/ feat/git-panel / **master** |
| 3 | **标签** | `Tags` | 标签项（`v1.0` 等） | 本次截图中为空，仅标题 |
| 4 | **远端** | `Sidebar Remotes`（云图标） | 远端名（origin，可展开）+ 子分支；子分支缩进 +14；`HEAD` 也作为子项出现；可有分支文件夹（feature/fix） | 98：origin 展开，11 个子项；996：origin 下含 HEAD/feature 文件夹/fix 文件夹 |
| 5 | **已贮藏** | `Stashes` | stash 条目 | 空 |
| 6 | **子模块** | `Submodules` | submodule 条目 | 空 |
| 7 | **子树** | `Subtrees` | subtree 条目 | 空 |

`WORKSPACE` 是唯一使用英文大写标题的分组；其余分组标题直接使用中文（`分支/标签/远端/已贮藏/子模块/子树`），图标为蓝灰线性图标（主色约 `#45516C`）。

### 4.2 行解剖与选中态

- 分组标题行（34pt）：`[22×22 icon @x17] [label @x43, 11pt, #A8AAA9]`，不可选中（点击折叠/展开该组）。
- 普通条目行（26pt）：`[icon/占位 @x17..39] [text @x50, 13pt, #1E2020]`。
- 当前分支：圆点 `#1248A3` 直径约 8，圆心 x≈40；文字 **粗体**，x=52。
- 分支文件夹：展开三角 @x≈39，文件夹图标 @x≈52，文字 @x≈72（比普通条目再缩进约 22）。
- 远端子分支：在父项基础上 +14（text x=64）。
- 选中行：整行（左右约 10pt 内缩）填充 `#D0D2D2` 圆角矩形（半径约 6），文字仍为深色；选中态与 hover 态未分离（hover 未取证）。
- 侧栏底部固定「筛选器」搜索框（292×21，圆角搜索样式，放大镜在左）。
- 右键菜单按节点类型不同（NIB outlet 证据）：分支 / 文件状态 / 无选中 / 远端 / 远端分支 / stash / submodule / subtree / tag 各有一套菜单项，详见 `research/ib-summary.md` §3.1。这是重建侧栏交互的重要素材。

局部证据：
- `assets/crops/crop_98_sidebar_workspace.png`（WORKSPACE + 选中态）
- `assets/crops/crop_98_sidebar_branches.png`（当前分支圆点/粗体）
- `assets/crops/crop_98_sidebar_remotes.png`（origin 展开与缩进）
- `assets/crops/crop_98_sidebar_bottom.png`（已贮藏/子模块/子树 + 筛选器）

---

## 5. 文件列表（文件状态视图）

### 5.1 结构

```
[ 列表头 27pt ]  「待定的文件, 已依照路径排序 ▾」     [☰] [⌄]
[ 组头 27pt  ]  ☑ 已暂存文件
[ 已暂存行 ×N, 27pt ]
[ splitter 1pt ]
[ 组头 27pt  ]  ☐ 未暂存文件
[ 未暂存行 ×N, 27pt ]
```

- 两个分组：**已暂存文件**（staged/index）与**未暂存文件**（working tree）。组头前的复选框是全选/全不选（已暂存组截图为勾选态，未暂存组为未勾选态）。
- 列表头：菜单按钮「待定的文件, 已依照路径排序」→ 排序方式菜单；右侧「平面列表(单列)」视图模式按钮 + 排序方向按钮。背景 `#EDEFEF`，高 27。
- 行数超过可视区时各自滚动（38x? 滚动条 17pt，`AXScrollBar value=1.0` 表示已滚到底部）。
- 勾选复选框 = 暂存/取消暂存文件（**本次未点击，仅截图**）。

### 5.2 行解剖（27pt）

从左到右：

1. **复选框** 16×16，x=354：圆角约 3pt，浅灰 1pt 边框；勾选时黑/深色对勾。行内复选框控制单个文件暂存。
2. **状态图标** 13.5×13.5，x=394.5：圆角约 3pt 的实色方块 + 白色字形。
3. **路径文本** x=415，13pt，色 `#272727`；使用相对仓库根的单列路径（`docs/adr/0001-...md`、`src/const/crud/survey/survey.js`），过长省略。
4. **行尾「•••」**：三个 2~2.5pt 圆点，x≈677..693；NIB 中该控件是 `STRolloverButton`（22 个，每个文件行一个）[N]。截图中**始终可见**（不依赖 hover），悬停是否高亮未取证。
5. **选中行**：`#DCDCDC` 圆角条，覆盖 x≈355..727，高 25，圆角约 6。选中行同时驱动右侧 diff 显示该文件。
6. 行与行之间无分隔线；白底 `#FFFFFF`。

### 5.3 状态图标词表（已观测）

| 图标 | 颜色（采样） | 含义 | 出现位置 | 证据 |
|---|---|---|---|---|
| 实心方块 + 白色「+」 | **`#388636`** | 新增/已加入暂存（Added） | 已暂存文件行 | [S] 98/99 |
| 实心方块 + 白色「?」 | **`#624B7F`**（紫） | 未跟踪（Untracked） | 未暂存文件行 | [S] 98 |
| 实心方块 + 白色「•••」 | **`#EEC555`**（琥珀） | 已修改（Modified） | 未暂存文件行 / 历史文件列表 / diff 文件头 | [S] 98/99 |

- 未观测到的状态（删除 D、重命名 R、冲突 U、未合并等）配色 **未知**；NIB 只有图标资源，无法取色。建议实现时沿用 SourceTree 语义色：绿=新增、琥珀=修改、紫=未跟踪、红=删除/冲突、灰=忽略（后两者为推测）。
- 图标形状为 SourceTree 4 的「圆角小方块 + 白色字形」，与系统 SF Symbols 无关。
- 行尾菜单内容未打开取证；NIB `DiffFileView` 的上下文菜单给出候选：`Stage File / Discard File / Unstage File / Reverse File`（中文：暂存文件/放弃文件/取消暂存/反向）[N]。

局部证据：
- `assets/crops/crop_98_filelist_header.png`
- `assets/crops/crop_98_filelist_staged.png`
- `assets/crops/crop_98_filelist_unstaged.png`
- `assets/crops/crop_99_filelist.png`

---

## 6. Diff 视图

### 6.1 区域布局（1935 窗口，diff 区 x=733.5..1935，宽 1201.5）

```
[ 顶部行 27pt ]                                [🔍 搜索 202×21] [显示空白字符 34×16]
[ 文件头 30pt ] [状态icon 18] manifest.json                         [••• 28×20]
[ hunk 头 28.5pt ] 块 1：行 66-72                 [暂存区块 58×18] [放弃区块 58×18]
[ 代码体 ] 行号槽 59pt | +/- | 代码文本（行高 16pt）
[ ... 多个 hunk ... ]
```

- **顶部行**：diff 区顶部与文件列表头同高（27pt，`#EEEFEF`）；右侧是 202×21 圆角搜索框（放大镜 + 「搜索」占位）与 34×16「显示空白字符」菜单按钮。
- **文件头**（30pt，底色 `#ECECEC`）：左侧 18×18 状态图标（与文件列表同一套）+ 文件路径文本（13pt）；右侧 28×20 的「•••」菜单（内容对应 `Stage File/Discard File/Unstage File/Reverse File`）[N]。可滚动时文件头随内容滚走（98 截图即处于滚动状态，文件头不可见；99 截图完整可见）。
- **hunk 头**（28.5pt，底色 `#EEEFEF`）：左侧「块 N：行 A-B」（12pt，浅灰 `#B3B4B4`）；右侧两个 58×18 白底圆角按钮 **暂存区块**、**放弃区块**（1pt 边框 `#E2E3E3`，12pt 灰字 `#6B6C6C`）。
- **代码体**：左侧行号槽（59pt）含「旧行号 + 新行号」两列（右对齐，11pt 等宽，`#BFBEBF`）；文本区左缘有 `+/-` 标记列；文本 11pt 等宽（Menlo 类，估计值）。
- 多 hunk 依次排列，hunk 之间是白色/浅灰间隔；无折叠控件（未观察到）。
- 空态/无 diff 区底色 `#EEEFEF`；横向滚动条 `#C2C2C2` 轨道 `#FAFAFA`。

### 6.2 增删与语法着色（**重要发现**）

- **内建 diff 没有语法高亮**：上下文行是纯深灰单色文本；被删除行整行文字统一红色；新增行整行文字统一绿色。NIB 中也没有任何 syntax/highlighter 类 [N]。
- 采样值：

| 元素 | 背景 | 文字 |
|---|---|---|
| 删除行（`-`） | **`#FDEFEB`**（淡红） | **`#BF4919`**（砖红） |
| 新增行（`+`） | **`#EBFBF3`**（淡绿） | **`#297558`**（墨绿） |
| 上下文行 | `#FFFFFF` | `#272727`（近黑） |
| hunk 头 | `#EEEFEF` | `#B3B4B4` |
| 行号 | `#FFFFFF` | `#BFBEBF` |
| `+/-` 标记 | 同所在行 | 红/绿（同文字色） |

- 行号列的 `-`/`+` 标记：删除行左侧 `-`（红），新增行 `+`（绿），上下文行空白；行号旧/新两列在同一 59pt 槽内。
- 外部 diff 工具（NIB 菜单 `External Diff`）未取证，可能由用户配置，未知。

局部证据：
- `assets/crops/crop_99_diff_header.png`（完整文件头 + hunk 头 + 按钮）
- `assets/crops/crop_99_diff_body.png`（红/绿行、行号槽）
- `assets/crops/crop_98_diff_header.png`（滚动状态下顶部）
- `assets/crops/crop_98_diff_hunks.png`（多 hunk、按钮、行号列）

---

## 7. 提交区（底部 footer）

自 y=871 起，横跨右侧整个内容区（x=347..1935，宽 1588；不含左侧栏）。背景 `#EEEFEF`。

```
y 872..913  作者行： [头像 27×27]  alex@example.com <alex@example.com>        [时钟 icon 36×16] [提交选项... 80×17 ▾]
y 914..1139 消息编辑器：白色圆角输入区 1503×225（1pt 浅灰边框），空时无可见占位
y 1139..1185 底部条： ☐ 立即推送变更到 origin/master   ☐ 更正上一次提交        [取消 48×22] [提交 48×22]
```

- **作者行**（41pt）：左侧 27×27 圆形头像（默认灰色人形剪影；不同提交者由 Gravatar/identicon 替换）；作者文本 13pt `#242525`。右侧：时钟 icon（36×16）→「提交选项...」popup（80×17，带 ▾）。
- **提交选项... 菜单**（NIB 英文）：`Amend last commit`（更正上一次提交）、`Bypass commit hooks`、`Sign commit`、`Sign off`、`Create pull request` [N]。截图中未展开。
- **消息编辑器**（225pt 高）：白底、细边框、轻微圆角；空时无可见 placeholder（NIB 占位为 `Commit message`，运行时未显示）。NIB 类 `STCommitTextView`（NSTextView 子类）[N]。
- **底部条**（46pt）：左侧两个复选框：
  - ☐ **立即推送变更到 origin/master**（宽度随分支名变化，200×20；当前分支不是 master 时为 `origin/<branch>`；996 窗口为 `origin/feature-chz-ui改版`）
  - ☐ **更正上一次提交**（117×18）
  - 右侧 **取消**（48×22，白底 `#FFFFFF`、边框 `#E6E7E7`、深色字）
  - 右侧 **提交**（48×22）：禁用态为浅灰底 `#F7F7F7` + 边框 `#B9B9B9` + 灰字；**启用态颜色未取证**（四张截图都没有可提交消息）。
- AX 状态：99 窗口有未暂存文件但消息为空时 `提交` 为 `DISABLED`；98 窗口同一时刻 AX 未标记 disabled（截图看起来按钮同样白底，语义未确认）。
- 「立即推送」复选框的 `origin/master` 文本会随当前分支变化（动态文案）。

局部证据：
- `assets/crops/crop_98_commit_header.png`
- `assets/crops/crop_98_commit_editor.png`
- `assets/crops/crop_98_commit_bottom.png`
- `assets/crops/crop_99_commit.png`（完整 footer 含禁用提交按钮）

---

## 8. 历史视图

通过菜单「查看 → 历史视图（⌘2）」进入（`查看` 菜单还有 `文件状态视图 ⌘1`、`搜索视图 ⌘3`）。截图：`assets/st_win_98_history.png`。

### 8.1 布局

```
[ 视图工具条 27pt ] 所有分支 ⇕   显示远程分支 ⇕   层级顺序 ⇕   紧凑视图 ⇕        跳转到： ⇕
[ 表头 26pt ]       图表 | 描述 | 提交 | 作者 | 日期
[ 提交行 ×N, 行高≈20.5pt ]  左侧 88pt 提交图 lane + 描述（分支 chip 内联）+ 短 hash + 作者 + 日期
────────────────────────────────────────────────────────────
[ 下半区 ]  左：选中提交的改动文件列表（已依照路径排序 ▾）   右：该文件 diff
            左下：提交详情面板（头像/标题/提交:/父级:/作者:/日期:/标签:）
```

### 8.2 提交图（lane rendering）

- 列宽约 83~88pt（NIB `graph` 列 88 [N]）；lane 竖线约 1.5pt，节点为直径约 9pt 的实心圆；merge 处用斜线连接。
- 采样 lane 颜色：**蓝 `#295DB9`**、**红 `#BF4919`**、**琥珀 `#F4A230`**（另可能有更多分支色未采样）。
- 顶部「Uncommitted changes」行：空心灰圆环（非实心），该行文字加粗。
- 分支 chip 内联在描述列：圆角矩形（高约 18，半径 4），淡蓝底（采样约 `#D9E6FD`）+ 边框 + 分支图标 + 名称（12pt）；远端分支 chip 有淡粉/淡橙变体（未精确采样）。

### 8.3 表头与列（估计自标签位置）

| 列 | 起始 x（窗口内） | 宽度（估） | 内容 |
|---|---|---|---|
| 图表 | 347 | ~83 | lane 图 |
| 描述 | 430 | ~945（弹性） | 提交信息首行 + 分支/tag chip；merge 提交显示 `Merge branch 'x' into y` |
| 提交 | 1375 | ~250 | 短 hash（如 `13260e5a`），等宽字体 |
| 作者 | 1625 | ~116 | `Alexzhou123...`（截断） |
| 日期 | 1741 | ~194 | `昨天 15:42` / `今天 17:19` / `2026年10月16...` |

- 表头文字 11pt semibold `#232424`，列间浅灰竖线；「日期」列带排序箭头。
- 行高约 20.5pt；选中行整行 `#DCDCDC`；默认白底；无行分隔线。
- 工具栏四项：「所有分支」（过滤）、「显示远程分支」、「层级顺序」、「紧凑视图」，右侧「跳转到：」+ 下拉。
- 下半区：
  - 左列文件列表：头「已依照路径排序 ▾」+ 视图模式；行 = 黄色 status icon + 单列路径；选中行灰底；下方是提交详情面板。
  - 提交详情：绿色几何 identicon/头像（约 40×40）；标题=提交信息首行（如「风险等级反显」）；字段行 `提交:`（完整 SHA）、`父级:`（蓝色可点击链接，显示短 SHA）、`作者:`、`日期:`（`2026年10月19日 GMT+815:42:13` 这种本地化格式）、`标签:`；标签行灰色 label + 深色 value。
  - 右侧 diff：与文件状态视图同一套 diff 组件（文件头/hunk 头/行号/增删色）。

局部证据：
- `assets/crops/crop_98h_toolbar.png`
- `assets/crops/crop_98h_tableheader.png`
- `assets/crops/crop_98h_graph.png`
- `assets/crops/crop_98h_rows.png`
- `assets/crops/crop_98h_detail.png`
- `assets/crops/crop_98h_filelist.png`

---

## 9. 配色与排版 token 表

### 9.1 颜色（**sampled** = 截图取色，坐标为该窗口内容区 pt；**estimated** = 由相邻色/控件推得）

| Token | Hex | 用途 | 采样位置 | 类型 |
|---|---|---|---|---|
| `titlebar.bg` / `sidebar.bg` | **`#E8EAE9`** | 统一标题栏、工具栏、侧栏、footer 背景（vibrancy 材质，随桌面略变） | 98 (600,20) | sampled |
| `window.bg.bookmarks` | **`#EEF0F1`** | 书签窗口顶部工具区背景 | 79 (100,70) | sampled |
| `bookmarks.titlebar` | **`#2346A2`** | 书签窗品牌标题栏 | 79 (100,25) | sampled |
| `bookmarks.titletext` | `#FFFFFF` | 标题栏文字/Logo | 79 (250,30) | sampled |
| `bookmarks.icon.blue` | **`#6DAADC`** | 仓库圆形图标底色 | 79 (54,127) | sampled |
| `bookmarks.icon.glyph` | `#FAFCFE` | 图标内 `</>` | 79 (54,127) | sampled |
| `bookmarks.row.selected` | **`#DCDCDC`** | 书签选中行 | 79 (320,125) | sampled |
| `bookmarks.separator` | `#DCDCDC` | 行分隔线 | 79 (320,151) | sampled |
| `badge.bg` | **`#5F5F5F`** | 数字徽标（22/1/121） | 79 (370,126) | sampled |
| `badge.text` | `#FFFFFF` | 徽标数字 | 79 | sampled |
| `chip.bg` | **`#DCDCDC`** | 书签行分支 chip 底 | 79 (400,125) | sampled |
| `chip.border` | **`#A1A1A1`** | chip 边框 | 79 (386,125) | sampled |
| `chip.text` | `#212121` | chip 文本 | 79 | sampled |
| `sidebar.item.text` | **`#1E2020`** | 侧栏条目文字 | 98 (70,108) | sampled |
| `sidebar.section.text` | **`#A8AAA9`** | 分组标题（WORKSPACE/分支/标签…） | 98 (60,78) | sampled |
| `sidebar.section.icon` | `#45516C`（主）/`#D4D8DE`（辅） | 分组图标线条/填充 | 98 (28,68) | sampled |
| `sidebar.selected` | **`#D0D2D2`** | 选中行圆角底 | 98 (200,108) | sampled |
| `branch.current.dot` | **`#1248A3`** | 当前分支蓝点 | 99 (39,283) | sampled |
| `list.header.bg` | **`#EDEFEF`** | 列表头 / 组头栏 / 历史工具条 | 98 (600,60) | sampled |
| `list.bg` | `#FFFFFF` | 列表、编辑器、diff 上下文 | 98 (500,650) | sampled |
| `row.selected` | **`#DCDCDC`** | 文件行/历史行选中 | 98 (400,120) | sampled |
| `row.text` | **`#272727`** | 文件路径、组头文字 | 98 (450,120) | sampled |
| `icon.added` | **`#388636`** | 新增状态图标底 | 98 (401,125) | sampled |
| `icon.untracked` | **`#624B7F`** | 未跟踪状态图标底 | 98 (401,352) | sampled |
| `icon.modified` | **`#EEC555`** | 修改状态图标底 | 98 (401,408) | sampled |
| `toolbar.icon` | `#A0A1A0` | 工具栏图标线条 | 98 (1349,19) | sampled |
| `toolbar.label` | **`#ADAFAE`** | 工具栏文字 | 98 (1349,44) | sampled |
| `diff.header.bg` | **`#ECECEC`** | 文件头（manifest.json 行） | 99 (800,90) | sampled |
| `diff.hunk.bg` | **`#EEEFEF`** | hunk 头、diff 空区、提交区 | 99 (900,120) | sampled |
| `diff.hunk.text` | **`#B3B4B4`** | 「块 1：行 66-72」 | 99 (800,120) | sampled |
| `diff.lineno.text` | **`#BFBEBF`** | 行号文字 | 99 (720,160) | sampled |
| `diff.removed.bg` | **`#FDEFEB`** | 删除行背景 | 99 (900,192) | sampled |
| `diff.removed.text` | **`#BF4919`** | 删除行文字 | 99 (850,192) | sampled |
| `diff.added.bg` | **`#EBFBF3`** | 新增行背景 | 99 (900,208) | sampled |
| `diff.added.text` | **`#297558`** | 新增行文字 | 99 (850,208) | sampled |
| `diff.context.text` | `#272727` | 上下文代码文字（无语法高亮） | 98 (900,315) | sampled |
| `diff.button.bg` | `#FFFFFF` | 暂存区块/放弃区块按钮 | 99 (1400,122) | sampled |
| `diff.button.border` | **`#E2E3E3`** | 同上边框 | 99 | sampled |
| `diff.button.text` | **`#6B6C6C`** | 同上文字 | 99 | sampled |
| `footer.bg` | **`#EEEFEF`** | 提交区背景（作者行/底部条） | 99 (900,565) | sampled |
| `footer.author.text` | **`#242525`** | 作者 email 行 | 99 (500,565) | sampled |
| `button.cancel.bg` | `#FFFFFF` | 取消按钮底 | 99 (1400,834) | sampled |
| `button.cancel.border` | `#E6E7E7` | 取消按钮边框 | 99 | sampled |
| `button.cancel.text` | `#262626` | 取消按钮文字 | 99 | sampled |
| `button.commit.disabled.bg` | **`#F7F7F7`** | 提交禁用态底 | 99 (1465,834) | sampled |
| `button.commit.disabled.border` | **`#B9B9B9`** | 提交禁用态边框 | 99 | sampled |
| `button.commit.enabled.*` | 未采样 | 启用态主按钮色 | — | **未知** |
| `checkbox.border` | `#C7C7C7`（估） | 复选框边框（截图浅灰） | 98 | estimated |
| `scrollbar.thumb` | **`#C2C2C2`** | 滚动条滑块 | 79 (470,300) | sampled |
| `scrollbar.track` | `#FAFAFA` | 滚动条轨道 | 79 | sampled |
| `separator.line` | `#C2C2C2` | splitter/分栏线 | 98 | sampled |
| `history.lane.blue` | **`#295DB9`** | 提交图 lane 1 | 98h (365,120) | sampled |
| `history.lane.red` | **`#BF4919`** | 提交图 lane 2 | 98h (365,150) | sampled |
| `history.lane.amber` | **`#F4A230`** | 提交图 lane 3 | 98h (365,360) | sampled |
| `history.chip.fill` | `#D9E6FD` | 分支 chip 淡蓝底（部分采样） | 98h (700,150) | sampled(partial) |
| `history.selected` | **`#DCDCDC`** | 选中提交行 | 98h (1200,144) | sampled |

> 说明：macOS 会对窗口做色彩管理/材质混合，`#E8EAE9`、`#EEF0F1` 这类背景会随桌面壁纸轻微浮动；实现 Web 版时应固定为中性浅灰（建议 `#ECECEC~#F2F2F2` 区间），不要强行复刻某一像素值。

### 9.2 字体与排版（**estimated**，AX 只给出控件框高，不提供字号）

| 层级 | 字号/字重 | 说明 |
|---|---|---|
| 窗口标题 | 13pt semibold | `web-console (Git)` |
| 工具栏标签 | 11pt regular | 中文标签，灰色 `#ADAFAE` |
| 侧栏分组标题 | 11pt semibold（大写） | 字距略增，`#A8AAA9` |
| 侧栏条目 | 13pt regular | 当前分支 13pt semibold |
| 列表组头 | 12pt regular | 「已暂存文件」等 |
| 文件路径 | 13pt regular | 单行省略 |
| diff 代码 | 11pt mono（Menlo 类） | 行高 16；比例无法从 nib 确认 |
| diff 行号 | 10~11pt mono | `#BFBEBF` |
| hunk 头 | 12pt regular | 浅灰 |
| 提交作者 | 13pt regular | |
| 提交消息 | 13pt regular | 编辑器行高约 1.4 |
| 底部按钮 | 13pt medium | |
| 历史表头 | 11pt semibold | |
| 历史行 | 12~13pt regular | 行高 20.5 |

**垂直节奏**：工具栏 52 → 列表头 27 → 组头 27 → 行 27 → 行高 16（diff）→ footer 41/225/46。间距主旋律为 **27pt 文件行 / 26pt 侧栏行 / 34pt 分组 / 52pt 工具栏 / 16pt 代码行**。

**圆角**：文件/历史选中行约 6pt；输入框/按钮约 4pt；状态图标约 3pt；书签 chip 约 4pt、badge 全圆；窗口 10pt（系统）。

**图标**：侧栏/工具栏为 20~22pt 线性图标（蓝灰 `#45516C` / 灰 `#A0A1A0`）；状态图标为 13~18pt 实色圆角方块。

---

## 10. 交互流（6 条主要用户旅程）

### 流程 1：查看未暂存改动 → 暂存 → 提交 → 推送

1. 打开仓库窗口（默认「文件状态」视图）。
2. 左侧「未暂存文件」组下点击某文件行 → 行选中（灰底），右侧 diff 显示该文件。
3. 勾选文件行复选框（或点击 hunk 头的「暂存区块」）→ 文件移动到「已暂存文件」组，状态图标变绿 `+`。
4. 在底部提交区填写提交消息（作者行只读显示 `Name <email>`）。
5. 可勾选「立即推送变更到 origin/<branch>」。
6. 点击右下「提交」→ 提交生成；若勾选立即推送则继续推送。

### 流程 2：块级（hunk）暂存 / 取消暂存

1. 选中未暂存文件，右侧显示 diff（多个 hunk，每个 hunk 头右侧有「暂存区块 / 放弃区块」）。
2. 点击某 hunk 的「暂存区块」→ 该 hunk 进入暂存区；「放弃区块」→ 丢弃该 hunk 改动（危险操作）。
3. 部分暂存后，同一文件会同时出现在「已暂存文件」和「未暂存文件」两组（未验证截图，但这是 SourceTree 的既有行为；NIB 中 `Unstage Hunk / Unstage Selected Lines` 支持反向操作 [N]）。
4. 反向：选中已暂存文件的 hunk → 菜单/按钮「取消暂存区块」。

### 流程 3：放弃单文件改动

1. 在未暂存行点击行尾「•••」→ 菜单（NIB 证据：`Discard File / Stage File / Unstage File / Reverse File`）。
2. 选择「放弃文件」→ 确认后工作区改动被丢弃（本规格未执行，避免修改仓库状态）。

### 流程 4：提交并立即推送

1. 完成流程 1 的第 1~4 步。
2. 勾选「立即推送变更到 origin/master」（文案自动跟随当前分支）。
3. 点「提交」→ 提交 + push 一次完成。
4. 可勾选「更正上一次提交」执行 amend（与「立即推送」组合是 force-push 语义，App 内部会处理）。

### 流程 5：书签启动器切换/打开仓库

1. 书签窗口（480×628）默认「本地」页签；可切「远端」。
2. 顶部搜索框输入关键字过滤仓库；「新建…」菜单提供 `Clone from URL / Create Remote Repository / Add Existing Local Repository / Create Local Repository / Scan Directory / New Repository Group` [N]。
3. 双击仓库行 → 打开/聚焦对应仓库窗口。
4. 行右侧显示：未提交/入站徽标（深灰 pill，数字）、分支 chip（当前分支）、推拉计数（如 `615 170`，带图标附件）、特殊状态（如橙色「合并」chip）。

### 流程 6：查看历史与某次提交的改动

1. 仓库窗口菜单「查看 → 历史视图」（⌘2）或侧栏「历史」。
2. 上半区：提交图 + 描述/提交/作者/日期列；顶部可切换「所有分支 / 显示远程分支 / 层级顺序 / 紧凑视图」。
3. 点击某提交行 → 下半区左侧列出该提交改动的文件，右侧显示选中文件的 diff，左下显示提交详情（提交/父级/作者/日期/标签）。
4. 点击「父级」蓝色链接可跳转父提交；文件行单击切换 diff。
5. 返回「文件状态视图」⌘1。

---

## 11. 证据与限制

### 11.1 每条结论的来源

| 结论类别 | 主要来源 | 可信度 |
|---|---|---|
| 窗口数量/标题/尺寸/屏幕位置 | AX 树 + `screencapture -l` | 高（直接测量） |
| 工具栏 11 个按钮的顺序/标签/尺寸 | AX 树（顺序+坐标）+ 截图 | 高 |
| 侧栏 7 组结构、行高、缩进 | AX 树 + 截图取色 | 高 |
| 文件列表双分组/行解剖/状态图标 | 截图（2x）+ AX | 高（颜色为像素采样） |
| diff 头部按钮/hunk 头/行号槽/增删配色 | 截图 + AX + NIB 菜单项 | 高 |
| 提交区布局/复选文案/按钮尺寸 | AX + 截图；NIB 控件文本 | 高 |
| 历史视图布局/提交图/详情面板 | 截图（切到历史视图后捕获）+ NIB 列定义 | 中高（行高/列宽为估计） |
| 控件类名/右键菜单/工具栏 item 定义 | `rea decode-interface-builder` [N] | 高（IB 归档原样） |
| 字体字号/圆角/部分间距 | 从像素与控件框推算 | **估计**（标注 [E]） |
| NIB 中 target/action 对应的真实实现 | 未验证（无 decompiler） | 低（仅说明 IB 声明） |

### 11.2 明确未知 / 未取证

1. **启用态主按钮颜色**：所有截图中提交消息为空，提交按钮始终是禁用/浅色态；启用态（蓝色？）未采样。
2. **状态图标完整词表**：仅观测到新增（绿 +）、未跟踪（紫 ?）、修改（琥珀 •••）；删除/重命名/冲突/忽略的图标与颜色未知。
3. **行尾「•••」菜单的实际内容**：未点击展开；仅能从 NIB 的 DiffFileView 菜单推断（Stage/Discard/Unstage/Reverse File）。
4. **hover / focus / pressed 态**：未移动鼠标、未点击按钮，所有 hover 高亮、键盘焦点环、按下态均未取证。
5. **提交按钮 enabled/disabled 判定逻辑**：AX 显示 98 与 99 在同样"消息为空"条件下状态不同，原因未知。
6. **工具栏徽标「22」语义**：可能是入站提交数/待推送数，未确认；且会随刷新消失。
7. **书签行右侧数字与图标含义**：如 `615 170`（两个 AXTextAttachment）、`121`、`合并` chip、`1/9/92` 等计数；具体是 ahead/behind、入站/出站还是修改文件数，未验证。
8. **diff 是否可配置语法高亮**：内建视图为单色 + 行级着色；Preferences 中是否有开关未查证。
9. **hunk 折叠/展开、并排（Side-by-side）模式**：NIB 有 `Side-by-side / Before / After` 弹出菜单，但截图只有 unified 模式。
10. **历史视图精确行高/列宽**：AX 抓取超时（历史表格行数多导致 AppleScript `entire contents` 遍历过慢），行高 20.5pt、列边界均为像素估计。
11. **窗口 996 已关闭**：`data-console (Git)` 在 17:18 捕获后关闭，AX 树缺失，仅有截图。
12. **NIB 解码截断**：`graph.truncated=true`，13 个 coverage facet `partial`（`connection_unresolved`）；部分私有 IB 字段未识别。详见 `ib-summary.md` §5。
13. **无原生反编译器**：无法验证 `ST*` 类实现、绘制代码、常量色；`rea analyze` 报 `provider_unavailable`（无 Ghidra/Hopper/IDA/KUNA）。
14. **macOS 色彩管理**：同一天同一窗口不同时刻采样有 ±1~2 的 RGB 漂移（如 `#FDEFEB` vs `#FDF0EB`），已取众数。
15. **多显示器/缩放**：本次所有窗口都在 2x Retina 主屏；1x 屏下的像素对齐未验证。

### 11.3 复现命令

```bash
# 窗口列表（Swift + CGWindowList）
swift /tmp/winlist.swift

# 整窗截图（含阴影；内容区需裁掉 x=46px/y=32px 的阴影边）
screencapture -x -l98 /tmp/st_98.png

# AX 树（研究目录已存 3 份；脚本 /tmp/axdump.applescript）
osascript /tmp/axdump.applescript "web-console (Git)" 10

# 切历史视图（只读导航，不改仓库状态；本次已用 AXSelected 切换并切回）
osascript -e 'tell application "System Events" to tell process "Sourcetree" to set value of attribute "AXSelected" of UI element 3 of UI element 1 of UI element 2 of UI element 1 of UI element 1 of window "web-console (Git)" to true'

# NIB 解码（详见 research/ib-summary.md §6）
rea decode-interface-builder /tmp/STprobe2.app --format json > research/ib-decode.json
```

### 11.4 证据文件索引

- 全窗口原始截图：`assets/st_win_79.png`、`st_win_98.png`、`st_win_99.png`、`st_win_996.png`、`st_win_98_history.png`
- 去阴影内容图（推荐引用）：`assets/st_win_*_content.png`
- 局部证据：`assets/crops/`（28 张，含 toolbar / sidebar / filelist / diff / commit / history / bookmarks）
- AX 树：`research/ax/*.txt`（`Sourcetree.txt`、`web-consoleGit.txt`、`api-serviceGit.txt`）
- NIB 原始解码：`research/ib-decode.json`（24 个 IB 文档、8319 节点、5115 边）
- NIB 摘要：`research/ib-summary.md`
