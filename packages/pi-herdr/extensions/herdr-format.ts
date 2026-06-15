import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, truncateTail } from "@earendil-works/pi-coding-agent";
import { AGENT_STATUS, type AgentStatus, type PaneInfo, type StyleTheme, type TabInfo, type WorkspaceInfo } from "./herdr-types.js";

export async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) throw new Error("Aborted");
	await new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timeout);
			reject(new Error("Aborted"));
		};
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

export function sleepWithSignal(ms: number, signal: AbortSignal | undefined) {
	if (!signal) return new Promise((resolve) => setTimeout(resolve, ms));
	if (signal.aborted) return Promise.reject(new Error("wait_agent canceled."));
	return new Promise<void>((resolve, reject) => {
		const timer = setTimeout(() => {
			signal.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			signal.removeEventListener("abort", onAbort);
			reject(new Error("wait_agent canceled."));
		};
		signal.addEventListener("abort", onAbort, { once: true });
	});
}

export function throwIfAborted(signal: AbortSignal | undefined, action: string) {
	if (signal?.aborted) {
		throw new Error(`${action} canceled.`);
	}
}

export function formatReadOutput(output: string): string {
	const truncation = truncateTail(output, {
		maxLines: DEFAULT_MAX_LINES,
		maxBytes: DEFAULT_MAX_BYTES,
	});

	let text = truncation.content;
	if (truncation.truncated) {
		text = `[Showing last ${truncation.outputLines} of ${truncation.totalLines} lines]\n${text}`;
	}
	return text;
}

export function summarizePane(pane: PaneInfo, alias?: string, currentPaneId?: string): string {
	const name = alias || pane.pane_id;
	const flags = [
		pane.pane_id === currentPaneId || pane.focused ? "current" : null,
		pane.agent ? pane.agent : null,
		pane.agent_status !== AGENT_STATUS.UNKNOWN ? pane.agent_status : null,
	]
		.filter(Boolean)
		.join(", ");
	const cwd = pane.cwd ? ` ${pane.cwd}` : "";
	return `${name}: [${pane.pane_id}]${flags ? ` (${flags})` : ""}${cwd}`;
}

export function summarizeTab(tab: TabInfo): string {
	const flags = [tab.focused ? "focused" : null, tab.agent_status !== AGENT_STATUS.UNKNOWN ? tab.agent_status : null]
		.filter(Boolean)
		.join(", ");
	return `${tab.label}: [${tab.tab_id}]${flags ? ` (${flags})` : ""}`;
}

export function summarizeWorkspace(workspace: WorkspaceInfo): string {
	const flags = [workspace.focused ? "focused" : null, workspace.agent_status !== AGENT_STATUS.UNKNOWN ? workspace.agent_status : null]
		.filter(Boolean)
		.join(", ");
	return `${workspace.label}: [${workspace.workspace_id}]${flags ? ` (${flags})` : ""}`;
}

export function rejectUnexpectedParams(
	action: string,
	params: { workspace?: string; tab?: string },
	unexpected: Array<"workspace" | "tab">,
) {
	const present = unexpected.filter((key) => params[key] != null);
	if (!present.length) return;
	throw new Error(
		`${action} targets panes, not ${present.join(" or ")}. Use a pane alias or pane id from list, or the root pane returned by tab_create/workspace_create.`,
	);
}

export function formatStatusList(statuses: AgentStatus[]): string {
	return statuses.join("|");
}

export function statusDot(theme: StyleTheme, status: AgentStatus): string {
	switch (status) {
		case AGENT_STATUS.BLOCKED:
			return theme.fg("warning", "●");
		case AGENT_STATUS.WORKING:
			return theme.fg("accent", "●");
		case AGENT_STATUS.DONE:
			return theme.fg("success", "●");
		case AGENT_STATUS.IDLE:
			return theme.fg("muted", "○");
		default:
			return theme.fg("dim", "·");
	}
}

export function isWorkspaceInfo(value: unknown): value is WorkspaceInfo {
	return typeof value === "object" && value !== null && "workspace_id" in value && "label" in value;
}

export function isTabInfo(value: unknown): value is TabInfo {
	return typeof value === "object" && value !== null && "tab_id" in value && "label" in value;
}
