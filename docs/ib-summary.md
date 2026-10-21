# Sourcetree 4.2.19 — Interface Builder 解码证据摘要

> 配套原始数据：`research/ib-decode.json`（REA `decode-interface-builder` 原样 JSON 输出，11.2 MB）。
> 本文只做索引与摘要，所有类名/outlet/action/菜单标题均来自该 JSON；未标注来源的运行时几何一律以 `sourcetree-ui.md` 的截图/AX 实测为准。

## 1. 工具与命令

REA CLI v6.7.0（`~/.local/bin/rea`），本机 **没有** 配置任何原生反编译器引擎（Ghidra/Hopper/IDA/KUNA 均未安装）。

### 1.1 成功的命令（真正跑出 `ib-decode.json` 的这条）

App bundle 直接解码时 `--max-documents` 硬上限为 **64**，按 bundle 路径字母序只覆盖到 `English.lproj/HostingServices.nib`，会漏掉 `RepoBrowserWindow.nib`、`LogView.nib` 等关键 nib。因此把需要的 17 个 nib **只读复制**到 `/tmp` 的探针 bundle 再解码（原 App 未修改）：

```bash
# 探针 bundle：/tmp/STprobe2.app
#   Contents/Info.plist  <- 复制自 /Applications/Sourcetree.app/Contents/Info.plist
#   Contents/MacOS/Sourcetree <- /bin/ls 的副本（解码器只要求 CFBundleExecutable 存在）
#   Contents/Resources/English.lproj/<17 个 nib 目录> <- 只读复制自 App

rea decode-interface-builder /tmp/STprobe2.app --format json > research/ib-decode.json
```

结果：24 个 IB archive 文档、8,319 个对象节点、5,115 条关系边；`graph.truncated = true`（见 §5）。

纳入解码的 17 个 nib：

```
GitRepoWindow
CommitAndFileStatusView
FileStatusView2
DiffFileView
DiffHunkView
DiffView
CommitPaneView
RepoBrowserWindow
MainMenu
LogView
RevisionFileListView
SearchView
GitPushSheet
GitPullSheet
CommitSheet2
TaskWindow
STToolbarTip
```

### 1.2 全 App 的一次解码（对照用，未入库）

```bash
rea decode-interface-builder /Applications/Sourcetree.app --max-documents 64 --format json
# 成功；64 个文档、9,631 节点、4,868 边、truncated=true
# 覆盖到 English.lproj/HostingServices.nib 为止（含 GitRepoWindow / CommitAndFileStatusView /
# FileStatusView2 / DiffFileView / DiffHunkView / CommitPaneView / GitPushSheet / GitPullSheet 等）
```

### 1.3 `rea analyze`（失败，记录在此）

```bash
rea analyze /Applications/Sourcetree.app --format json
```

```json
{"error":"Analysis failed","code":"provider_unavailable","category":"unavailable",
 "message":"The selected analysis provider is unavailable. Review the reported local diagnostics or run `rea doctor`, then retry.",
 "details":{"operation":"read_binary_inventory_summary","requested_provider_id":"auto",
 "candidate_ids":["ghidra","hopper","ida","kuna"],
 "rejections":[{"provider_id":"ghidra","code":"not_configured",
   "reason":"Set GHIDRA_INSTALL_DIR to an extracted Ghidra 12.1.x release directory."}, ...]}}
```

结论：静态二进制分析（类实现、方法体、资源常量）不可用；本文所有证据仅来自 **IB 归档解码 + 运行时截图 + AX 树**。

### 1.4 `rea inspect-artifact`（成功，仅用于清点）

```bash
rea inspect-artifact /Applications/Sourcetree.app --format json
```

成功返回 bundle 清单（约 4.2 MB JSON，含 SHA-256、Mach-O universal x86_64+arm64 等）；因体积与 UI 无直接关系，未落盘。

## 2. 解码文档清单

