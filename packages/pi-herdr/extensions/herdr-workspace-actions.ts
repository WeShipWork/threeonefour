import {
	HERDR_ACTION,
	type HerdrToolInput,
	type PaneInfo,
	type TabInfo,
	type WorkspaceInfo,
} from "./herdr-types.js";
import { summarizePane, summarizeTab, summarizeWorkspace } from "./herdr-format.js";
import type { HerdrActionRuntime, HerdrToolResult } from "./herdr-action-context.js";

export async function handleWorkspaceAction(
	params: HerdrToolInput,
	runtime: HerdrActionRuntime,
): Promise<HerdrToolResult | undefined> {
	switch (params.action) {
		case HERDR_ACTION.LIST: {
			const panes = await runtime.client.getWorkspacePanes(runtime.currentWorkspaceId, runtime.signal);
			const aliasByPaneId = runtime.aliasByPaneId(runtime.currentWorkspaceId);

			const text = panes.length
				? panes.map((pane) => summarizePane(pane, aliasByPaneId.get(pane.pane_id), runtime.currentPaneId)).join("\n")
				: "No panes in current workspace.";

			return {
				content: [{ type: "text", text }],
				details: runtime.withSnapshot({
					action: HERDR_ACTION.LIST,
					panes,
					currentPaneId: runtime.currentPaneId,
					workspaceId: runtime.currentWorkspaceId,
					paneAliases: Object.fromEntries(aliasByPaneId),
				}),
			};
		}

		case HERDR_ACTION.WORKSPACE_LIST: {
			const workspaces = await runtime.client.getWorkspaceList(runtime.signal);
			const text = workspaces.length ? workspaces.map(summarizeWorkspace).join("\n") : "No workspaces.";
			return {
				content: [{ type: "text", text }],
				details: runtime.withSnapshot({ action: HERDR_ACTION.WORKSPACE_LIST, workspaces }),
			};
		}

		case HERDR_ACTION.WORKSPACE_CREATE: {
			const args = ["workspace", "create"];
			if (params.cwd) args.push("--cwd", params.cwd);
			if (params.label) args.push("--label", params.label);
			if (params.focus !== true) args.push("--no-focus");
			const response = await runtime.client.json<{
				result: { workspace: WorkspaceInfo; root_pane?: PaneInfo };
			}>(args, runtime.signal);
			const workspace = response.result.workspace;
			const rootPane =
				response.result.root_pane ?? (await runtime.client.getWorkspacePanes(workspace.workspace_id, runtime.signal))[0] ?? null;
			if (params.pane && rootPane) {
				runtime.aliasStore.recordAlias(params.pane, rootPane.pane_id, workspace.workspace_id);
			}
			const aliasText = params.pane && rootPane ? `, aliased as '${params.pane}'` : "";
			const rootPaneText = rootPane ? `, root pane ${rootPane.pane_id}${aliasText}` : "";
			return {
				content: [{
					type: "text",
					text: `Created workspace '${workspace.label}' (${workspace.workspace_id})${rootPaneText}`,
				}],
				details: runtime.withSnapshot({
					action: HERDR_ACTION.WORKSPACE_CREATE,
					workspace,
					rootPaneId: rootPane?.pane_id,
					pane: params.pane,
				}),
			};
		}

		case HERDR_ACTION.WORKSPACE_FOCUS: {
			const workspaceId = params.workspace;
			if (!workspaceId) throw new Error("'workspace' is required for workspace_focus");
			const response = await runtime.client.json<{ result: { workspace: WorkspaceInfo } }>([
				"workspace",
				"focus",
				workspaceId,
			], runtime.signal);
			return {
				content: [{ type: "text", text: `Focused workspace '${response.result.workspace.label}'` }],
				details: runtime.withSnapshot({ action: HERDR_ACTION.WORKSPACE_FOCUS, workspace: response.result.workspace }),
			};
		}

		case HERDR_ACTION.TAB_LIST: {
			const workspaceId = params.workspace ?? runtime.currentWorkspaceId;
			const tabs = await runtime.client.getTabList(workspaceId, runtime.signal);
			const text = tabs.length ? tabs.map(summarizeTab).join("\n") : "No tabs.";
			return {
				content: [{ type: "text", text }],
				details: runtime.withSnapshot({ action: HERDR_ACTION.TAB_LIST, tabs, workspaceId }),
			};
		}

		case HERDR_ACTION.TAB_CREATE: {
			const workspaceId = params.workspace ?? runtime.currentWorkspaceId;
			const args = ["tab", "create", "--workspace", workspaceId];
			if (params.cwd) args.push("--cwd", params.cwd);
			if (params.label) args.push("--label", params.label);
			if (params.focus !== true) args.push("--no-focus");
			const response = await runtime.client.json<{ result: { tab: TabInfo; root_pane?: PaneInfo } }>(args, runtime.signal);
			const tab = response.result.tab;
			const rootPane =
				response.result.root_pane ??
				(await runtime.client.getWorkspacePanes(tab.workspace_id, runtime.signal)).find((pane) => pane.tab_id === tab.tab_id) ??
				null;
			if (params.pane && rootPane) {
				runtime.aliasStore.recordAlias(params.pane, rootPane.pane_id, tab.workspace_id);
			}
			const aliasText = params.pane && rootPane ? `, aliased as '${params.pane}'` : "";
			const rootPaneText = rootPane ? `, root pane ${rootPane.pane_id}${aliasText}` : "";
			return {
				content: [{ type: "text", text: `Created tab '${tab.label}' (${tab.tab_id})${rootPaneText}` }],
				details: runtime.withSnapshot({
					action: HERDR_ACTION.TAB_CREATE,
					tab,
					rootPaneId: rootPane?.pane_id,
					pane: params.pane,
				}),
			};
		}

		case HERDR_ACTION.TAB_FOCUS: {
			const tabId = params.tab;
			if (!tabId) throw new Error("'tab' is required for tab_focus");
			const response = await runtime.client.json<{ result: { tab: TabInfo } }>(["tab", "focus", tabId], runtime.signal);
			return {
				content: [{ type: "text", text: `Focused tab '${response.result.tab.label}'` }],
				details: runtime.withSnapshot({ action: HERDR_ACTION.TAB_FOCUS, tab: response.result.tab }),
			};
		}

		case HERDR_ACTION.FOCUS: {
			if (params.tab) {
				const response = await runtime.client.json<{ result: { tab: TabInfo } }>(["tab", "focus", params.tab], runtime.signal);
				return {
					content: [{ type: "text", text: `Focused tab '${response.result.tab.label}'` }],
					details: runtime.withSnapshot({ action: HERDR_ACTION.FOCUS, target: "tab", tab: response.result.tab }),
				};
			}
			if (params.workspace) {
				const response = await runtime.client.json<{ result: { workspace: WorkspaceInfo } }>([
					"workspace",
					"focus",
					params.workspace,
				], runtime.signal);
				return {
					content: [{ type: "text", text: `Focused workspace '${response.result.workspace.label}'` }],
					details: runtime.withSnapshot({ action: HERDR_ACTION.FOCUS, target: "workspace", workspace: response.result.workspace }),
				};
			}
			if (params.pane) {
				const resolved = await runtime.requirePaneRef(params.pane);
				const response = await runtime.client.json<{ result: { tab: TabInfo } }>(["tab", "focus", resolved.pane.tab_id], runtime.signal);
				return {
					content: [{
						type: "text",
						text: `Focused tab '${response.result.tab.label}' for pane '${resolved.pane.pane_id}'. Herdr does not expose direct pane focus yet.`,
					}],
					details: runtime.withSnapshot({ action: HERDR_ACTION.FOCUS, target: "pane", paneId: resolved.pane.pane_id, tab: response.result.tab }),
				};
			}
			throw new Error("'workspace', 'tab', or 'pane' is required for focus");
		}

		default:
			return undefined;
	}
}
