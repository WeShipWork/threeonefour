# @weshipwork/pi-subagents mirror fork notes

This package is a minimal fork of `@tintinweb/pi-subagents` for `@weshipwork/pi-herd` Mirror mode.

The fork adds a read-only observation seam at `src/mirror.ts` and installs `globalThis.__piSubagentsMirrorService` so `pi-herd` can mirror Subagent snapshots and live updates without hosting or steering Subagents.

## Install for Mirror mode

Install both packages in the Delegator Pi session:

```sh
pi install npm:@weshipwork/pi-subagents
pi install npm:@weshipwork/pi-herd
```

For project-local settings:

```sh
pi install -l npm:@weshipwork/pi-subagents
pi install -l npm:@weshipwork/pi-herd
```

For one temporary Pi run from npm:

```sh
pi -e npm:@weshipwork/pi-subagents -e npm:@weshipwork/pi-herd
```

For local development from this repository:

```sh
pi -e ./packages/pi-subagents/src/index.ts -e ./packages/pi-herd/extensions/herd.ts
```

## Architecture constraint

Keep this fork read-only from the mirror perspective. `pi-herd` owns external Herdr mirror panes; `pi-subagents` owns Subagent execution, steering, aborting, and the Delegator UI.
