# DSH web-plugin architecture — verified against the installed build

Audience: the team rebuilding Sourcetree as a DSH web plugin. Everything here is
derived from the **installed** DeepSeek Harness desktop app, not from generic docs.

## 0. What was inspected, and how

| Source | Location | How read |
|---|---|---|
| Packaged app | `/Applications/DeepSeek Harness.app/Contents/Resources/app.asar` (182 MB, single archive) | extracted with `/tmp/asar_extract.js` / `/tmp/asar_get.js` into `/tmp/...` |
| Shipped client bundles (75 packages with `lib/client.js`) | `dsh/node_modules/@deepseek-ai/*/lib/client.js` **inside the asar** | extracted to `/tmp/allclients/<pkg>/client.js` |
| Slot owners | `@deepseek-ai/dsh-client-ui-layout`, `-sidebar`, `-conversation`, `-plugin-manager`, `-theme`, `-renderer` | same |
| Host services | `@deepseek-ai/dsh-client-connection`, `dsh-subprocess`, `dsh-host-webserver`, `dsh-client-modules`, `dsh-workspace-changes`, `dsh-client-ui-deliverables` (host half) | extracted to `/tmp/svc/...` |
| Bundled docs | `README.md` of the packages above (they ship with the app) | same |
| Reference implementation | `~/.dsh/local-plugins/dsh-workbench` (real local plugin with both halves + esbuild) | read in place |
| Authoritative skill docs | `/tmp/cpd/{SKILL.md,references/*,templates/decoration/*}` | read in place |
| Active profile | `~/.dsh/profiles/desktop/{package.json,cordis.patch.yml,cordis.yml}` | read in place |

Citations below use the **in-asar path** plus line number, e.g.
`dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js:118-119`.
Those files were extracted to `/tmp` to be read; line numbers match the shipped
artifacts. Local (non-asar) files are cited by their real path.

Build under test: the desktop profile `desktop`, whose client UI packages resolve
from the dsh installation (the profile's `node_modules/@deepseek-ai/` is empty —
verified with `ls`). Installed plugin inventory: 307 `@deepseek-ai/*` packages.

---

## 1. Manifest: the exact `package.json` for a large, persistent panel

### 1.1 What the loader actually validates

The client-module host half parses `dsh.client` with this validator — condensed here, the `...` stand for the shipped
diagnostics
(`dsh/node_modules/@deepseek-ai/dsh-client-modules/lib/index.js:60-76`):

```js
function parseDshClient(pkgName, value) {
  if (value === void 0) return void 0;
  if (typeof value !== "object" || value === null) throw ...
  const decl = value;
  if (typeof decl.platform !== "string") throw ...   // required
  const inject   = optionalStringArray(pkgName, "dsh.client.inject", decl.inject);
  const external = optionalStringArray(pkgName, "dsh.client.external", decl.external);
  if (decl.immediately !== void 0 && typeof decl.immediately !== "boolean") throw ...
  return { platform, ...inject, ...external, ...immediately };
}
```

A row only becomes a browser module when `decl.platform === 'web'`
(`.../dsh-client-modules/lib/index.js:733`) **and** the package exports a
`./client` bundle (`.../lib/index.js:738` — missing `./client` is a hard error:
`declares dsh.client but exports no "./client" bundle`).

The package README states the contract in one sentence:

> "A browser plugin package declares `dsh.client` in its `package.json` with
> `platform: 'web'`, exports a `./client` bundle, and lists any non-baseline
> module requests under `dsh.client.external`."
> — `dsh/node_modules/@deepseek-ai/dsh-client-modules/README.md:34`

Field semantics, verified in code:

| Field | Meaning | Evidence |
|---|---|---|
| `dsh.bundle.patch` | YAML patch layer the Loader applies; inserts the plugin rows | `references/host-plugin.md:11-27`; `templates/decoration/package.json` |
| `dsh.client.platform` | must be `"web"` for a browser half | `dsh-client-modules/lib/index.js:733` |
| `dsh.client.inject` | client **package ids** whose bundles must arrive/active before yours (module-arrival ordering + retention). Not a `require`. | `.../lib/client.js:789-793` (`for (const packageName of row.inject) … arriveDependency`), `prune()` at `:946` |
| `dsh.client.external` | exact non-baseline module specifiers your factory `require`s; each answered by a dynamic package row or an exact static-table key. Malformed/missing supplier is a composition error. | `dsh-client-modules/README.md:60`; `orderByModuleGraph` at `.../lib/index.js:424-447` |
| `dsh.client.immediately` | boot-tier prefetch: the shell prefetches that bundle during boot instead of waiting for first use | shell bundle `dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-CN7NIWNw.js` contains `prefetchImmediateTier(){await Promise.all(this.manifest.plugins.filter(e=>e.immediately).map(e=>this.modules.prefetch(e.id).catch(t=>{})))}`; graph row flag at `dsh-client-modules/lib/index.js:408` |
| `exports["./client"]` | the browser artifact, served under `/plugins/<name>/client.js` | `dsh-client-modules/lib/index.js:738`; README §"Declaring a client plugin" |
| `exports["."]` | the host half entry (`index.js`), resolved for the Loader row | `references/host-plugin.md:9-27` |
| `files` | packed-file allowlist. **A linked/local directory is not filtered by it**, so keep it accurate anyway. | `references/host-plugin.md:35` |
| `exports["./locale/*.json"]`, `exports["./icon"]` (or a top-level `icon`) | Plugin Manager / Settings display metadata, read without activating the plugin | `references/host-plugin.md:31-51` |

