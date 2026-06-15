import { describe, expect, it } from "vitest";
import {
  agentRecordToMirrorSnapshot,
  createMirrorEventHub,
  PI_SUBAGENTS_MIRROR_EVENT_TYPE,
  type PiSubagentsMirrorEvent,
} from "../src/mirror.js";
import type { AgentRecord } from "../src/types.js";

function record(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    id: "agent-1",
    type: "Explore",
    description: "Inspect package layout",
    status: "running",
    toolUses: 0,
    startedAt: 1,
    lifetimeUsage: { input: 0, output: 0, cacheWrite: 0 },
    compactionCount: 0,
    session: {
      messages: [
        { role: "user", content: "Ignore me" },
        { role: "assistant", content: [{ type: "text", text: "Initial notes." }] },
      ],
    } as never,
    ...overrides,
  };
}

describe("mirror observation API", () => {
  it("builds read-only snapshots from agent records", () => {
    expect(agentRecordToMirrorSnapshot(record())).toEqual({
      id: "agent-1",
      type: "Explore",
      description: "Inspect package layout",
      status: "running",
      assistantText: "Initial notes.",
      updatedAt: 1,
      result: undefined,
      error: undefined,
    });
  });

  it("lists snapshots and publishes mirror events to subscribers", () => {
    const records = [record()];
    const hub = createMirrorEventHub(() => records);
    const events: PiSubagentsMirrorEvent[] = [];
    const unsubscribe = hub.subscribeToMirrorEvents((event) => {
      events.push(event);
    });

    expect(hub.listMirrorSnapshots()).toHaveLength(1);
    hub.publish({
      type: PI_SUBAGENTS_MIRROR_EVENT_TYPE.ASSISTANT_TEXT_DELTA,
      agentId: "agent-1",
      delta: " More notes.",
    });
    unsubscribe();
    hub.publish({
      type: PI_SUBAGENTS_MIRROR_EVENT_TYPE.STATUS,
      agentId: "agent-1",
      status: "completed",
    });

    expect(events).toEqual([{
      type: PI_SUBAGENTS_MIRROR_EVENT_TYPE.ASSISTANT_TEXT_DELTA,
      agentId: "agent-1",
      delta: " More notes.",
    }]);
  });
});
