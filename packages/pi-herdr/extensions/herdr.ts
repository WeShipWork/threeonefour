import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { HerdrToolParameters } from "./herdr-types.js";
import { HerdrActionRuntime } from "./herdr-action-context.js";
import { HerdrClient } from "./herdr-client.js";
import { handlePaneAction } from "./herdr-pane-actions.js";
import { renderHerdrCall, renderHerdrResult } from "./herdr-render.js";
import { PaneAliasStore } from "./herdr-state.js";
import { handleWorkspaceAction } from "./herdr-workspace-actions.js";

export default function (pi: ExtensionAPI) {
	const herdrEnv = process.env.HERDR_ENV;
	const currentPaneTargetEnv = process.env.HERDR_PANE_ID;
	if (!herdrEnv || !currentPaneTargetEnv) {
		return;
	}
	const currentPaneTarget = currentPaneTargetEnv;

	const aliasStore = new PaneAliasStore();
	const client = new HerdrClient(pi, currentPaneTarget);

	pi.on("session_start", async (_event, ctx) => aliasStore.reconstruct(ctx));
	pi.on("session_tree", async (_event, ctx) => aliasStore.reconstruct(ctx));

	pi.registerTool({
		name: "herdr",
		label: "herdr",
		description:
			"Herdr-native pane orchestration for long-running workflows. " +
			"Actions: list panes, manage workspaces and tabs, split existing panes, submit lines atomically in existing panes, read output, watch readiness, wait for one or more agent panes to reach target statuses, send raw text or keys, focus contexts, and stop panes.",
		promptGuidelines: [
			"Use `herdr` run for long-running processes in other panes instead of `bash`.",
			"When you want to submit a line or prompt to a pane, prefer `run` over `send` + `Enter` so text and Enter happen atomically.",
			"Use `send` only for low-level literal text or key injection when you do not want command-style submission semantics.",
			"Preserve the current UI focus by default. Do not change workspace or tab focus unless the user explicitly asks or the workflow truly requires visible interaction there.",
			"Pane actions like run, read, watch, wait_agent, send, and stop must target pane aliases or pane ids, not tab ids. For pane_split, omit pane to split the agent's own pane, or pass a pane alias/id to split that explicit source pane.",
			"Use `herdr` workspace, tab, and pane_split actions to organize parallel work instead of piling everything into one pane stack.",
			"Use `herdr` watch for normal command output, including server readiness, test completion, or regex matches.",
			"Use `herdr` wait_agent only for panes running a recognized coding agent. It waits on agent statuses, not normal process completion; use watch/read for commands like tests or servers.",
			"For agent panes, background finished panes usually become `done` while focused finished panes usually become `idle`.",
			"Use `recent-unwrapped` when you need log matching or reads that ignore soft wrapping.",
			"Pane references can be either friendly aliases you created earlier or real herdr pane ids from `list`.",
			"Use `pane_split`, `tab_create`, or `workspace_create` to establish new pane targets. `pane_split` defaults to the agent's own pane when pane is omitted and splits right when direction is omitted. `run` only works with an existing pane alias or pane id.",
			"Use friendly pane aliases like `server`, `reviewer`, or `tests` so later reads, watches, and sends can reuse them across the session.",
			"When starting a fresh pi instance in another pane and the model matters, either specify `--model` explicitly or ask the user which model/provider they want.",
		],
		parameters: HerdrToolParameters,

		async execute(_toolCallId, params, signal, onUpdate, _ctx) {
			const currentPane = await client.getCurrentPaneInfo(signal);
			const currentPaneId = currentPane.pane_id;
			const currentWorkspaceId = currentPane.workspace_id;
			const runtime = new HerdrActionRuntime(client, aliasStore, currentPaneId, currentWorkspaceId, signal, onUpdate);
			const result = await handleWorkspaceAction(params, runtime) ?? await handlePaneAction(params, runtime);
			if (result) return result;
			throw new Error(`Unknown action: ${params.action}`);
		},

		renderCall: renderHerdrCall,
		renderResult: renderHerdrResult,

	});
}