| # | 文档 | 对象数 | 连接数 | 层级完整 |
|---|---|---|---|---|
| 0 | CommitAndFileStatusView.nib | 206 | 64 | true |
| 1 | CommitPaneView.nib | 68 | 14 | true |
| 2 | CommitSheet2.nib | 22 | 3 | true |
| 3 | DiffFileView.nib | 201 | 61 | true |
| 4 | DiffHunkView.nib/keyedobjects-101500.nib | 90 | 33 | true |
| 5 | DiffHunkView.nib/keyedobjects-110000.nib | 90 | 33 | true |
| 6 | DiffView.nib | 23 | 4 | true |
| 7 | FileStatusView2.nib/keyedobjects-101500.nib | 890 | 285 | true |
| 8 | FileStatusView2.nib/keyedobjects-110000.nib | 890 | 285 | true |
| 9 | GitPullSheet.nib | 148 | 29 | true |
| 10 | GitPushSheet.nib/keyedobjects-101500.nib | 112 | 28 | true |
| 11 | GitPushSheet.nib/keyedobjects-110000.nib | 112 | 28 | true |
| 12 | GitRepoWindow.nib/keyedobjects-101500.nib | 235 | 94 | true |
| 13 | GitRepoWindow.nib/keyedobjects-110000.nib | 235 | 94 | true |
| 14 | LogView.nib/keyedobjects-101500.nib | 430 | 115 | true |
| 15 | LogView.nib/keyedobjects-110000.nib | 430 | 115 | true |
| 16 | MainMenu.nib | 269 | 163 | true |
| 17 | RepoBrowserWindow.nib/keyedobjects-101500.nib | 680 | 178 | true |
| 18 | RepoBrowserWindow.nib/keyedobjects-110000.nib | 680 | 178 | true |
| 19 | RevisionFileListView.nib | 78 | 15 | true |
| 20 | STToolbarTip.nib | 30 | 3 | true |
| 21 | SearchView.nib/keyedobjects-101500.nib | 194 | 66 | true |
| 22 | SearchView.nib/keyedobjects-110000.nib | 194 | 66 | true |
| 23 | TaskWindow.nib | 71 | 16 | true |

同一 nib 的 `keyedobjects-101500` / `keyedobjects-110000` 是不同部署目标版本的编译变体，内容基本一致，下表只引用其一。

## 3. 按窗口的关键解码结果

### 3.1 GitRepoWindow.nib（每仓库主窗口）

- **NSWindow**：`NSWindowTitle = "Git Repository"`，nib 设计尺寸 `{{188,325},{1050,465}}`，`NSWindowStyleMask = 15`（titled|closable|miniaturizable|resizable），`NSWindowClass = NSWindow`，`NSWindowContentMinSize = {700,300}`，`NSWindowToolbarStyle = 1`（unified），`NSWindowCollectionBehavior = 128`。
- **窗口控制器**：`STGitWindowController`（outlet：`window`、`contentArea`、`mainSplit`、`commandOutputSplit`、`commandOutputView`、`sidebar`、`filterField`、`filterBackground`、`topRightPopoverAnchor`、`commitToolbarItem`、`pullToolbarItem`、`pushToolbarItem`、13 个 `sidebarMenu*`）。
- **NSToolbar**：identifier `gittoolbar1.9`，`NSToolbarDisplayMode = 1`（icon+label），`NSToolbarPrefersToBeShown = false`，不允许用户自定义（`NSToolbarAllowsUserCustomization = false`），自动保存关闭。
- **工具栏 item 定义（nib 中共 18 个，按字母序输出）**：

| identifier | palette label | tooltip（nib 原文） |
|---|---|---|
| Branch | Branch | Create or delete branches |
| Commit | Commit | Commit your current changes |
| Fetch | Fetch | Fetch commits from remotes |
| Git Flow | Git Flow | Git Flow |
| Merge | Merge | Merge another branch into your current one |
| NSToolbarFlexibleSpaceItem | Flexible Space | — |
| NSToolbarSeparatorItem | Separator | — |
| NSToolbarSpaceItem | Space | — |
| Pull | Pull | Pull commits from a remote |
| Push | Push | Push commits to a remote |
| Refresh | Refresh | Refresh view (only needed if you disabled automatic refresh) |
| Remote | View Remote | Open the repository's website |
| Reset | Reset | Reset your working copy to undo changes |
| Settings | Settings | Settings for this repository |
| Show in Finder | Show in Finder | Show repository's root directory in a new Finder window |
| Stash | Stash | Stash your current changes away for later |
| Tag | Tag | Create or remove tags |
| Terminal | Terminal | Open a terminal window with your current working folder |

  **注意**：运行时截图/AX 只有 11 个按钮，顺序与 nib 定义不同（见 `sourcetree-ui.md` §3）；nib 里另有 `Git Flow / Refresh / Reset / Tag` 未出现在当前运行时工具栏。
