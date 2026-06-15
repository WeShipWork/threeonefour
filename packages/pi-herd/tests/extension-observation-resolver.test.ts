import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	PI_HERD_OBSERVATION_SOURCE_KEY,
	PI_SUBAGENTS_MIRROR_SERVICE_KEY,
	resolveGlobalObservationSource,
} from "../extensions/herd.js";
import { PI_SUBAGENTS_MIRROR_EVENT_TYPE, type PiSubagentsMirrorListener } from "../src/pi-subagents-observation-source.js";
import { MIRROR_OBSERVATION_EVENT_TYPE } from "../src/mirror-observation.js";
import { SUBAGENT_STATUS, type MirrorAgentSnapshot } from "../src/mirror-types.js";

afterEach(() => {
	Reflect.deleteProperty(globalThis, PI_HERD_OBSERVATION_SOURCE_KEY);
	Reflect.deleteProperty(globalThis, PI_SUBAGENTS_MIRROR_SERVICE_KEY);
});

describe("resolveGlobalObservationSource", () => {
	it("adapts the tintinweb pi-subagents global mirror service when no direct source is installed", async () => {
		const snapshot: MirrorAgentSnapshot = {
			id: "agent-1",
			type: "Explore",
			description: "Inspect package layout",
			status: SUBAGENT_STATUS.RUNNING,
			assistantText: "Initial notes.",
			updatedAt: 1,
		};
		let listener: PiSubagentsMirrorListener | undefined;
		Reflect.set(globalThis, PI_SUBAGENTS_MIRROR_SERVICE_KEY, {
			listMirrorSnapshots: () => [snapshot],
			subscribeToMirrorEvents: (nextListener: PiSubagentsMirrorListener) => {
				listener = nextListener;
				return () => {
					listener = undefined;
				};
			},
		});

		const source = resolveGlobalObservationSource();
		assert.ok(source);
		assert.deepEqual(await source.listAgents(), [snapshot]);

		const events: unknown[] = [];
		source.subscribe((event) => {
			events.push(event);
		});
		await listener?.({
			type: PI_SUBAGENTS_MIRROR_EVENT_TYPE.ASSISTANT_TEXT_DELTA,
			agentId: "agent-1",
			delta: " More notes.",
		});

		assert.deepEqual(events, [{
			type: MIRROR_OBSERVATION_EVENT_TYPE.ASSISTANT_TEXT_DELTA,
			agentId: "agent-1",
			delta: " More notes.",
		}]);
	});
});
