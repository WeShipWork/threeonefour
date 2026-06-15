# Agent Instructions for `threeonefour`

## Project overview

This is a pnpm monorepo for public Three One Four Pi extension packages.

- Package manager: `pnpm@11.6.0`
- Runtime baseline: Node `>=22.19.0` in package manifests and CI
- Language: TypeScript, strict mode
- Workspace packages live under `packages/*`
- Pi extension entrypoints are declared in each package's `package.json` under `pi.extensions`

## Read first

Before changing behavior, read the relevant files in this order:

1. `README.md` — repo layout and public package conventions.
2. `CONTEXT.md` — canonical project language. Use these terms exactly.
3. `docs/adr/*.md` — architectural decisions for mirror mode and Herdr integration.
4. The target package's `README.md`, `package.json`, and `tsconfig.json`.
5. For subagent work, also read:
   - `packages/pi-subagents/README.md`
   - `packages/pi-subagents/CHANGELOG.md`
   - `packages/pi-subagents/README.mirror.md`

## Domain language

Use the vocabulary in `CONTEXT.md`. Important terms:

- **Herd**: group of Pi agent sessions coordinated as one unit.
- **Herd member**: one Pi agent session managed as part of a Herd.
- **Subagent**: a Herd member considered from the Delegator's delegation perspective.
- **Delegator**: the parent Pi agent session that delegates work to Subagents.
- **Mirror mode**: Subagents execute in the Delegator process while Herdr panes display live read-only transcripts/status.
- **Transcript mirror**: read-oriented view of a Subagent conversation/status/activity.
- **Herdr**: terminal orchestration substrate for workspaces, tabs, and panes.
- **Scout / Engineer / Reviewer / Debugger**: canonical Subagent roles.

Avoid replacing these with loose alternatives like “swarm”, “worker”, “child process”, “coordinator”, “tmux”, or “terminal multiplexer”.

## Packages

### `packages/pi-herdr` — `@weshipwork/pi-herdr`

Pi extension that registers a `herdr` tool when running inside Herdr (`HERDR_ENV` and `HERDR_PANE_ID`). It manages workspaces, tabs, panes, command submission, scrollback reads, output watches, agent-status waits, and raw key/text sends.

- Entrypoint: `extensions/herdr.ts`
- Tests: native Node test runner via `node --import tsx --test "tests/**/*.test.ts"`

### `packages/pi-herd` — `@weshipwork/pi-herd`

Read-only transcript mirror plumbing for Pi Subagents in Herdr. Subagents still execute inside the Delegator Pi process; `pi-herd` bridges snapshot/live events over one session-scoped Unix socket and launches `pi-herd-viewer` panes.

- Entrypoint: `extensions/herd.ts`
- Viewer binary: `bin/pi-herd-viewer.ts`
- Core mirror code: `src/`
- Tests: native Node test runner via `node --import tsx --test "tests/**/*.test.ts"`

### `packages/pi-subagents` — `@weshipwork/pi-subagents`

Fork of `@tintinweb/pi-subagents` with a read-only observation seam for `pi-herd` mirror mode.

- Entrypoint: `src/index.ts`
- Mirror seam: `src/mirror.ts` and `globalThis.__piSubagentsMirrorService`
- Main lifecycle files: `src/agent-runner.ts`, `src/agent-manager.ts`
- Fork rule: do **not** add Herdr hosting or mirror-pane interactivity here. `pi-herd` owns external mirror panes and consumes this package read-only.
- Tests: Vitest
- Lint: Biome for `src/` and `test/`

## Commands

Run from the repo root unless noted.

```sh
pnpm install
pnpm check       # all package checks where present
pnpm typecheck   # all package typechecks where present
pnpm test        # all package tests where present
```

Package-specific commands:

```sh
pnpm --filter @weshipwork/pi-herdr check
pnpm --filter @weshipwork/pi-herd check
pnpm --filter @weshipwork/pi-subagents check
pnpm --filter @weshipwork/pi-subagents lint
pnpm --filter @weshipwork/pi-subagents lint:fix
pnpm --filter @weshipwork/pi-subagents test:mirror
pnpm --filter @weshipwork/pi-subagents test:e2e
```

CI runs `pnpm install --frozen-lockfile` and `pnpm check` on Node 22.

## TypeScript and code style

- Use strict TypeScript.
- Root packages use ESM (`"type": "module"`) and ES2022 targets.
- For NodeNext packages, include explicit `.js` suffixes on relative TypeScript imports that compile to ESM.
- Prefer small, typed seams over broad `any`; note that `packages/pi-subagents/biome.json` allows explicit `any` where needed for upstream/runtime integration.
- Keep package-local `tsconfig.json` scopes narrow.
- Do not introduce CommonJS patterns unless a package already requires them.
- Preserve public Pi extension entrypoints and package `files` lists when moving code.

## Architecture constraints

- Mirror mode is intentionally read-only. Mirror panes are observation surfaces, not Subagent hosts.
- Steering and aborting Subagents remain owned by `pi-subagents` tools/UI, not transcript mirror panes.
- Live transcript mirrors use subscriptions/events, not tailing transcript files as the primary transport.
- Mirror viewers communicate with the Delegator bridge over a local Unix socket, not Herdr pane stdin.
- There is one mirror socket per Delegator session.
- Transcript mirrors should show chronological transcripts and fold/truncate bulky tool content by default.
- Mirror panes should auto-follow while running and pause auto-follow when the user scrolls up.
- Both foreground and background Subagents are mirrored.

These constraints are documented in `docs/adr/0001` through `docs/adr/0008`; update or add an ADR before changing them.

## Pi and Herdr integration rules

- `pi-herdr` and `pi-herd` should no-op outside Herdr when `HERDR_ENV` or `HERDR_PANE_ID` is missing.
- Prefer Herdr pane actions by stable aliases when orchestrating terminal work.
- Use `herdr run` semantics for normal line submission; reserve raw send/key injection for low-level interactions.
- Keep `globalThis` integration seams narrow and documented; they are cross-extension contracts.
- Treat local sockets, session IDs, and `.pi/` state as runtime/session-scoped, not public API.

## Files and directories to avoid editing casually

- `node_modules/`, `dist/`, `build/`, `coverage/`, `*.tsbuildinfo`
- `.pi/` and `.agents/` local runtime/config caches
- `pnpm-lock.yaml` unless dependency changes require it
- Generated or local planning files such as `progress.md` or `plan/`

## Workflow expectations

- Inspect the actual code path before accepting a diagnosis.
- Prefer minimal, architecture-preserving fixes.
- Run the narrowest relevant package checks after changes, then root `pnpm check` when practical.
- If you change public behavior, update the relevant package README and tests.
- If you change mirror-mode architecture, update or add an ADR.
- If you change package exports, binaries, extension entrypoints, or publish contents, check the package `files`, `bin`, `pi.extensions`, and publish workflow assumptions.