### 1.2 The working manifest shape for our panel

`dsh-workbench` is a shipped-quality local plugin with both halves and its own
esbuild build; its manifest (`~/.dsh/local-plugins/dsh-workbench/package.json:1-49`):

```json
{
  "name": "dsh-workbench",
  "type": "module",
  "main": "index.js",
  "exports": {
    ".": "./index.js",
    "./client": "./lib/client.js",
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  },
  "files": ["index.js", "lib/client.js", "src/host", "src/client", "cordis.patch.yml"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-ui-renderer",
        "@deepseek-ai/dsh-client-ui-session",
        "@deepseek-ai/dsh-client-ui-workspace",
        "@deepseek-ai/dsh-client-ui-conversation",
        "@deepseek-ai/dsh-client-ui-sidebar"
      ]
    }
  }
}
```

### 1.3 Which `inject` packages a panel outside the composer needs

For a panel rendered into the **layout root** (`main` keyed slot) plus a
**sidebar entry** (`sidebar.panellist`), the owning packages are:

```json
"dsh": { "client": { "platform": "web", "immediately": true,
  "inject": [
    "@deepseek-ai/dsh-client-ui-renderer",   // slot renderer + ctx.uiRenderer mount
    "@deepseek-ai/dsh-client-ui-layout",     // declares `main` (keyed, root) + ctx.layout
    "@deepseek-ai/dsh-client-ui-sidebar"     // declares `sidebar.panellist` (list, root)
  ] } }
```

- `dsh-client-ui-renderer` is the package that installs `createSlotRenderer()` and
  renders `renderSlot('root')` — the whole React tree depends on it
  (`dsh/node_modules/@deepseek-ai/dsh-client-ui-renderer/README.md:36-44`).
- `dsh-client-ui-layout` declares `main` and provides `ctx.layout` — see §2.
- `dsh-client-ui-sidebar` declares `sidebar.panellist` and calls
  `ctx.layout.selectPanel(id)` when a row is clicked
  (`dsh-client-ui-sidebar/lib/client.js:503`, `:480`).
- Add `@deepseek-ai/dsh-client-ui-session` only if you consume session hooks;
  a root-scope Git panel does not need it.
- `immediately: true` is optional; it only prefetches at boot. A panel that the
  user opens deliberately can stay lazy (`immediately` absent). Workbench omits it.

Note the difference between the **two** `inject`s:

1. `dsh.client.inject` (manifest) = client packages to load before your bundle.
2. `export const inject = ['slots', 'layout', …]` **inside** the client module =
   Cordis service dependencies for the browser plugin fiber (`apply` is deferred
   until they exist). Workbench uses `export const inject = ['slots', 'sessions']`
   (`~/.dsh/local-plugins/dsh-workbench/src/client/index.ts:56`).

### 1.4 What you may `require` (baseline module table)

The shell seeds a frozen table; only these specifiers resolve without a graph
dependency (`dsh-web-frontend/dist/assets/index-CN7NIWNw.js`, `SZ()`):

```js
{ react, "react/jsx-runtime", "react-dom", "react-dom/client",
  "@deepseek-ai/cordis", zod, "@tanstack/react-virtual",
  "@deepseek-ai/dsh-client-store", "@deepseek-ai/dsh-client-ui-slots",
  "@deepseek-ai/dsh-client-ui-primitives", "@deepseek-ai/dsh-client-ui-dockkit" }
```

So `require('react')` and `require('react/jsx-runtime')` always work. For our
skeleton we use **only React** — no primitives, because the practices reference
warns that requiring other Harness client packages is discouraged and a throwing
component blanks the slot entry (`references/practices.md:35`).

---

## 2. Slots: the real inventory, and the right seat for a Git workspace

### 2.1 Method

Slot declarations are not data files; each owner package declares its children in
its `ctx.slots.register({ name, children }, Component)` call. A scan of all 75
shipped `lib/client.js` bundles for `children: { "<id>": { kind, scope } }`
produced **82 declared slot ids**. (Script: extract each
`dsh/node_modules/@deepseek-ai/*/lib/client.js`, regex the declaration blocks.)

### 2.2 The candidates that matter

| Slot id | Kind / scope | Declared by (file:line) | Props passed | Space? | Full-height multi-pane? |
|---|---|---|---|---|---|
| **`main`** | `keyed` / `root` | `dsh-client-ui-layout/lib/client.js:631-634` (declaration), rendered at `:118-119` | `renderSlot("main", {}, { entryKey: activePanelId ?? "conversation" })` → entry gets standard framework props (`t`, `renderSlot`, `renderFactorySlot`, `usePanelInfo`, owner-injected props) | **Yes** — occupies the centre column of the 3-column frame | **Yes** |
| **`sidebar.panellist`** | `list` / `root` | `dsh-client-ui-sidebar/lib/client.js:503-506`, rendered at `:190-193` | `{ size: wide?16:18, active }`, rendered `{ only: id }` | icon-sized row only | No — it is the launcher for a `main` panel |
| `sidebar` | `single` / `root` | `dsh-client-ui-layout/lib/client.js:627-630` | sidebar shell props (`collapsed`, `width`, panels, shortcut hooks…) | replaces whole left column | Yes, but it *replaces the host sidebar* — invasive |
| `shell.bottom` | `single` / `root` | `dsh-client-ui-layout/lib/client.js:640-643` | standard props; occupant controls its own height | full width, below columns | only a strip; wrong for a workspace |
| `rightbar` | `single` / `root` | `dsh-client-ui-layout/lib/client.js:635-638` | width/viewport/canShow contract | right column, ≤70% viewport | Yes, but owned by the right sidebar; not a workspace |
| `conversation.composer.dock` | `list` / `session` | `dsh-client-ui-conversation/lib/client.js` | composer dock props | decoration-sized | No |
| `main.conversation` | `single` / `session-maybe` | `dsh-client-ui-conversation/lib/client.js:20024-20031` (registration) | `sessionId`, `useSession(s)`, `useSessions`, `useConversation`, `renderSlot`, `renderFactorySlot` | full centre column | Yes, but it is the Conversation itself |