- **视图树**：`NSView → NSSplitView(mainSplit) → NSView(侧栏) → NSSplitView → NSVisualEffectView(搜索框底) + NSScrollView → STSidebarOutlineView`；右侧 `NSView`；底部 `commandOutputView`。
- **侧栏 cell**：`STSidebarCellView`（header，含 20×20 `NSImageView` + bold 文本，reuse id `SidebarHeaderViewCell`）、`STSidebarCellView`（item，reuse id `SidebarItemViewCell`）、`STSidebarCell`（`NSTextFieldCell` 子类）。
- **侧栏右键菜单**（`STGitWindowController` 上的 menu outlet，nib 标题）：
  - `sidebarMenuBranch`：Update To... / Merge... / Rebase... / Fetch branch / Pull Tracked Branch / Push Tracked Branch / Push to ▸ / Track Remote Branch ▸ / Diff Against Current / Rename... / Delete / Close... / Copy Branch Name to Clipboard / Create Pull Request...
  - `sidebarMenuFileStatus`：Commit... / Revert...
  - `sidebarMenuNoSelection`：New Branch... / New Tag... / New Remote... / New Submodule... / New Subtree...
  - `sidebarMenuRemote`：Fetch... / Pull... / Push... / Remove...
  - `sidebarMenuRemoteBranch`：Checkout... / Pull into Local Branch... / Copy Branch Name to Clipboard / Diff Against Current / Delete... / Create Pull Request...
  - `sidebarMenuStash`：Apply Stash / Delete Stash
  - `sidebarMenuSubmodule`：Open / Delete / Change Source URL...
  - `sidebarMenuSubtree`：Pull subtree... / Push subtree... / Details... / Edit subtree details... / Delete subtree details...
  - `sidebarMenuTag`：Copy Tag Name to Clipboard / Update To… / Details... / Diff Against Current / Push to ▸ / Delete Tag...
- **图标资源名**：`Workspace`、`Branches`、`Tags`、`Sidebar Remotes`、`Stashes`、`Submodules`、`Subtrees`（与运行时 AX 的 `AXImage desc` 完全对应）。

### 3.2 RepoBrowserWindow.nib（书签/仓库启动器）

- **窗口**：`STRepoBrowserWindow`，标题 `Sourcetree`，nib 尺寸 `{{196,240},{480,600}}`，styleMask 15，`contentMin {480,420}`；运行时为 **480×628**。
- **控制器**：`STRepoBrowserWindowController`。
- **自定义 cell/view**（行解剖的直接证据）：
  - `STRepoBrowserBookmarkOutlineView`（NSOutlineView 子类，2 个）
  - `STBookmarkCellView` / `STBookmarkFolderCellView` / `STRemoteBrowserRepoCellView` / `STRemoteBrowserFolderCellView`
  - `STRepoBrowserBookmarkRowView`（自定义 row view，负责选中/悬停底色）
  - `STBookmarkCell` / `STRepoBookmarkTextCell` / `STBranchTextCell` / `STPushPullTextCell` / `STModifiedFileCountTextCell` / `STRepoWarningTextCell`（NSTextFieldCell 子类——对应行内"分支名 / 推拉计数 / 修改文件数 / 警告"）
  - `STAvatarImageView`、`STBlueProgressBar`、`STDragDropBox`、`STCustomBox`、`STClickableTextField`、`STLinkButton(+Cell)`
- **NSButtonCell "New…"** + 菜单：New… / Clone from URL / Create Remote Repository / Add Existing Local Repository / Create Local Repository / Scan Directory / New Repository Group。
- **搜索框**：`NSSearchField`，`NSPlaceholderString = "Filter"`（运行时本地化为"过滤仓库"）。
- **其它行菜单**：Open / Quick Look / Show in Finder / Open in Terminal / Rename / Delete / Convert to SSH / Convert to HTTPS / Publish to Remote… / View Remote / Refresh Avatar / Custom Actions；Accounts… / Expand All / Collapse All / Sort by Name / Sort by Type / Compact View / Refresh Avatars / Convert All to SSH / Convert All to HTTPS。
- 还含 Clone / Create Local Repository 等 sheet（同一 nib 内多 window）。

### 3.3 CommitAndFileStatusView.nib（底部提交区 + 文件状态容器）

