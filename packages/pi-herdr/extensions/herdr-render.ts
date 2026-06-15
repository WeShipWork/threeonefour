import type { AgentToolResult, ToolRenderResultOptions } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { AGENT_STATUS, HERDR_ACTION, type HerdrToolDetails, type HerdrToolInput, type PaneInfo, type StyleTheme, type TabInfo, type WatchRenderState, type WorkspaceInfo } from "./herdr-types.js";

interface HerdrRenderContext {
	args?: Partial<HerdrToolInput>;
	lastComponent?: unknown;
	state: WatchRenderState;
}

import { isTabInfo, isWorkspaceInfo, statusDot } from "./herdr-format.js";

export function renderHerdrCall(
	args: Partial<HerdrToolInput>,
	theme: StyleTheme,
	context: HerdrRenderContext,
) {
	const component = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);

	let text = theme.fg("toolTitle", theme.bold("herdr "));
	text += theme.fg("accent", args.action || "?");
	if (args.workspace) text += theme.fg("muted", ` ${args.workspace}`);
	if (args.tab) text += theme.fg("muted", ` ${args.tab}`);
	if (args.pane) text += theme.fg("muted", ` ${args.pane}`);
	if (Array.isArray(args.panes) && args.panes.length) text += theme.fg("muted", ` ${args.panes.join(",")}`);
	if (args.direction) text += theme.fg("dim", ` › ${args.direction}`);
	if (args.command) text += theme.fg("dim", ` › ${args.command}`);
	if (args.newPane) text += theme.fg("muted", ` ${args.newPane}`);
	if (args.match) text += theme.fg("dim", ` › ${args.match}`);
	if (args.status) text += theme.fg("dim", ` › ${args.status}`);
	if (Array.isArray(args.statuses) && args.statuses.length) text += theme.fg("dim", ` › ${args.statuses.join("|")}`);
	if (args.mode) text += theme.fg("dim", ` ${args.mode}`);
	if (args.text) text += theme.fg("dim", ` › "${args.text}"`);
	if (args.keys) text += theme.fg("dim", ` › ${args.keys}`);

	component.setText(text);
	return component;
}

