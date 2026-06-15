import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderMirrorEvent } from "../src/viewer-render.js";
import { MIRROR_EVENT_TYPE, SUBAGENT_STATUS } from "../src/mirror-types.js";

describe("renderMirrorEvent", () => {
	it("renders the initial status and assistant text deltas for a Transcript mirror", () => {
		assert.equal(renderMirrorEvent({
			type: MIRROR_EVENT_TYPE.SNAPSHOT,
			sequence: 0,
			agent: {
				id: "agent-1",
				type: "Explore",
				description: "Inspect package layout",
				status: SUBAGENT_STATUS.RUNNING,
				assistantText: "Initial notes.",
				updatedAt: 1,
			},
		}), "[running] Explore — Inspect package layout\nInitial notes.");

		assert.equal(renderMirrorEvent({
			type: MIRROR_EVENT_TYPE.ASSISTANT_TEXT_DELTA,
			agentId: "agent-1",
			delta: " More notes.",
			sequence: 1,
		}), " More notes.");
	});
});