Why `main` is the right seat — the layout package's own README states the model:

> "Global panels occupy the root-scoped `main` keyed slot; `conversation` is the
> reserved key for the Conversation. `ctx.layout.selectPanel(id)` selects a
> registered panel, and `null` selects the Conversation… The Plugins page
> contributes one of the shipped global panels."
> — `dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/README.md:32`

and the sidebar README pairs the two seats explicitly:

> "Plugins add an icon component to the root-scoped `sidebar.panellist` list with
> an `id`, optional `order`, and a string or locale-aware `label`. The same id
> addresses the component registered in the layout's root-scoped `main` keyed
> slot; selecting a missing main entry throws without changing the current
> selection."
> — `dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar/README.md:38`

### 2.3 Space allocation is real

`AppFrame` is a CSS grid `grid-template-rows: minmax(0,1fr) auto; height:100%`,
and the centre column is `flex-direction:column; min-width:0; overflow:hidden`
(`dsh-client-ui-layout/lib/client.js`, `AppFrame.module.css` payload at the
`_6Qf49G_frame`/`_6Qf49G_centerCol` rules). `MainPanel` renders the selected key
into that column, so a `main` panel gets the full centre column height and can
run its own `display:flex; height:100%; min-height:0` multi-pane layout — exactly
what the shipped Plugin Manager page does (`dsh-client-ui-plugin-manager`, whose
`main` registration is at `lib/client.js:4418-4446`).

One detail for macOS: entry pages in `main` (not the Conversation) pad their top
by the window-chrome strip. The shipped Plugin Manager CSS does:

```css
html[data-platform='darwin'] .pageHead { padding-top: calc(28px + var(--dsh-frame-top-clearance,0px)) }
```
(`dsh-client-ui-plugin-manager/lib/client.js`, `_pageHead` rule)

### 2.4 How selection works

The sidebar row button calls `selectPanel(id)` → `ctx.layout.selectPanel(id)`
(`dsh-client-ui-sidebar/lib/client.js:185`, `:480`). `ctx.layout` is provided by
the layout package (`dsh-client-ui-layout/lib/client.js:622`,
`ctx.reflect.provide("layout", layout)`), and `selectPanel` checks the live
`main` registry before switching (`layout/README.md:57`). The frame also keeps
keyed panels retained (`retainMainPanels` from `ctx.slots.entries("main")`,
`layout/client.js:614-615`), so a registered panel survives navigation.

**Chosen design: register `sidebar.panellist` id `git-tree` + `main` key
`git-tree`; clicking the sidebar icon selects the full-height Git workspace.**

### 2.5 Full declared-slot inventory of this build (82 ids)

Grouped by declaring package (all under
`dsh/node_modules/@deepseek-ai/<pkg>/lib/client.js`):

- **dsh-client-ui-layout**: `main`, `sidebar`, `rightbar`, `shell.bottom`,
  `shell.overlay`, `shell.leading` (plus the rendered root `root`)
- **dsh-client-ui-sidebar**: `sidebar.brand.mark`, `sidebar.brand.name`,
  `sidebar.toggle.badge`, `sidebar.panellist`, `sidebar.workspaces`,
  `sidebar.settings`, `sidebar.footer.action`
- **dsh-client-ui-conversation**: `conversation.composer` (chain),
  `conversation.composer.bar`, `conversation.composer.dock` (list),
  `conversation.header`, `conversation.header.leading`, `conversation.hero.*`
  (`agentPreset`, `brand.mark`, `options`, `workspace`),
  `conversation.input.{activity,attachments,dock,left,model,model.label,overlay,permission,plan,right}`,
  `conversation.session`,
  `conversation.session.header{,.actions,.corner,.lineage,.utilities}`,
  `conversation.view` (list), `main.conversation`
- **dsh-client-ui-chat**: `conversation.chat.assistant-actions` (list),
  `conversation.chat.flow`, `.message.images`, `.reasoning.body`, `.turnTail`
  (list), `.user.images`, `shell.quota-notice` (chain)
- **dsh-client-ui-approval / -deliverables / -trajectory / -tool**:
  `conversation.approval.detail`, `deliverables.file.actions`,
  `deliverables.review.file.actions`, `conversation.trajectory.images`,
  `tool.call.images`
- **dsh-client-ui-workspace**: `conversation.hero.workspace.directoryFlow`,
  `sidebar.session.row.hover`, `sidebar.session.row.leading`,
  `sidebar.workspaces.directoryFlow`, `sidebar.workspaces.session.menu.item`,
  `sidebar.workspaces.session.row.action`
- **dsh-client-ui-sidebar-right / -files / -documentpreview**:
  `rightbar.session`, `sidebar.right.tab.guide` (chain),
  `sidebar.right.tab.menu.item`, `sidebar.right.tab.files.actions`,
  `sidebar.right.tab.document.actions`, `sidebar.right.tab.document.unpreviewable`