export function renderHerdrResult(
	result: AgentToolResult<HerdrToolDetails>,
	{ expanded, isPartial }: ToolRenderResultOptions,
	theme: StyleTheme,
	context: HerdrRenderContext,
) {
	const details = result.details;
	const state = context.state;
	if (context.args?.action === "watch") {
		if (isPartial) {
			state.watchElapsed = typeof details?.elapsed === "number" ? details.elapsed : 0;
			const pane = details?.pane || context.args?.pane || "?";
			return new Text(
				theme.fg("warning", `◌ watching ${pane}`) + theme.fg("dim", ` (${state.watchElapsed}s)`),
				0,
				0,
			);
		}
		delete state.watchElapsed;
	}
	if (!details) {
		const content = result.content?.[0];
		return new Text(content?.type === "text" ? content.text : "", 0, 0);
	}

	switch (details.action) {
		case HERDR_ACTION.PANE_SPLIT: {
			let text = theme.fg("accent", `▥ ${details.newPane || details.newPaneId}`);
			text += theme.fg("dim", ` ‹ ${details.direction} from ${details.pane}`);
			return new Text(text, 0, 0);
		}
		case HERDR_ACTION.RUN: {
			let text = theme.fg("success", `▶ ${details.pane}`);
			text += theme.fg("dim", ` › ${details.command}`);
			return new Text(text, 0, 0);
		}
		case HERDR_ACTION.READ: {
			let text = theme.fg("accent", `📄 ${details.pane}`);
			if (expanded) {
				const content = result.content?.[0];
				if (content?.type === "text") {
					const outputLines = content.text.split("\n").slice(0, 40);
					text += "\n" + outputLines.map((line: string) => theme.fg("dim", line)).join("\n");
				}
			}
			return new Text(text, 0, 0);
		}
		case HERDR_ACTION.WATCH: {
			let text = theme.fg("success", `✓ ${details.pane}`);
			text += theme.fg("dim", ` › ${details.matchedLine}`);
			if (typeof details.elapsed === "number") text += theme.fg("muted", ` (took ${details.elapsed}s)`);
			return new Text(text, 0, 0);
		}
		case HERDR_ACTION.WAIT_AGENT: {
			const panes = Array.isArray(details.panes) && details.panes.length ? details.panes : details.pane ? [details.pane] : [];
			const statuses = Array.isArray(details.statuses) && details.statuses.length
				? details.statuses
				: details.status
					? [details.status]
					: [];
			let text = theme.fg("success", `◎ ${panes.join(", ")}`);
			if (statuses.length) text += theme.fg("dim", ` › ${statuses.join("|")}`);
			if (details.mode) text += theme.fg("muted", ` (${details.mode})`);
			return new Text(text, 0, 0);
		}
		case HERDR_ACTION.SEND: {
			const desc = [details.text && `"${details.text}"`, details.keys].filter(Boolean).join(" + ");
			return new Text(theme.fg("accent", `⏎ ${details.pane} › ${desc}`), 0, 0);
		}
		case HERDR_ACTION.STOP: {
			return new Text(theme.fg("warning", `■ ${details.pane}`), 0, 0);
		}
		case HERDR_ACTION.WORKSPACE_CREATE:
		case HERDR_ACTION.WORKSPACE_FOCUS: {
			const workspace = isWorkspaceInfo(details.workspace) ? details.workspace : undefined;
			return new Text(theme.fg("accent", `▣ ${workspace?.label || workspace?.workspace_id || "workspace"}`), 0, 0);
		}
		case HERDR_ACTION.TAB_CREATE:
		case HERDR_ACTION.TAB_FOCUS: {
			const tab = isTabInfo(details.tab) ? details.tab : undefined;
			return new Text(theme.fg("accent", `▤ ${tab?.label || tab?.tab_id || "tab"}`), 0, 0);
		}
		case HERDR_ACTION.FOCUS: {
			return new Text(theme.fg("accent", `◎ ${details.target}`), 0, 0);
		}
		case HERDR_ACTION.WORKSPACE_LIST: {
			const workspaces = details.workspaces as WorkspaceInfo[];
			if (!workspaces?.length) return new Text(theme.fg("dim", "no workspaces"), 0, 0);
			const lines = workspaces.map((workspace) => {
				const dot = statusDot(theme, workspace.agent_status);
				const label = theme.fg(workspace.focused ? "accent" : "muted", workspace.label || workspace.workspace_id);
				const extra = [workspace.workspace_id, workspace.agent_status !== AGENT_STATUS.UNKNOWN ? workspace.agent_status : null]
					.filter(Boolean)
					.join(" ");
				return `${dot} ${label}${extra ? ` ${theme.fg("dim", extra)}` : ""}`;
			});
			return new Text(lines.join("\n"), 0, 0);
		}
		case HERDR_ACTION.TAB_LIST: {
			const tabs = details.tabs as TabInfo[];
			if (!tabs?.length) return new Text(theme.fg("dim", "no tabs"), 0, 0);
			const lines = tabs.map((tab) => {
				const dot = statusDot(theme, tab.agent_status);
				const label = theme.fg(tab.focused ? "accent" : "muted", tab.label || tab.tab_id);
				const extra = [tab.tab_id, tab.agent_status !== AGENT_STATUS.UNKNOWN ? tab.agent_status : null].filter(Boolean).join(" ");
				return `${dot} ${label}${extra ? ` ${theme.fg("dim", extra)}` : ""}`;
			});
			return new Text(lines.join("\n"), 0, 0);
		}
		case HERDR_ACTION.LIST: {
			const panes = details.panes as PaneInfo[];
			if (!panes?.length) return new Text(theme.fg("dim", "no panes"), 0, 0);
			const paneAliases = (details.paneAliases || {}) as Record<string, string>;
			const lines = panes.map((pane) => {
				const dot = statusDot(theme, pane.agent_status);
				const label = paneAliases[pane.pane_id]
					? theme.fg("accent", paneAliases[pane.pane_id])
					: theme.fg("muted", pane.pane_id);
				const extra = [pane.agent, pane.agent_status !== AGENT_STATUS.UNKNOWN ? pane.agent_status : null].filter(Boolean).join(" ");
				return `${dot} ${label}${extra ? ` ${theme.fg("dim", extra)}` : ""}`;
			});
			return new Text(lines.join("\n"), 0, 0);
		}
		default: {
			const content = result.content?.[0];
			return new Text(content?.type === "text" ? content.text : "", 0, 0);
		}
	}
}
