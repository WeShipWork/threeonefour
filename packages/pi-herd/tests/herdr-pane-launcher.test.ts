import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agentCategoryLabel, HerdrMirrorPaneLauncher } from "../src/herdr-pane-launcher.js";
import { SUBAGENT_STATUS, type MirrorAgentSnapshot } from "../src/mirror-types.js";

interface ExecCall {
	command: string;
	args: readonly string[];
}

class FakePiExecutor {
	readonly calls: ExecCall[] = [];
	private nextTab = 1;
	private nextPane = 1;

	async exec(command: string, args: readonly string[]): Promise<{ code: number; stdout: string; stderr: string; killed: boolean }> {
		this.calls.push({ command, args });
		if (args[0] === "tab" && args[1] === "create") {
			const tabId = `tab-${this.nextTab++}`;
			const paneId = `pane-${this.nextPane++}`;
			return {
				code: 0,
				stdout: JSON.stringify({ result: { tab: { tab_id: tabId }, root_pane: { pane_id: paneId } } }),
				stderr: "",
				killed: false,
			};
		}
		if (args[0] === "pane" && args[1] === "split") {
			return {
				code: 0,
				stdout: JSON.stringify({ result: { pane: { pane_id: `pane-${this.nextPane++}` } } }),
				stderr: "",
				killed: false,
			};
		}
		return { code: 0, stdout: "", stderr: "", killed: false };
	}
}

function snapshot(overrides: Partial<MirrorAgentSnapshot> = {}): MirrorAgentSnapshot {
	return {
		id: "agent-1",
		type: "Explore",
		description: "Inspect package layout",
		status: SUBAGENT_STATUS.RUNNING,
		assistantText: "",
		updatedAt: 1,
		...overrides,
	};
}

describe("agentCategoryLabel", () => {
	it("groups common agent roles into plural category labels", () => {
		assert.equal(agentCategoryLabel(snapshot({ type: "Explore" })), "scouts");
		assert.equal(agentCategoryLabel(snapshot({ type: "debugger" })), "debuggers");
		assert.equal(agentCategoryLabel(snapshot({ type: "Security Auditor" })), "reviewers");
	});
});

describe("HerdrMirrorPaneLauncher", () => {
	it("creates and reuses category tabs for read-only Subagent mirror panes", async () => {
		const pi = new FakePiExecutor();
		const launcher = new HerdrMirrorPaneLauncher({ pi, currentPaneId: "delegator-pane" });

		await launcher.launch(snapshot({ id: "scout-1", type: "Explore" }), "/tmp/pi herd/mirror.sock");
		await launcher.launch(snapshot({ id: "scout-2", type: "scout" }), "/tmp/pi herd/mirror.sock");
		await launcher.launch(snapshot({ id: "debug-1", type: "debugger" }), "/tmp/pi herd/mirror.sock");

		assert.deepEqual(pi.calls[0], {
			command: "herdr",
			args: ["tab", "create", "--label", "herd: scouts", "--no-focus"],
		});
		assert.deepEqual(pi.calls[1]?.args.slice(0, 3), ["pane", "run", "pane-1"]);
		assert.match(
			pi.calls[1]?.args[3] ?? "",
			/^pnpm --dir '.+' exec tsx '.+\/bin\/pi-herd-viewer\.ts' --socket '\/tmp\/pi herd\/mirror\.sock' --agent-id 'scout-1'$/,
		);
		assert.deepEqual(pi.calls[2], {
			command: "herdr",
			args: ["pane", "split", "pane-1", "--direction", "right", "--no-focus"],
		});
		assert.deepEqual(pi.calls[3]?.args.slice(0, 3), ["pane", "run", "pane-2"]);
		assert.deepEqual(pi.calls[4], {
			command: "herdr",
			args: ["tab", "create", "--label", "herd: debuggers", "--no-focus"],
		});
		assert.deepEqual(pi.calls[5]?.args.slice(0, 3), ["pane", "run", "pane-3"]);
	});
});
