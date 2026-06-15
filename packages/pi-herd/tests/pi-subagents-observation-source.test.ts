import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	PI_SUBAGENTS_MIRROR_EVENT_TYPE,
	PiSubagentsObservationSource,
	type PiSubagentsMirrorEvent,
	type PiSubagentsMirrorListener,
	type PiSubagentsMirrorService,
} from "../src/pi-subagents-observation-source.js";
import { MIRROR_OBSERVATION_EVENT_TYPE } from "../src/mirror-observation.js";
import { SUBAGENT_STATUS, type MirrorAgentSnapshot } from "../src/mirror-types.js";

class FakePiSubagentsMirrorService implements PiSubagentsMirrorService {
	private readonly listeners = new Set<PiSubagentsMirrorListener>();

	constructor(private readonly agents: readonly MirrorAgentSnapshot[]) {}

	listMirrorSnapshots(): readonly MirrorAgentSnapshot[] {
		return this.agents;
	}

	subscribeToMirrorEvents(listener: PiSubagentsMirrorListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	async emit(event: PiSubagentsMirrorEvent): Promise<void> {
		await Promise.all([...this.listeners].map((listener) => listener(event)));
	}
}

describe("PiSubagentsObservationSource", () => {
	it("adapts the forked pi-subagents mirror service to pi-herd observations", async () => {
		const snapshot: MirrorAgentSnapshot = {
			id: "agent-1",
			type: "Explore",
			description: "Inspect package layout",
			status: SUBAGENT_STATUS.RUNNING,
			assistantText: "Initial notes.",
			updatedAt: 1,
		};
		const service = new FakePiSubagentsMirrorService([snapshot]);
		const source = new PiSubagentsObservationSource(service);
		const events: unknown[] = [];

		assert.deepEqual(await source.listAgents(), [snapshot]);
		const unsubscribe = source.subscribe((event) => {
			events.push(event);
		});
		await service.emit({
			type: PI_SUBAGENTS_MIRROR_EVENT_TYPE.AGENT_SNAPSHOT,
			agent: snapshot,
		});
		await service.emit({
			type: PI_SUBAGENTS_MIRROR_EVENT_TYPE.ASSISTANT_TEXT_DELTA,
			agentId: "agent-1",
			delta: " More notes.",
		});
		await service.emit({
			type: PI_SUBAGENTS_MIRROR_EVENT_TYPE.STATUS,
			agentId: "agent-1",
			status: SUBAGENT_STATUS.COMPLETED,
		});
		unsubscribe();

		assert.deepEqual(events, [
			{ type: MIRROR_OBSERVATION_EVENT_TYPE.SNAPSHOT, agent: snapshot },
			{ type: MIRROR_OBSERVATION_EVENT_TYPE.ASSISTANT_TEXT_DELTA, agentId: "agent-1", delta: " More notes." },
			{ type: MIRROR_OBSERVATION_EVENT_TYPE.STATUS, agentId: "agent-1", status: SUBAGENT_STATUS.COMPLETED },
		]);
	});
});