- **dsh-client-ui-settings***: `settings.{action,close,general.item,header,
  launcher,onboarding,section,trigger}`, `settings.models.footer`,
  `settings.models.sign-in`, `settings.plugins.tab`
- **dsh-client-ui-plugin-manager**: `plugins.{add.actions,detail.actions,
  detail.badge,detail.section,item,tab}`
- **dsh-client-ui-model-selection / -user-questions / -subagent**:
  `conversation.input.model.label`, `conversation.plan-review.actions`,
  `sidebar.chat.conversation`

This list is *static evidence* from the shipped artifacts; see "Unknowns".

---

## 3. Host ↔ client channel

### 3.1 The mechanism a plugin should use: authenticated exact Fetch routes

The browser half and the host half live in different processes/realms. For a
third-party plugin the supported bridge is an **exact Fetch route registered on
the host's Connection service**, called with a plain same-origin `fetch()`.
This is what DSH's own "deliverables" feature does — its client-UI package ships
a Node host half (`lib/index.js`) purely to register `/api/...` routes:

`dsh/node_modules/@deepseek-ai/dsh-client-ui-deliverables/lib/index.js:49-90`:

```js
ctx.connection.fetch.register({
  path: "/api/changes.summary",
  methods: ["GET"],
  requestBody: "buffered",
  fetch: (request) => Promise.resolve(handleChangesSummary(ctx, request)),
});
// …and a second route with methods ["GET","POST"], requestBody "buffered",
// fetch returning a `Response` (Response.json(...) or new Response(text, {status}))
```

