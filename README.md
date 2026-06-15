# threeonefour

_Public Pi extension packages from WeShip.work._

[![CI](https://img.shields.io/github/actions/workflow/status/WeShipWork/threeonefour/ci.yml?style=flat-square&label=CI)](https://github.com/WeShipWork/threeonefour/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.19.0-3c873a?style=flat-square&logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11.6.0-f69220?style=flat-square&logo=pnpm&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)

[Packages](#packages) • [Getting started](#getting-started) • [Mirror mode](#mirror-mode) • [Development](#development) • [Troubleshooting](#troubleshooting)

`threeonefour` is a pnpm monorepo for Pi extensions that make agent orchestration easier to observe and control from the terminal. It contains Herdr integration, read-only Transcript mirrors for Subagents, and a fork of `pi-subagents` with a narrow observation seam for Mirror mode.

> [!NOTE]
> These packages are designed for [Pi](https://pi.dev) and Herdr-based workflows. `pi-herdr` and `pi-herd` intentionally no-op outside Herdr when `HERDR_ENV` or `HERDR_PANE_ID` is missing.

## Packages

| Package | Purpose | Entry point |
| --- | --- | --- |
| [`@weshipwork/pi-herdr`](./packages/pi-herdr) | Registers the `herdr` tool so Pi can list workspaces, split panes, run commands, read output, watch logs, and coordinate agent panes from inside Herdr. | `extensions/herdr.ts` |
| [`@weshipwork/pi-herd`](./packages/pi-herd) | Starts read-only Transcript mirror plumbing for Subagents in Herdr, including the `pi-herd-viewer` pane renderer. | `extensions/herd.ts` |
| [`@weshipwork/pi-subagents`](./packages/pi-subagents) | Fork of `@tintinweb/pi-subagents` that keeps Subagents executing in the Delegator process and exposes read-only mirror events for `pi-herd`. | `src/index.ts` |

## Features

- **Herdr orchestration from Pi** — create tabs, split panes, submit commands atomically, watch output, and wait for agent status changes.
- **Read-only Transcript mirrors** — display live Subagent status and transcript streams in Herdr panes without moving execution out of the Delegator process.
- **Subagent observation seam** — `pi-subagents` publishes snapshots, status updates, and assistant text deltas through a small read-only mirror service.
- **Session-scoped local transport** — mirror viewers connect to one Unix socket per Delegator session.
- **Strict TypeScript packages** — ESM packages with package-local checks and tests.

## Getting started

### Prerequisites

- Node.js `>=22.19.0`
- pnpm `11.6.0`
- Pi coding agent
- Herdr, for the packages that create or control panes

### Install packages

Pi packages can be installed from npm, Git, HTTPS URLs, or local paths. Package installs are different from installing the `pi` CLI itself.

Install globally for your user settings (`~/.pi/agent/settings.json`):

```sh
pi install npm:@weshipwork/pi-herdr
pi install npm:@weshipwork/pi-subagents
pi install npm:@weshipwork/pi-herd
```

Install into project settings (`.pi/settings.json`) so trusted project sessions auto-install the packages on startup:

```sh
pi install -l npm:@weshipwork/pi-herdr
pi install -l npm:@weshipwork/pi-subagents
pi install -l npm:@weshipwork/pi-herd
```

Pin exact npm versions when you want reproducible installs:

```sh
pi install npm:@weshipwork/pi-herdr@0.1.0
pi install npm:@weshipwork/pi-subagents@0.10.3-mirror.0
pi install npm:@weshipwork/pi-herd@0.1.0
```

Try packages for one Pi run without writing settings:

```sh
pi -e npm:@weshipwork/pi-herdr
pi -e npm:@weshipwork/pi-subagents
pi -e npm:@weshipwork/pi-herd
```

Install from a local checkout:

```sh
pi install ./packages/pi-herdr
pi install ./packages/pi-subagents
pi install ./packages/pi-herd
```

For Git or HTTPS package sources, use repositories whose package root declares Pi resources. This repository is a monorepo, so normal installs should use the published npm packages or package-local paths from a checkout.

Useful package management commands:

```sh
pi list
pi update --extensions
pi update npm:@weshipwork/pi-herdr
pi remove npm:@weshipwork/pi-herdr
```

> [!TIP]
> Use `@weshipwork/pi-herdr` when you want the Delegator to control Herdr panes. Add `@weshipwork/pi-subagents` and `@weshipwork/pi-herd` when you want Herd members mirrored into read-only Herdr panes.

## Mirror mode

Mirror mode keeps Subagent execution owned by the Delegator while Herdr panes show live read-only views.

```text
Delegator Pi session
├─ @weshipwork/pi-subagents executes Subagents in-process
├─ @weshipwork/pi-herd bridges mirror events over a local Unix socket
└─ Herdr panes run pi-herd-viewer for live Transcript mirrors
```

A viewer can also be launched manually for debugging:

```sh
pi-herd-viewer --socket /path/to/pi-herd.sock --agent-id <subagent-id>
```

> [!IMPORTANT]
> Transcript mirrors are observation surfaces only. Steering and aborting Subagents remain owned by `pi-subagents` tools and UI in the Delegator session.

## Development

Clone the repository and install dependencies:

```sh
git clone https://github.com/WeShipWork/threeonefour.git
cd threeonefour
pnpm install
```

This repository also includes a `mise.toml` for reproducible local tooling and
task shortcuts. To install the pinned Node.js, pnpm, and hook tools, then enable
the tracked hk hooks for your checkout:

```sh
mise run setup
```

Common mise tasks mirror the package scripts:

```sh
mise run check
mise run typecheck
mise run test
mise run hk:check
```

Run checks across the workspace:

```sh
pnpm check
pnpm typecheck
pnpm test
```

Run package-specific checks:

```sh
pnpm --filter @weshipwork/pi-herdr check
pnpm --filter @weshipwork/pi-herd check
pnpm --filter @weshipwork/pi-subagents check
pnpm --filter @weshipwork/pi-subagents lint
pnpm --filter @weshipwork/pi-subagents test:mirror
```

## Repository layout

```text
.
├─ packages/
│  ├─ pi-herdr/              # Herdr tool extension
│  ├─ pi-herd/               # Transcript mirror runtime and viewer
│  └─ pi-subagents/          # Subagents fork with mirror observation support
└─ package.json              # Workspace scripts
```

## Architecture

- Subagents execute in the Delegator process; Herdr panes do not host Subagent runtimes.
- Transcript mirrors are read-only and receive structured live events, not tailed transcript files.
- Mirror viewers communicate with the Delegator bridge over a local Unix socket.
- A Delegator session owns one mirror socket and cleans it up on shutdown.
- Mirrors are intended to show chronological transcripts while folding bulky tool content by default.

Public docs in this repository use the project terms Herd, Herd member, Subagent, Delegator, Mirror mode, Transcript mirror, and Herdr consistently.

## Troubleshooting

- **No `herdr` tool appears:** make sure Pi is running inside Herdr and both `HERDR_ENV` and `HERDR_PANE_ID` are set.
- **Mirror panes do not open:** ensure `@weshipwork/pi-subagents` and `@weshipwork/pi-herd` are both loaded in the Delegator session.
- **Viewer cannot connect:** the `pi-herd-viewer` socket path is session-scoped and disappears when the Delegator exits.
- **Package install fails:** verify npm can reach the public npm registry and that no local `@weshipwork:registry` override points at another registry.
