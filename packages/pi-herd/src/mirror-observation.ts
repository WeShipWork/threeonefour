import type { MirrorAgentSnapshot, SubagentStatus } from "./mirror-types.js";

export const MIRROR_OBSERVATION_EVENT_TYPE = {
	SNAPSHOT: "snapshot",
	STATUS: "status",
	ASSISTANT_TEXT_DELTA: "assistant_text_delta",
} as const;

export type MirrorObservationEventType = (typeof MIRROR_OBSERVATION_EVENT_TYPE)[keyof typeof MIRROR_OBSERVATION_EVENT_TYPE];

export interface MirrorSnapshotObservationEvent {
	type: typeof MIRROR_OBSERVATION_EVENT_TYPE.SNAPSHOT;
	agent: MirrorAgentSnapshot;
}

export interface MirrorStatusObservationEvent {
	type: typeof MIRROR_OBSERVATION_EVENT_TYPE.STATUS;
	agentId: string;
	status: SubagentStatus;
}

export interface MirrorAssistantTextDeltaObservationEvent {
	type: typeof MIRROR_OBSERVATION_EVENT_TYPE.ASSISTANT_TEXT_DELTA;
	agentId: string;
	delta: string;
}

export type MirrorObservationEvent =
	| MirrorSnapshotObservationEvent
	| MirrorStatusObservationEvent
	| MirrorAssistantTextDeltaObservationEvent;

export type MirrorObservationListener = (event: MirrorObservationEvent) => void | Promise<void>;

export type MirrorObservationUnsubscribe = () => void;

export interface MirrorObservationSource {
	listAgents(): readonly MirrorAgentSnapshot[] | Promise<readonly MirrorAgentSnapshot[]>;
	subscribe(listener: MirrorObservationListener): MirrorObservationUnsubscribe;
}