Registry implementation and dispatch:
`dsh/node_modules/@deepseek-ai/dsh-client-connection/lib/index.js:733-735`
(`get fetch() { return { register: route => this.registerFetchRoute(owner, route) } }`),
`:840-856` (`registerFetchRoute`), `:822-838` (dispatch: exact path → method
check → `peer.principal.kind !== "owner"` → 403 → `route.fetch(request)`).
The fence is the browser-trust layer: authenticated cookie/peer, Host/Origin
checks, 401/403 before dispatch (`README.md` §"Browser authentication and request
trust").

The browser side is just relative-URL `fetch`. Shipped example:
`dsh-client-ui-deliverables/lib/client.js` defines
`CHANGED_FILES_PATH = "/api/changes.summary"` and fetches the document-relative
form (`CHANGED_FILES_PATH.slice(1)`), e.g.
`fetch(PRESENT_HOST_ROUTE, { signal })` with `response.ok` + `response.json()`.

Minimal two-sided example:

```js
// host half (index.js)
export const name = 'my-plugin'
export const inject = ['connection']

export function apply(ctx) {
  ctx.connection.fetch.register({
    path: '/api/my-plugin/ping',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: () => Promise.resolve(Response.json({ ok: true, pong: Date.now() })),
  })
}
```

```js
// client half (inside the module-loader factory)
async function ping() {
  const res = await fetch('api/my-plugin/ping', { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}
```

Why not the alternatives:

- **`ctx.remote.*`** — the typed RPC namespace is a *build-time fixed assembly*:
  "The capability set is fixed by explicit build-time value imports; the Client
  does not discover the Host's active Services or Remote definitions at runtime.
  Additional capabilities require an explicit `/remote` value import and mount in
  this assembly." (`dsh-api-remotes/README.md`, "Known Limitations"). A
  third-party plugin cannot add a namespace. Existing namespaces a Git plugin may
  *use* (not add) include `workspaceFiles`, `commands`, `session`, `settings`,
  `workspace` (see §4).
- **`ctx.webServer.register`** — works and is what `dsh-workbench` does
  (`~/.dsh/local-plugins/dsh-workbench/src/host/index.ts:1224-1252`:
  `ctx.effect(() => ctx.webServer.register({ kind: 'exact', path, handler }))`
  and every route manually calls `connection.requestRejection(req)` first). It
  bypasses the `/api` bridge and the appliance-level route tables; the
  Connection-registered `/api/...` route is the shipped-feature path and gets the
  auth fence for free. Use it only if you truly need raw `node:http`
  request/response control.
- **Session commands** (`ctx.commands.register` host-side,
  `ctx.remote.commands.execute` client-side) — the "one operation, two callers"
  pattern from `references/user-actions.md:6-11`; good for *user-initiated agent
  operations* (e.g. "commit with AI message"), not for high-frequency reads. See
  `dsh/node_modules/@deepseek-ai/dsh-commands/README.md:34-50`.
- **Host → client push** — a plugin cannot register a forwarded event; the
  allowlist is fixed (`dsh-api-remotes/README.md` §"Forwarded Host events").
  Poll or refetch after mutations.

### 3.2 Module-loader shape of the browser artifact (must be exact)

The client artifact is not an ES module. It calls the loader facade:

```js
window.__ModuleLoader__.load({
  id: "dsh-git-tree",                    // must equal the package name
  factory: (require) => {                // require = the frozen module table
    var module = { exports: {} }; var exports = module.exports;
    /* esbuild CJS body; require('react') resolves from the table */
    return module.exports;
  },
});
```

Evidence: every shipped `lib/client.js` starts with this call
(`dsh-client-ui-layout/lib/client.js:1-7`), and workbench's build wraps its
esbuild CJS output exactly this way
(`~/.dsh/local-plugins/dsh-workbench/build.mjs:56-76`). The factory must
be side-effect free until materialization; the module's `apply(ctx)` then runs as
the browser Cordis plugin (`references/ui-plugin.md:7-13`).

---

## 4. Host capabilities: running `git` safely, and what already exists

### 4.1 There is no Git service to reuse

A scan of the 307 installed `@deepseek-ai/*` packages finds **no git package or
git service**. The closest shipped capability is:

- `@deepseek-ai/dsh-workspace-changes` — a host plugin that snapshots the git
  working tree per turn and serves per-turn changed-file summaries/diffs through
  **Session-scoped** state (`ctx.workspaceChanges.summary/diff`). It is built for
  the conversation "changed files" card, not a repo workspace panel, and it does
  not expose branches/history/remotes. It is nonetheless the authoritative source
  for *how DSH invokes git* (`dsh-workspace-changes/README.md:60`).

The Git operations (status/diff/log/branch/commit) must be implemented by our
plugin's host half. That is expected: DSH treats external CLIs as plugin domain
code — workbench does exactly this for `glab`/`gh`/`aliyun`.

### 4.2 How to run git: `ctx.subprocess` (no shell, scrubbed env)

The service contract (`dsh/node_modules/@deepseek-ai/dsh-subprocess/README.md:24-52`):

```text
const executable = await ctx.subprocess.resolveExecutable('bash')
const handle = ctx.subprocess.spawn({
  argv: [executable, '-c', 'echo hello'],
  cwd: '/workspace',
  stdio: { stdin: 'ignore', stdout: { maxBytes: 64 * 1024 }, stderr: 'inherit' },
  graceMs: 5000,
})
const { exitCode, signal } = await handle.done
const output = handle.collected.stdout?.readFrom(0)
```

Key properties (same README): argv is fully explicit, **no shell interpretation**;
child env has credential-shaped names and ambient `DSH_*` scrubbed, then explicit
`env` overrides merge; output collection is bounded and offset-based; `terminate()`
manages the whole process range.

The shipped git invocation pattern (`dsh-workspace-changes/README.md:60`):

> "Git runs through the `subprocess` capability with a scrubbed environment,
> `GIT_CONFIG_COUNT=0` … `GIT_TERMINAL_PROMPT=0`, `GIT_OPTIONAL_LOCKS=0`, the
> configured timeout, and bounded output."

macOS caveat from the same README: on macOS a machine with only the
developer-tools stub at `/usr/bin/git` cannot locate a repository — i.e. resolve
and probe the real git, never assume `/usr/bin/git`.

Working directory and sandbox: a plugin reads the workspace root from host
services, not from cwd. Workbench's runner falls back through
`sandboxPolicy.workspaceRoot` → `fs.resolve('.')/processPath` → `process.cwd()`
(`~/.dsh/local-plugins/dsh-workbench/src/host/index.ts:164-179`), and it
launches with `cwd: opts.cwd || getWorkspaceRoot()`
(`.../src/host/index.ts:199-203`). Explicitly reject a requested cwd outside that
root.

### 4.3 What already exists that the client can call (read-only)

`ctx.remote` (shipped namespaces, verified by scanning all client bundles for
`ctx.remote.<ns>.<method>`):

| Namespace | Example methods | Use for a Git panel |
|---|---|---|
| `workspaceFiles` | `read`, `readBytes`, `stat`, `list`, `changes` (watch stream) | read working files / watch changes; **no mutation** |
| `commands` | `execute` | run a registered session command (agent-shared operation) |
| `session` | `modelCatalog`, `rename`, … | session identity/metadata |
| `workspace` | `follow`, … | workspace lists/navigation |
| `settings` | `describe`, `mutate`, `update` | plugin/global settings |

Evidence: `dsh/node_modules/@deepseek-ai/dsh-api-workspace-files/README.md:22-34`
(method table; "Every method takes the Session identity on the wire… The service
exposes no mutation operation."). The set is fixed at build time (see §3.1).

Host-side services a plugin can `inject`/`ctx.get()` (all confirmed in shipped
host code): `connection`, `webServer`, `subprocess`, `fs`, `sandboxPolicy`,
`workspaceRegistry`, `sessionController`, `commands`, `workspaceChanges`.

### 4.4 Skeleton runner (implemented in `plugin/index.js`)

```js
export const inject = ['connection', 'subprocess']

async function execGit(ctx, argv, cwd, { timeoutMs = 10_000, maxBytes = 4 << 20, signal } = {}) {
  const subprocess = ctx.get('subprocess')
  if (!subprocess) throw new Error('subprocess service unavailable')
  const exe = await subprocess.resolveExecutable('git')   // throws if not installed
  const handle = subprocess.spawn({
    argv: [exe, ...argv],
    cwd,
    stdio: { stdin: 'ignore', stdout: { maxBytes }, stderr: { maxBytes: 256 * 1024 } },
    graceMs: timeoutMs,
    env: {
      GIT_TERMINAL_PROMPT: '0',   // never block on credentials
      GIT_OPTIONAL_LOCKS: '0',    // never take optional locks in the user's repo
      GIT_CONFIG_COUNT: '0',      // ignore ambient indexed config
      GIT_PAGER: 'cat', LC_ALL: 'C',
    },
  })
  const { exitCode } = await handle.done
  const out = handle.collected?.stdout?.readFrom(0)?.text ?? ''
  const err = handle.collected?.stderr?.readFrom(0)?.text ?? ''
  return { exitCode, out, err }
}
```

Safety rules the skeleton enforces: argv arrays only; `--` before user paths;
reject `..`, absolute paths, leading `-` and NUL in user-supplied paths; cwd
resolved and checked against the workspace root; bounded output + timeout;
no writes, no `git config` mutation, no credential prompts.

---

## 5. Theming: tokens the client actually has

Theme state is owned by `dsh-client-ui-theme`; `dsh-client-ui-layout`'s presenter
projects it onto the document (`body[data-ds-dark-theme]`, alias tokens, font-size
and font-family variables, `<meta name="theme-color">`) —
`dsh-client-ui-theme/README.md:26-30`, `dsh-client-ui-layout/README.md:38-42`.
A plugin renders in the same document, so it simply reads the CSS variables. The
theme package README says exactly that: "Feature plugins consume the current
snapshot through `ctx.theme` and read the `--dsw-*` tokens in CSS; they do not
manage theme state themselves." (`theme/README.md:28`)

### 5.1 Tokens the inspector documents

`BUILTIN_INSPECT_TOKENS` in
`dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js:1531-1630`
(this is what `cordis_inspect_query` `Theme` returns): each entry has
`name`, `description`, `valueType`, `requiresLightAndDark`:

| Token | Description (verbatim) | line |
|---|---|---|
| `--dsw-alias-bg-base` | Application base background. | 1533 |
| `--dsw-alias-bg-layer-1` | Primary raised surface background. | 1540 |
| `--dsw-alias-bg-layer-2` | Secondary nested surface background. | 1547 |
| `--dsw-alias-bg-overlay` | Overlay and popover background. | 1554 |
| `--dsw-alias-border-l1` | Primary subtle border. | 1561 |
| `--dsw-alias-border-l2` | Secondary stronger border. | 1568 |
| `--dsw-alias-brand-primary` | Primary brand accent. | 1575 |
| `--dsw-alias-label-primary` | Primary text color. | 1582 |
| `--dsw-alias-label-secondary` | Secondary text color. | 1589 |
| `--dsw-alias-state-error-primary` | Primary error state color. | 1596 |
| `--dsw-alias-state-idle-primary` | Primary inactive state color. | 1603 |
| `--dsw-alias-state-success-primary` | Primary success state color. | 1610 |
| `--dsw-alias-state-warn-primary` | Primary warning state color. | 1617 |
| `--dsw-specific-sidebar-fill` | Sidebar column and title-row background. | 1624 |

### 5.2 Full alias inventory (defined per light/dark in one stylesheet string)

`theme/lib/client.js:1413` (`design_platform_css_default`) defines ~107
`--dsw-alias-*` and ~90 `--dsw-static-*` tokens for `body` (light) and again under
`body[data-ds-dark-theme]` (dark). Names useful for a Git workspace UI:

- Surfaces: `--dsw-alias-bg-base`, `-bg-layer-1/2/3/4`, `-bg-overlay`,
  `-bg-mask-1/2/3`, `-bg-module-platform`, `-bg-multi-select`, `-bg-skeleton`,
  `--dsw-specific-sidebar-fill`, `--dsw-specific-input-major`,
  `--dsw-specific-selector`, `--dsw-specific-tip`
- Borders: `--dsw-alias-border-l1/l2/l3/l4`, `-border-l2-darkmode-thin`,
  `-border-inverted`, `-border-inverted2`
- Text: `--dsw-alias-label-primary`, `-label-secondary`,
  `-label-tertiary`, `-label-caption`, `-label-dimmed`, `-label-primary-foreground`,
  `-label-primary-inverted`, `-label-dimmed`, `-link`
- Interaction: `--dsw-alias-interactive-bg-hover`, `-bg-hover-solid`,
  `-bg-hover-accent`, `-bg-active`, `-bg-hover-danger`;
  `--dsw-alias-button-{primary,ghost,tool-bar,floating,elevated}-*`
- State: `--dsw-alias-state-{success,error,warn,idle,business}-*`,
  `--dsw-alias-code-diff-added`, `-code-diff-deleted`
- Diff (directly relevant!): `--dsw-alias-file-diff-added-bg`,
  `-file-diff-added-gutter`, `-file-diff-added-marker`,
  `--dsw-alias-file-diff-deleted-bg`, `-file-diff-deleted-gutter`,
  `-file-diff-deleted-marker` (light values: `#e6f4e7 / #edf7ed / #01a241` and
  `#fce6e2 / #fdece9 / #ba2723`; dark values differ)
- Menus/scrollbars: `--dsw-alias-menu-*`, `--dsw-alias-scrollbar-*`,
  `--dsw-specific-menu`, `--dsw-menu-surface-fill`

### 5.3 Radii, fonts, spacing

Radii (`theme/lib/client.js:1407`, `base_css_default`):

```css
--dsw-radius-xs:4px; --dsw-radius-sm:8px; --dsw-radius-md:12px;
--dsw-radius-lg:16px; --dsw-radius-xl:20px; --dsw-radius-panel:28px;
```

Fonts (same line): `--dsh-font-family-text-default`, `--dsh-font-family-code-default`,
`--dsw-font-family`, `--ds-font-family-code` (plus per-role `--dsh-font-family-text`,
`-code`, `-terminal` set by the presenter). Font-size scale tokens:
`--dsw-font-{xxxs-11, xxs-12, xs-13, s-14, base-16, m-18, l-20, xl-24}` each with
`-font-size` / `-line-height` / `-font-weight` / `-font-style` / `-font-family`
members (extracted from `theme/lib/client.js`). User-scaled text reads
`--dsh-content-font-size` (10–22px, default 14) and `--dsh-code-font-size`
(10–16px, default 11) (`theme/README.md:17-19`).

**Spacing tokens do not exist** (checked: no `--dsw-space-*`, `--dsh-space-*`, or
`--dsw-spacing-*`). Spacing is literal px; the guidance is to copy the host's
row patterns (`references/practices.md:34`).

Frame tokens a full-height panel should respect (published on the root element,
`dsh-client-ui-layout/README.md:44-54`): `--dsh-frame-top-clearance` (48px on
macOS), `--dsh-frame-leading-clearance`, `--dsh-frame-overlay-top`,
`--dsh-frame-chrome-top`, plus `--dsw-focus-ring-color/-width`,
`--dsw-elevation-*`, `--ds-transition-duration*`, `--ds-ease-in-out`.

Rules of thumb (from `references/practices.md:34`): colors must come from tokens
(literal colors only for artwork); a renamed token degrades appearance but never
breaks rendering.

---

## 6. Lifecycle, cleanup, config

### 6.1 Host half

Two accepted export forms (`references/host-plugin.md:57-64`):

```js
export const name = 'dsh-git-tree'          // optional but conventional
export const inject = ['connection', 'subprocess']
export function apply(ctx, config) { /* register resources, return nothing */ }
```

or a default-exported service class. Do not mix. Every resource is registered
inside `apply` with `ctx.effect(..., label)` / `ctx.on(...)` and the effect
returns its cleanup (`host-plugin.md:64`). Shipped example:
`dsh-client-ui-deliverables/lib/index.js:252-268` — `const inject = [...]`,
`function apply(ctx) { registerPresentOpen(ctx); ctx.systemPrompt.section(...) }`.

Cleanup ownership: `ctx.connection.fetch.register` internally wraps
`owner.effect(...)` (`dsh-client-connection/lib/index.js:843-853`), so unloading
the plugin row removes its routes; for timers/subprocesses register
`ctx.effect(() => { …; return () => clearInterval(t) })`.

### 6.2 Config

A host plugin can declare a config schema by exporting a
[schemastery](https://github.com/shigma/schemastery) `Config`; the Loader
validates the row's `config` object against it at activation
(`host-plugin.md:64`, and `SKILL.md:30` — `Config.listConfigs` returns the schema).
Workbench does this: `export const Config = s.object({ … })` with defaults
(`~/.dsh/local-plugins/dsh-workbench/src/host/config.ts:49-73`), and its
patch row is just `- id: dsh-workbench / name: dsh-workbench` with no config
(`.../cordis.patch.yml:15-16`). A row can override config in any later patch
layer — the user's profile patch survives upgrades
(`references/practices.md:22`).

The **client half has no config channel**: the module loader passes none. Read
host config through your own `/api/...` route (that is how workbench's client
reads feature toggles/host settings).

### 6.3 Bundle patch row — how the plugin is enabled

```yaml
# cordis.patch.yml, applied as a profile layer
- insert:
    - id: dsh-git-tree
      name: dsh-git-tree          # package specifier resolved for the Loader row
      # config: {}                # optional; validated by the exported Config
      # disabled: true            # a later layer can disable without removing
```

Shape evidence: `dsh-workbench/cordis.patch.yml:15-16`; the shipped composition
patch `dsh/node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml` (row shape
`- insert: [ { id, name, config, disabled } ]`, e.g. lines 60-84), and
`references/host-plugin.md:20-27`.

Because one package carries both halves, **one row enables both**: the row mounts
`index.js`; `dsh-client-modules` scans enabled Loader entries, finds the package's
`dsh.client` declaration, serves `./client` under `/plugins`, and injects the boot
graph (`dsh-client-modules/README.md:10-18`, `:31-36`). Disabling the row removes
the entry and the browser module (with owned styles) is evicted
(`dsh-client-modules/README.md:44-46`). If the package is installed via
`plugin_manager` `install_bundle`, bundle selection is also written into the
profile's `dsh.profile.bundles` (`SKILL.md:8-10`).

### 6.4 Client half lifecycle

- Executing the bundle only *registers a factory*; module side effects (CSS
  injection included) run at materialization, inside the factory
  (`dsh-client-modules/README.md:80-86`, `references/ui-plugin.md:11`).
- The module exports `apply(ctx)` / `inject`; it runs as the browser plugin.
- Register resources with `ctx.effect` / `ctx.on`, return cleanups; component-scoped
  styles can be rendered as React elements (`ui-plugin.md:11`).
- `ctx.slots.inject(ownerKey, () => ctx.slots.register(...))` defers until the
  owner slot is declared and disposes when it collapses
  (`references/practices.md:36`).
- A substitution or HMR reload replaces the module and re-runs `apply`; owned
  styles are removed by the loader (`dsh-client-modules/README.md:44-46`).
- Do not append to `document.body`, replace the app root, or import other client
  packages (`ui-plugin.md:13`, `practices.md:35`).

---

## 7. The skeleton in `plugin/`

Layout of the deliverable (package name `dsh-git-tree`):

```
plugin/
  package.json          manifest: bundle patch + dsh.client (platform/immediately/inject)
  cordis.patch.yml      - insert: [{ id: dsh-git-tree, name: dsh-git-tree }]
  index.js              HOST half (plain ESM): /api/git-tree/status + /api/git-tree/diff over ctx.subprocess
  src/client/index.tsx  CLIENT half source: sidebar.panellist icon + main keyed panel (split view)
  build.mjs             esbuild (react external, classic JSX) + __ModuleLoader__ wrapper
  lib/client.js         build output (committed artifact)
  locale/{en,zh}.json   Plugin Manager display metadata (meta.title/description)
  icon.svg              plugin icon (original)
  README.md             usage, slot choice, build/run notes, unknowns
```

Design: `sidebar.panellist` id `git-tree` (branch glyph) selects `main` key
`git-tree`, whose panel is a three-pane workspace — refs rail / changed-file list
/ diff preview — styled only with theme tokens. The client fetches
`api/git-tree/status` on mount and `api/git-tree/diff?path=…` on selection; if the
host half is absent it renders the same layout with an explicit "host half not
active" banner instead of crashing.

Build:

```bash
cd plugin && node build.mjs
```

`build.mjs` resolves esbuild from the skeleton's own `node_modules` first, then
from the installed reference plugin (`~/.dsh/local-plugins/dsh-workbench/node_modules`),
and prints the exact remedy (`npm i -D esbuild`) if neither exists.

### 7.1 Verification performed (no installation)

```text
$ node build.mjs
[dsh-git-tree] using esbuild from ~/.dsh/local-plugins/dsh-workbench/node_modules/esbuild/lib/main.js
  lib/_client.bundle.cjs  17.5kb
[dsh-git-tree] wrote lib/client.js (18197 bytes)          # exit 0

$ node --check lib/client.js && node --check index.js      # both parse
$ node -e "JSON.parse(...)" package.json locale/en.json locale/zh.json   # all valid
```

Artifact checks (mock Harness in Node, real `react@18.3.1` from the workbench
install): one factory registration with id `dsh-git-tree`; the only `require`
is `"react"`; `inject === ["slots"]`; `apply` registers
`sidebar.panellist{id:'git-tree'}` and `main{key:'git-tree'}`; the stylesheet
effect appends one owned `<style>` (5.5 KB, **23** `var(--…)` references,
**0** literal colors) and its cleanup removes it; the launcher icon renders an
`<svg>` honouring `size`.

Theme-token cross-check: all 23 referenced variables exist in this build's token
universe (`dsh-client-ui-theme/lib/client.js:1407-1413` plus the layout and shell
sheets).

Host check (fake `ctx.subprocess`): both routes register
(`/api/git-tree/status`, `/api/git-tree/diff`, GET, `requestBody:'buffered'`);
porcelain-v2 parsing returns branch/upstream/ahead/behind and 4 entries for a
canned sample; diff argv is
`["git","diff","--no-color","--no-ext-diff","--no-textconv","--","README.md"]`
(with `--cached` for staged); `../etc/passwd`, `/etc/passwd`, `--upload-pack=x`,
`a/../../b` and `""` are rejected with `ok:false, code:'bad-request'` before argv;
a missing subprocess service yields `{ ok:false, code:'subprocess-unavailable' }`
instead of throwing. The assertions are listed in `plugin/README.md` §6 so the
Lead can re-run them; the throwaway harness itself was run from `/tmp` and is not
part of the deliverable.

---

## 8. Unknowns / not verified

1. **Slot inventory is static, not live.** Counts/ids come from scanning shipped
   `lib/client.js` artifacts; I could not run `cordis_inspect_query`
   (`Slots.listSubTree`) because this is a delegated, non-installing task. The
   profile resolves these UI packages from the dsh installation, so the list
   matches this build, but a shipped package that registers slots *dynamically*
   (a `children` map built at runtime) would be missed by the regex.
2. **Exact standard props of a `main` entry at runtime.** Inferred from shipped
   consumers (`PluginManagerPage` destructures `t`, `renderSlot`, `resolveText`,
   hooks; `ConversationMainPanel` gets `sessionId`, `useSession(s)`,
   `useConversation`, `renderSlot`, `renderFactorySlot`). The skeleton relies only
   on optional props and never requires a specific one.
3. **`dsh.client.inject` vs activation success.** The list is proven to order
   module arrival (loader code), but whether an unlisted owner would merely delay
   `ctx.slots.inject` (rather than fail) was not tested by installing.
4. **`immediately` effect on first paint** — the shell's `prefetchImmediateTier()`
   is visible in the minified bundle, but timing was not measured.
5. **`connection.fetch.register` path rules.** `endpointFromPath('/api', path)`
   validation was read, not exhaustively exercised; the skeleton uses the same
   `/api/<name>.<verb>` shape as shipped routes.
6. **`subprocess.spawn` `env` support.** Documented as "optional environment
   overrides"; workbench passes an extra `env` best-effort. Not exercised here
   (nothing was installed or spawned by this task).
7. **Runtime verification is absent.** Per the task rules the plugin was not
   installed, the profile was not edited, and no browser screenshot was taken.
   "Builds" means `node build.mjs` exits 0 and emits `lib/client.js`; it does not
   mean the slot renders.
8. **Workbench's current profile state.** `dsh-workbench` is a `link:` dependency
   of the `desktop` profile but is not listed in `dsh.profile.bundles` and has no
   patch row, so it appears currently *not composed* (it is still the best
   in-tree reference implementation; `docs/` claims the supported install flow).
9. **Theme values may drift.** Token *names* are the contract; the light/dark
   values quoted in §5.2 are this build's. Only `--dsw-alias-*`,
   `--dsh-frame-*`, `--dsw-radius-*`, font and transition tokens should be used.
10. **`ctx.layout` service name stability** — sidebar injects `"layout"` and the
    layout package provides `ctx.reflect.provide("layout", …)`, so the name is
    real in this build, but it is not documented as a public plugin contract.
