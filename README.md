# dsh-git-tree

A DeepSeek Harness plugin that gives the Web GUI a Sourcetree-style Git workspace: a full-height panel with the left rail Sourcetree has (Working Copy / branches / tags / remotes), a staged/unstaged file list, and a diff viewer — inside DSH, next to your conversation, instead of in another app.

[中文文档](README.zh.md)

![The Git workspace panel](docs/design/frame2-workspace.png)

## What it does today

Version 0.1.0 is the **read-only first slice**. It is honest about that: the panel reads your working copy and renders it; it does not stage, commit or push yet.

- **A `main` panel**, opened from the `Git` row in DSH's left icon rail — the same kind of seat the Plugins page uses, so it gets the full centre column, the window chrome inset, and DSH's theme for free.
- **Branch + sync state**: current branch, upstream, ahead/behind, repository root.
- **Staged and unstaged lists**, split the way Sourcetree splits them, driven by `git status --porcelain=v2 --branch -z` (so renames, untracked files and conflicts keep their real XY state instead of being flattened into "modified").
- **Diff for the selected file**, with the same `--`-guarded, colour-free `git diff` DSH's own workspace-changes feature uses.
- **Read-only by construction**: the host half only ever runs `status`, `rev-parse` and `diff`. There is no mutation route in this version at all.

## Status

| Area | 0.1.0 |
| --- | --- |
| `main` panel + sidebar launcher | done |
| branch / ahead / behind | done |
| staged + unstaged lists | done |
| per-file diff | done |
| stage / unstage / commit | planned (P2) |
| history graph | planned (P3) |
| right-sidebar tab (compact mode) | planned |
| agent-shared operations | planned |

The full plan, including the measured UI spec the layout is built from, is in [`docs/PLAN.md`](docs/PLAN.md).

## Design notes

The panel copies Sourcetree's **information architecture**, not its chrome. The layout numbers are measured, not guessed: they come from the running app's accessibility tree and from decoding its Interface Builder archives — see [`docs/sourcetree-ui.md`](docs/sourcetree-ui.md) and [`docs/ib-summary.md`](docs/ib-summary.md).

Two consequences worth knowing:

- Sourcetree's diff has **no syntax highlighting**; it distinguishes lines with whole-row colour only. This panel does the same on purpose — in a diff, "which lines changed" beats "which token is a keyword".
- Every colour here is a `--dsw-alias-*` theme token, so light and dark both work without a second design. `npm test` fails if a hardcoded colour ever ships.

## How it is wired into DSH

| Half | File | What it does |
| --- | --- | --- |
| Host | `index.js` (plain ESM, no build) | registers two authenticated exact Fetch routes via `ctx.connection.fetch.register`, runs git through `ctx.subprocess` |
| Client | `client.js` (built from `src/client/index.tsx`) | registers the sidebar launcher into `sidebar.panellist` and the panel into `main`, both under the id `git-tree` |

```
GET /api/git-tree/status          → { branch, upstream, ahead, behind, entries[] }
GET /api/git-tree/diff?path=…     → { path, staged, text }
```

Git runs without a shell, with `GIT_TERMINAL_PROMPT=0` (never blocks on credentials), `GIT_OPTIONAL_LOCKS=0` (never takes optional locks in your repo), `GIT_CONFIG_COUNT=0` and bounded output and time. A path that is absolute, contains `..`, or starts with `-` is refused before it reaches `argv`, and a `cwd` outside the workspace is refused with 403.

The host mechanism is documented against the installed build in [`docs/dsh-plugin-api.md`](docs/dsh-plugin-api.md) — slot ids, the Fetch-route channel, subprocess safety and theme tokens, all with `file:line` citations into `app.asar`.

## Install

From this checkout:

```sh
dsh plugin add /Library/aiProject/dsh-git-tree
```

Or, inside a session that has the plugin manager, install the bundle and point it at the package directory:

```
plugin_manager action=install_bundle target=/Library/aiProject/dsh-git-tree
```

Restart or refresh the DSH page if the new client module does not appear immediately. The plugin only reads; nothing is written to your repository.

## Development

```sh
node build.mjs     # src/client/index.tsx → client.js (committed artifact)
npm run check      # node --check on both halves
npm test           # 18 assertions: manifest, host routes, bundle contract
```

`build.mjs` resolves esbuild from this package's `node_modules`, then from an installed `dsh-workbench`; if neither is present it stops with the exact command to fix that (`npm i -D esbuild`).

The test suite needs no DSH, no git and no browser:

- `test/manifest.test.mjs` — what the loader validates (platform, exports, patch row, icon, locales).
- `test/routes.test.mjs` — `apply()` against a fake context: both routes registered, porcelain-v2 parsed, `--` before paths, traversal/absolute/option-shaped paths refused, missing subprocess degrades instead of throwing.
- `test/ui-contract.test.mjs` — the built bundle: module-loader wrapper, exactly two slot registrations under one id, both routes called, theme tokens only, no `document.body`.

## Design mockups

`docs/design/` holds the four artboards the implementation is being measured against:

| File | Frame |
| --- | --- |
| [`overview.png`](docs/design/overview.png) | all four |
| [`frame1-docked.png`](docs/design/frame1-docked.png) | compact panel next to a conversation |
| [`frame2-workspace.png`](docs/design/frame2-workspace.png) | full workspace: rail / files / diff / commit box |
| [`frame3-history.png`](docs/design/frame3-history.png) | history lanes and commit detail |
| [`frame4-states.png`](docs/design/frame4-states.png) | row states, size grid, theme tokens, data flow |

## License

MIT