- 控制器 `STCommitAndFileStatusPanelViewController`；自定义控件 `STCommitTextView`（NSTextView 子类，消息编辑器）、`STNotifierTextField`、`STClickableImageView` ×3（头像/图标）。
- 关键控件文本（nib 英文原文 → 运行时中文）：
  - 作者占位：`Joel Unger <joel@atlassian.com>`（运行时替换为当前 git user）
  - 提交按钮：`Commit`（中文"提交"），`Cancel`（"取消"）
  - 复选框：`Amend last commit`（"更正上一次提交"）、`Push changes immediately to origin/master`（"立即推送变更到 origin/master"）
  - 消息占位：`Commit message`
  - 弹出：`Commit Options...`（"提交选项..."），菜单项：Amend last commit / Bypass commit hooks / Sign commit / Sign off / Create pull request
  - 作者选择：`Email:`、`Name:`、`Use default author`、`Use alternative author`、`OK`
- 结论：提交区是"作者行 + 消息编辑器 + 提交选项 popup + 底部三控件"结构，与截图一致。

### 3.4 FileStatusView2.nib（文件列表）

- 控制器 `STFileStatus2ViewController`；自定义类：`STCustomSplitView`、`STTableView` ×6、`STFileStatusOutlineView` ×3、`STFileStatusHeaderTableCellView` ×3、`STClickableTextField` ×3、**`STRolloverButton` ×22（行尾 "•••" 按钮）**。
- 表格列（nib 设计值）：
  - 主列表：`col1` 宽 30（复选框）；`col2` 宽 16（状态图标）；`col3` `Filename` 宽 150；`col4` `Path` 宽 228；另有一列 `AutomaticTableColumnIdentifier.0` 宽 415。
  - 另一组列表：`col1` 宽 25 + `col2` 宽 474（单选列表/扁平列表变体）。
- 说明：运行时截图里路径以单列 `docs/adr/...` 展示，说明默认是 "Flat list (single column)" 模式；nib 仍保留 Filename/Path 两列定义。

### 3.5 DiffFileView.nib / DiffHunkView.nib / DiffView.nib（Diff）

- `DiffFileView`：控制器 `STDiffFileViewController`；`STDiffContainerBox`（NSBox 子类）、`STClickableImageView` ×2。
  - 视图模式弹出：`Side-by-side`，菜单项 Side-by-side / Before / After。
  - 文件头菜单：`Stage File` / `Discard File` / `Unstage File` / `Reverse File`（中文对应 暂存文件 / 放弃文件 / 取消暂存 / 反向）。
  - hunk 头占位文本：`Hunk 99    Lines 1-100 / 3-120 `（运行时为"块 N：行 A-B"）。
  - 其它状态文本：`Diff was suppressed because of file size or pattern.`、`No Preview Available`、`Preferences`、`Open`。
- `DiffHunkView`：控制器 `STDiffHunkViewController`；`STDiffTableView` ×2（内容/行号）、`STHorizontalOnlyScrollView`、`STNoScrollScrollView`。
  - hunk 右键菜单：Stage Hunk / Stage Selected Lines / Discard Hunk / Discard Selected Lines / Copy；另一套 Unstage Hunk / Unstage Selected Lines / Copy。
- `DiffView`：控制器 `STDiffViewController`；`STDiffContainerView`、`STVerticalOnlyScrollView`。
- **没有语法高亮器类**（无 SyntaxHighlighter / 配色资源）；运行时截图也证实为单色文本 + 行级红/绿着色（见 `sourcetree-ui.md` §6）。

### 3.6 LogView.nib（历史视图）

- 控制器 `STLogViewController`；`STLogTableView`、`STTableView`、`STFileStatusOutlineView`、`STGraphCell`（IBCustomCell，图列绘制）、`STLogDescriptionCell`、`STTextFieldCell` ×4、`STButtonCell`、`STDateFormatter`。
- 表格列（nib 设计值）：`graph` 88（header `Graph`）、`descriptionentry` 369（`Description`）、`rev` 53（`Revision`）、`changesetshort` 66（`Changeset`）、`user` 111（`Author`）、`date` 107（`Date`）、`build_status` 40（空 header）。
- 历史工具栏菜单：Flat list (single column) / Flat list (multiple columns) / Tree view；Sort by ▸ Path alphabetically / reversed / File name alphabetically / reversed / File status；Show whitespace / Ignore whitespace；Lines of context ▸ 1/3/6/12/25/50/100；Diff vs parent / Diff vs merged；External Diff。
- 提交右键菜单：Update To... / Push revision... / Merge... / Rebase... / Rebase interactively... / Tag... / Sign... / Bookmark... / Archive... / Branch... / Reset branch to here... / Reverse commit... / Create Patch... / Transplant / Continue cherry-pick / Abort cherry-pick / Copy / Copy SHA-1 to Clipboard / Custom Actions。
- 文件列表右键（选中提交）：Log Selected... / Annotate Selected... / Revert/Reset To Commit... / Open Current Version / Open Selected Version / Show In Finder / Copy Path To Clipboard / Quick Look / External Diff。
- 另有 `Jump To SHA` 小窗（556×113）。

