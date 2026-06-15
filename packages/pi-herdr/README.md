# @weshipwork/pi-herdr

Pi extension for controlling Herdr workspaces, tabs, and panes from inside a running Herdr pane.

The extension registers a single `herdr` tool when both `HERDR_ENV` and `HERDR_PANE_ID` are present. Outside Herdr it loads as a no-op.

## Install

Install globally for your user settings (`~/.pi/agent/settings.json`):

```sh
pi install npm:@weshipwork/pi-herdr
```

Install into project settings (`.pi/settings.json`) so trusted project sessions auto-install it on startup:

```sh
pi install -l npm:@weshipwork/pi-herdr
```

Pin an exact npm version:

```sh
pi install npm:@weshipwork/pi-herdr@0.1.0
```

Try it for one Pi run without writing settings:

```sh
pi -e npm:@weshipwork/pi-herdr
```

Use a local checkout:

```sh
pi install ./packages/pi-herdr
pi -e ./packages/pi-herdr/extensions/herdr.ts
```

For Git or HTTPS package sources, use repositories whose package root declares Pi resources. This repository is a monorepo, so normal installs should use the published npm package or this package-local path from a checkout.

Manage installed Pi packages:

```sh
pi list
pi update --extensions
pi update npm:@weshipwork/pi-herdr
pi remove npm:@weshipwork/pi-herdr
```

## Use

Start Pi from inside Herdr with the package installed. The `herdr` tool appears only when Herdr exposes `HERDR_ENV` and `HERDR_PANE_ID`.

Example tool capabilities:

- list, create, and focus workspaces and tabs;
- split panes and assign stable aliases;
- run commands atomically in existing panes;
- read pane output and watch for output matches;
- wait for coding-agent panes by agent status;
- send raw text/keys and close managed panes.

Use `run` for normal line submission. Use `send` only for lower-level text or key injection.
