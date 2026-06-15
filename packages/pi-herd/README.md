# @weshipwork/pi-herd

Read-only Transcript mirror plumbing for Pi Subagents in Herdr.

`pi-herd` does not execute Subagents. Subagents continue to run in the Delegator Pi process through `@weshipwork/pi-subagents`; this package starts the mirror bridge and launches Herdr panes that render read-only Transcript mirrors.

## Install

Mirror mode needs both `@weshipwork/pi-subagents` and `@weshipwork/pi-herd` in the Delegator session. `@weshipwork/pi-herdr` is recommended when you also want the Delegator to control Herdr panes directly.

Install globally for your user settings (`~/.pi/agent/settings.json`):

```sh
pi install npm:@weshipwork/pi-subagents
pi install npm:@weshipwork/pi-herd
pi install npm:@weshipwork/pi-herdr
```

Install into project settings (`.pi/settings.json`) so trusted project sessions auto-install the packages on startup:

```sh
pi install -l npm:@weshipwork/pi-subagents
pi install -l npm:@weshipwork/pi-herd
pi install -l npm:@weshipwork/pi-herdr
```

Pin exact npm versions:

```sh
pi install npm:@weshipwork/pi-subagents@0.10.3-mirror.0
pi install npm:@weshipwork/pi-herd@0.1.0
pi install npm:@weshipwork/pi-herdr@0.1.0
```

Try mirror mode for one Pi run without writing settings:

```sh
pi -e npm:@weshipwork/pi-subagents -e npm:@weshipwork/pi-herd
```

Use a local checkout:

```sh
pi install ./packages/pi-subagents
pi install ./packages/pi-herd
pi -e ./packages/pi-subagents/src/index.ts -e ./packages/pi-herd/extensions/herd.ts
```

For Git or HTTPS package sources, use repositories whose package root declares Pi resources. This repository is a monorepo, so normal installs should use the published npm packages or package-local paths from a checkout.

Manage installed Pi packages:

```sh
pi list
pi update --extensions
pi update npm:@weshipwork/pi-herd
pi remove npm:@weshipwork/pi-herd
```

## Use

Run Pi inside Herdr with `@weshipwork/pi-subagents` and `@weshipwork/pi-herd` loaded. When Subagents are created, `pi-herd` starts a session-scoped Unix socket and opens Herdr panes that run `pi-herd-viewer` for live read-only transcripts.

```text
Delegator Pi session
├─ @weshipwork/pi-subagents executes Subagents in-process
├─ @weshipwork/pi-herd bridges mirror events over a local Unix socket
└─ Herdr panes run pi-herd-viewer for live Transcript mirrors
```

The viewer binary is primarily launched by the extension. For local debugging from this repository:

```sh
pnpm --dir packages/pi-herd exec tsx bin/pi-herd-viewer.ts --socket /path/to/pi-herd.sock --agent-id <subagent-id>
```

## Current mirror-mode slice

The current tracer bullet supports:

- a read-only observation-source interface for Subagent snapshots and live updates;
- a forked `pi-subagents` mirror-service adapter shape;
- a Delegator-side `MirrorBridge` that forwards updates to `MirrorServer`;
- initial snapshots, assistant text deltas, and status updates in the viewer stream;
- a Pi extension entrypoint that starts a session-scoped mirror runtime when an observation source is installed;
- Herdr pane launch for `pi-herd-viewer` mirrors.

Full chronological transcripts, tool folding, and scroll/focus keybindings are later slices.

## Pi extension integration

`./extensions/herd.ts` starts only inside Herdr (`HERDR_ENV` and `HERDR_PANE_ID`) and consumes a read-only observation source from the forked `pi-subagents` runtime.

The expected fork seam is represented by `PiSubagentsMirrorService` in `src/pi-subagents-observation-source.ts`.
