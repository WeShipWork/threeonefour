import {
	HERDR_ACTION,
	READ_SOURCE,
	SPLIT_DIRECTION,
	WAIT_MODE,
	type AgentStatus,
	type HerdrToolInput,
	type PaneInfo,
	type PaneReadResult,
} from "./herdr-types.js";
import {
	formatReadOutput,
	formatStatusList,
	rejectUnexpectedParams,
	sleep,
	sleepWithSignal,
	throwIfAborted,
} from "./herdr-format.js";
import type { HerdrActionRuntime, HerdrToolResult } from "./herdr-action-context.js";

export async function handlePaneAction(
	params: HerdrToolInput,
	runtime: HerdrActionRuntime,
): Promise<HerdrToolResult | undefined> {
	switch (params.action) {
		case HERDR_ACTION.PANE_SPLIT: {
			rejectUnexpectedParams("pane_split", params, ["workspace", "tab"]);
			const paneRef = params.pane ?? runtime.currentPaneId;
			const direction = params.direction ?? SPLIT_DIRECTION.RIGHT;

			const sourcePane = await runtime.requirePaneRef(paneRef);
			const args = ["pane", "split", sourcePane.pane.pane_id, "--direction", direction];
			if (params.cwd) args.push("--cwd", params.cwd);
			if (params.focus !== true) args.push("--no-focus");

			const response = await runtime.client.json<{ result: { pane: PaneInfo } }>(args, runtime.signal);
			const splitPane = response.result.pane;
			if (params.newPane) {
				runtime.aliasStore.recordAlias(params.newPane, splitPane.pane_id, splitPane.workspace_id);
			}

			const sourceLabel = sourcePane.alias || paneRef;
			const aliasText = params.newPane ? `, aliased as '${params.newPane}'` : "";
			return {
				content: [{
					type: "text",
					text: `Created pane '${splitPane.pane_id}' by splitting '${sourceLabel}' ${direction}${aliasText}`,
				}],
				details: runtime.withSnapshot({
					action: HERDR_ACTION.PANE_SPLIT,
					pane: sourceLabel,
					paneId: sourcePane.pane.pane_id,
					newPane: params.newPane || splitPane.pane_id,
					newPaneId: splitPane.pane_id,
					direction,
					workspaceId: splitPane.workspace_id,
				}),
			};
		}

		case HERDR_ACTION.RUN: {
			rejectUnexpectedParams("run", params, ["workspace", "tab"]);
			const paneRef = params.pane;
			const command = params.command;
			if (!paneRef) throw new Error("'pane' is required for run");
			if (!command) throw new Error("'command' is required for run");

			const targetPane = await runtime.requirePaneRef(paneRef);
			await runtime.client.exec(["pane", "run", targetPane.pane.pane_id, command], runtime.signal);

			await sleep(800, runtime.signal);
			const initialOutput = await runtime.client.readPane(
				targetPane.pane.pane_id,
				{
					source: params.source ?? READ_SOURCE.RECENT,
					lines: params.lines ?? 20,
					raw: params.raw,
				},
				runtime.signal,
			);

			const paneLabel = targetPane.alias || paneRef;
			return {
				content: [
					{
						type: "text",
						text: `Started '${command}' in pane '${paneLabel}' (${targetPane.pane.pane_id})\n\n${formatReadOutput(initialOutput)}`,
					},
				],
				details: runtime.withSnapshot({
					action: HERDR_ACTION.RUN,
					pane: paneLabel,
					paneId: targetPane.pane.pane_id,
					command,
					workspaceId: runtime.currentWorkspaceId,
				}),
			};
		}

		case HERDR_ACTION.READ: {
			rejectUnexpectedParams("read", params, ["workspace", "tab"]);
			const paneRef = params.pane;
			if (!paneRef) throw new Error("'pane' is required for read");

			const resolved = await runtime.requirePaneRef(paneRef);

			const output = await runtime.client.readPane(
				resolved.pane.pane_id,
				{
					source: params.source ?? READ_SOURCE.RECENT,
					lines: params.lines ?? 20,
					raw: params.raw,
				},
				runtime.signal,
			);

			return {
				content: [{ type: "text", text: formatReadOutput(output) }],
				details: runtime.withSnapshot({
					action: HERDR_ACTION.READ,
					pane: resolved.alias || paneRef,
					paneId: resolved.pane.pane_id,
					source: params.source ?? READ_SOURCE.RECENT,
				}),
			};
		}

		case HERDR_ACTION.WATCH: {
			rejectUnexpectedParams("watch", params, ["workspace", "tab"]);
			const paneRef = params.pane;
			const match = params.match;
			if (!paneRef) throw new Error("'pane' is required for watch");
			if (!match) throw new Error("'match' is required for watch");

			const resolved = await runtime.requirePaneRef(paneRef);
			const paneLabel = resolved.alias || paneRef;
			const startTime = Date.now();

			const publishWatchUpdate = () => {
				runtime.onUpdate?.({
					content: [{ type: "text", text: `Watching ${paneLabel}...` }],
					details: runtime.withSnapshot({
						action: HERDR_ACTION.WATCH,
						pane: paneLabel,
						paneId: resolved.pane.pane_id,
						match,
						elapsed: Math.floor((Date.now() - startTime) / 1000),
					}),
				});
			};

			publishWatchUpdate();
			const updateTimer = runtime.onUpdate ? setInterval(publishWatchUpdate, 1000) : null;

			try {
				const args = ["wait", "output", resolved.pane.pane_id, "--match", match];
				if (params.source) args.push("--source", params.source);
				if (params.lines != null) args.push("--lines", String(params.lines));
				if (params.timeout != null) args.push("--timeout", String(params.timeout));
				if (params.regex) args.push("--regex");
				if (params.raw) args.push("--raw");

				const response = await runtime.client.json<{
					result: {
						type: string;
						pane_id: string;
						revision: number;
						matched_line: string;
						read: PaneReadResult;
					};
				}>(args, runtime.signal);
				const matched = response.result;
				const text = matched.read?.text ? formatReadOutput(matched.read.text) : matched.matched_line;

				return {
					content: [{ type: "text", text: `Matched: ${matched.matched_line}\n\n${text}` }],
					details: runtime.withSnapshot({
						action: HERDR_ACTION.WATCH,
						pane: paneLabel,
						paneId: resolved.pane.pane_id,
						matchedLine: matched.matched_line,
						elapsed: Math.floor((Date.now() - startTime) / 1000),
					}),
				};
			} finally {
				if (updateTimer) clearInterval(updateTimer);
			}
		}

		case HERDR_ACTION.WAIT_AGENT: {
			rejectUnexpectedParams("wait_agent", params, ["workspace", "tab"]);
			throwIfAborted(runtime.signal, "wait_agent");
			const paneRefs = params.panes?.length ? params.panes : params.pane ? [params.pane] : [];
			const statuses = params.statuses?.length ? params.statuses : params.status ? [params.status] : [];
			const mode = params.mode ?? WAIT_MODE.ALL;
			if (!paneRefs.length) throw new Error("'pane' or 'panes' is required for wait_agent");
			if (!statuses.length) throw new Error("'status' or 'statuses' is required for wait_agent");

			const resolvedPanes: Array<{ pane: PaneInfo; aliasOrRef: string }> = [];
			for (const paneRef of paneRefs) {
				throwIfAborted(runtime.signal, "wait_agent");
				const resolved = await runtime.requirePaneRef(paneRef);
				resolvedPanes.push({
					pane: resolved.pane,
					aliasOrRef: resolved.alias || paneRef,
				});
			}

			const deadline = params.timeout != null ? Date.now() + params.timeout : null;
			let snapshot: Array<{
				pane: string;
				paneId: string;
				status: AgentStatus;
				agent?: string;
			}> = [];

			while (true) {
				throwIfAborted(runtime.signal, "wait_agent");
				snapshot = [];
				for (const resolved of resolvedPanes) {
					throwIfAborted(runtime.signal, "wait_agent");
					const pane = await runtime.client.getPaneInfo(resolved.pane.pane_id, runtime.signal);
					if (!pane) throw new Error(`Pane '${resolved.aliasOrRef}' no longer exists.`);
					snapshot.push({
						pane: resolved.aliasOrRef,
						paneId: pane.pane_id,
						status: pane.agent_status,
						agent: pane.agent,
					});
				}

				const satisfied =
					mode === WAIT_MODE.ALL
						? snapshot.every((item) => statuses.includes(item.status))
						: snapshot.some((item) => statuses.includes(item.status));
				if (satisfied) break;
				if (deadline != null && Date.now() >= deadline) {
					throw new Error(
						`Timed out waiting for panes [${snapshot.map((item) => item.pane).join(", ")}] to reach ${mode} of statuses '${formatStatusList(statuses)}'. Last statuses: ${snapshot.map((item) => `${item.pane}=${item.status}`).join(", ")}`,
					);
				}
				await sleepWithSignal(250, runtime.signal);
			}

			const summary = snapshot.map((item) => `${item.pane}=${item.status}`).join(", ");
			return {
				content: [{
					type: "text",
					text: `wait_agent satisfied (${mode}: ${formatStatusList(statuses)})\n\n${summary}`,
				}],
				details: runtime.withSnapshot({
					action: HERDR_ACTION.WAIT_AGENT,
					pane: paneRefs.length === 1 ? resolvedPanes[0]?.aliasOrRef : undefined,
					panes: snapshot.map((item) => item.pane),
					paneIds: snapshot.map((item) => item.paneId),
					status: paneRefs.length === 1 && statuses.length === 1 ? snapshot[0]?.status : undefined,
					statuses,
					mode,
					agents: snapshot.map((item) => item.agent).filter(Boolean),
					snapshot,
				}),
			};
		}

		case HERDR_ACTION.SEND: {
			rejectUnexpectedParams("send", params, ["workspace", "tab"]);
			const paneRef = params.pane;
			if (!paneRef) throw new Error("'pane' is required for send");
			if (!params.text && !params.keys) throw new Error("'text' or 'keys' is required for send");

			const resolved = await runtime.requirePaneRef(paneRef);

			if (params.text) {
				await runtime.client.exec(["pane", "send-text", resolved.pane.pane_id, params.text], runtime.signal);
			}
			if (params.keys) {
				const keys = params.keys.split(/\s+/).filter(Boolean);
				await runtime.client.exec(["pane", "send-keys", resolved.pane.pane_id, ...keys], runtime.signal);
			}

			const desc = [params.text && `"${params.text}"`, params.keys].filter(Boolean).join(" + ");
			return {
				content: [{ type: "text", text: `Sent ${desc} to pane '${resolved.alias || paneRef}'` }],
				details: runtime.withSnapshot({
					action: HERDR_ACTION.SEND,
					pane: resolved.alias || paneRef,
					paneId: resolved.pane.pane_id,
					text: params.text,
					keys: params.keys,
				}),
			};
		}

		case HERDR_ACTION.STOP: {
			rejectUnexpectedParams("stop", params, ["workspace", "tab"]);
			const paneRef = params.pane;
			if (!paneRef) throw new Error("'pane' is required for stop");

			const resolved = await runtime.requirePaneRef(paneRef);
			if (resolved.pane.pane_id === runtime.currentPaneId) {
				throw new Error("Refusing to close the pane pi is running in.");
			}

			await runtime.client.exec(["pane", "close", resolved.pane.pane_id], runtime.signal);
			if (resolved.alias) runtime.aliasStore.forgetAlias(resolved.alias);

			return {
				content: [{ type: "text", text: `Closed pane '${resolved.alias || paneRef}'` }],
				details: runtime.withSnapshot({
					action: HERDR_ACTION.STOP,
					pane: resolved.alias || paneRef,
					paneId: resolved.pane.pane_id,
				}),
			};
		}

		default:
			return undefined;
	}
}
