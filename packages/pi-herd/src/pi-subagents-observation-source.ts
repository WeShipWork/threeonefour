import {
	MIRROR_OBSERVATION_EVENT_TYPE,
	type MirrorObservationEvent,
	type MirrorObservationListener,
	type MirrorObservationSource,
	type MirrorObservationUnsubscribe,
} from "./mirror-observation.js";
import type { MirrorAgentSnapshot, SubagentStatus } from "./mirror-types.js";

export const PI_SUBAGENTS_MIRROR_EVENT_TYPE = {
	AGENT_SNAPSHOT: "agent_snapshot",
	STATUS: "status",
	ASSISTANT_TEXT_DELTA: "assistant_text_delta",
} as const;

export type PiSubagentsMirrorEventType =
	(typeof PI_SUBAGENTS_MIRROR_EVENT_TYPE)[keyof typeof PI_SUBAGENTS_MIRROR_EVENT_TYPE];

export interface PiSubagentsAgentSnapshotEvent {
	type: typeof PI_SUBAGENTS_MIRROR_EVENT_TYPE.AGENT_SNAPSHOT;
	agent: MirrorAgentSnapshot;
}

export interface PiSubagentsStatusEvent {
	type: typeof PI_SUBAGENTS_MIRROR_EVENT_TYPE.STATUS;
	agentId: string;
	status: SubagentStatus;
}

export interface PiSubagentsAssistantTextDeltaEvent {
	type: typeof PI_SUBAGENTS_MIRROR_EVENT_TYPE.ASSISTANT_TEXT_DELTA;
	agentId: string;
	delta: string;
}

export type PiSubagentsMirrorEvent =
	| PiSubagentsAgentSnapshotEvent
	| PiSubagentsStatusEvent
	| PiSubagentsAssistantTextDeltaEvent;

export type PiSubagentsMirrorListener = (event: PiSubagentsMirrorEvent) => void | Promise<void>;

export interface PiSubagentsMirrorService {
	listMirrorSnapshots(): readonly MirrorAgentSnapshot[] | Promise<readonly MirrorAgentSnapshot[]>;
	subscribeToMirrorEvents(listener: PiSubagentsMirrorListener): MirrorObservationUnsubscribe;
}

export class PiSubagentsObservationSource implements MirrorObservationSource {
	constructor(private readonly service: PiSubagentsMirrorService) {}

	listAgents(): readonly MirrorAgentSnapshot[] | Promise<readonly MirrorAgentSnapshot[]> {
		return this.service.listMirrorSnapshots();
	}

	subscribe(listener: MirrorObservationListener): MirrorObservationUnsubscribe {
		return this.service.subscribeToMirrorEvents((event) => listener(toMirrorObservation(event)));
	}
}

function toMirrorObservation(event: PiSubagentsMirrorEvent): MirrorObservationEvent {
	switch (event.type) {
		case PI_SUBAGENTS_MIRROR_EVENT_TYPE.AGENT_SNAPSHOT:
			return { type: MIRROR_OBSERVATION_EVENT_TYPE.SNAPSHOT, agent: event.agent };
		case PI_SUBAGENTS_MIRROR_EVENT_TYPE.STATUS:
			return { type: MIRROR_OBSERVATION_EVENT_TYPE.STATUS, agentId: event.agentId, status: event.status };
		case PI_SUBAGENTS_MIRROR_EVENT_TYPE.ASSISTANT_TEXT_DELTA:
			return { type: MIRROR_OBSERVATION_EVENT_TYPE.ASSISTANT_TEXT_DELTA, agentId: event.agentId, delta: event.delta };
	}
}