### 3.7 RevisionFileListView.nib / CommitPaneView.nib

- `RevisionFileListView`：`STRevisionFileListViewController`；列 `status` 16 / `filename` 101 / `path` 325；菜单 Open Selected Version Files / Revert Files To Revision。
- `CommitPaneView`：`STCommitPaneViewController`；列 `status` 16 / `filename` 101 / `path` 249；`AdaptiveBlankWebView`（WKWebView 子类）用于空态。

### 3.8 MainMenu.nib

- 269 对象 / 163 连接，包含完整菜单栏（App/File/Edit/…/Repository/Actions/Window/Help）。运行时菜单栏为中文：`Apple, Sourcetree, 文件, 编辑, 格式化, 查看, 仓库, 动作, 窗口, 帮助`（AX 实测）。
- 用于补充快捷键与命令存在性；UI 布局不直接取自此 nib。

### 3.9 GitPushSheet / GitPullSheet

- GitPushSheet：推送目标/分支选择、force 等选项的 sheet；GitPullSheet：pull/rebase 选项。用于交互流第 6 步的弹窗结构（本次未截图）。

## 4. REA 解码的置信度与语义

- `provider.id = rea-artifact-graph`，`confidence = high`（工具自评），`authority = observed`（对 IB 归档字段而言）。
- 关系类型：`contains` 2,418 / `target_action` 2,016 / `outlet_to` 681；节点类型含 `constraint` 2,046、`control` 1,812、`view` 730、`action` 672、`outlet` 681、`resource` 575、`objc_selector` 564。
- **target/action 只证明 IB 归档里声明了连接，不证明二进制里存在同名实现**（REA 自身 limitation 原文）。
- nib 中的 `NSFrame` 是**设计时坐标**（如主窗口 1050×465、书签窗 480×600），与运行时 1935×1185 / 480×628 不同；像素几何以截图/AX 为准。

## 5. 已知限制

1. `graph.truncated = true`：即使 24 个文档、8,319 节点（上限 20,000）也未完全展开，说明解码器对部分文档/连接有内部截断；`coverage` 中 13 个 facet 为 `partial`，原因均为 `connection_unresolved`（部分 connector 无可解析 owner），例如 CommitAndFileStatusView 59 条连接中 5 条未解析、DiffFileView 54 中 7 条未解析。
2. 无原生反编译器引擎，无法验证 `ST*` 自定义类的实现、绘制逻辑、字体/配色常量。
3. 解码器只报告"已识别的 keyed-archive 字段"，未识别字段（私有绘图、动态创建的 UI）不可见。
4. 运行时本地化文本（中文）来自 AX/截图；nib 中为英文原文，二者已在上文对照。
5. Git Flow / Refresh / Reset / Tag 等 nib 工具栏项在当前运行时未显示，原因（版本差异/用户自定义/窄窗口溢出）未知。

## 6. 复现步骤

```bash
# 1) 生成探针 bundle（不改动 App）
rm -rf /tmp/STprobe2.app && mkdir -p /tmp/STprobe2.app/Contents/Resources/English.lproj /tmp/STprobe2.app/Contents/MacOS
cp /Applications/Sourcetree.app/Contents/Info.plist /tmp/STprobe2.app/Contents/Info.plist
cp /bin/ls /tmp/STprobe2.app/Contents/MacOS/Sourcetree && chmod +x /tmp/STprobe2.app/Contents/MacOS/Sourcetree
for n in GitRepoWindow CommitAndFileStatusView FileStatusView2 DiffFileView DiffHunkView DiffView \
         CommitPaneView RepoBrowserWindow MainMenu LogView RevisionFileListView SearchView \
         GitPushSheet GitPullSheet CommitSheet2 TaskWindow STToolbarTip; do
  cp -R "/Applications/Sourcetree.app/Contents/Resources/English.lproj/$n.nib" \
        /tmp/STprobe2.app/Contents/Resources/English.lproj/
done

# 2) 解码
rea decode-interface-builder /tmp/STprobe2.app --format json > research/ib-decode.json
```
