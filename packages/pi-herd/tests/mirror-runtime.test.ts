import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MirrorRuntime } from "../src/mirror-runtime.js";
import { MirrorServer } from "../src/mirror-server.js";
import { SUBAGENT_STATUS, type MirrorAgentSnapshot } from "../src/mirror-types.js";
import {
	MIRROR_OBSERVATION_EVENT_TYPE,
	type MirrorObservationEvent,
	type MirrorObservationListener,
	type MirrorObservationSource,
} from "../src/mirror-observation.js";

class FakeObservationSource implements MirrorObservationSource {
	private readonly listeners = new Set<MirrorObservationListener>();

	constructor(private readonly agents: readonly MirrorAgentSnapshot[]) {}

	listAgents(): readonly MirrorAgentSnapshot[] {
		return this.agents;
	}

	subscribe(listener: MirrorObservationListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	async emit(event: MirrorObservationEvent): Promise<void> {
		await Promise.all([...this.listeners].map((listener) => listener(event)));
	}
}

class FakeLauncher {
	readonly launches: Array<{ agentId: string; socketPath: string }> = [];
	closed = false;

	async launch(agent: MirrorAgentSnapshot, socketPath: string): Promise<string> {
		this.launches.push({ agentId: agent.id, socketPath });
		return `pane-${agent.id}`;
	}

	async closeAll(): Promise<void> {
		this.closed = true;
	}
}

function snapshot(id: string): MirrorAgentSnapshot {
	return {
		id,
		type: "Explore",
		description: "Inspect package layout",
		status: SUBAGENT_STATUS.RUNNING,
		assistantText: "",
		updatedAt: 1,
	};
}

describe("MirrorRuntime", () => {
	it("starts the bridge and launches one mirror pane for existing and newly observed Subagents", async () => {
		const dir = await mkdtemp(join(tmpdir(), "pi-herd-"));
		const socketPath = join(dir, "mirror.sock");
		const source = new FakeObservationSource([snapshot("agent-1")]);
		const server = new MirrorServer({ socketPath });
		const launcher = new FakeLauncher();
		const runtime = new MirrorRuntime({ source, server, launcher, socketPath });

		try {
			await runtime.start();
			await source.emit({ type: MIRROR_OBSERVATION_EVENT_TYPE.SNAPSHOT, agent: snapshot("agent-2") });
			await source.emit({ type: MIRROR_OBSERVATION_EVENT_TYPE.SNAPSHOT, agent: snapshot("agent-2") });

			assert.deepEqual(launcher.launches, [
				{ agentId: "agent-1", socketPath },
				{ agentId: "agent-2", socketPath },
			]);
		} finally {
			await runtime.stop();
			await rm(dir, { recursive: true, force: true });
		}

		assert.equal(launcher.closed, true);
	});
});
