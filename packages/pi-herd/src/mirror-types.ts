export const SUBAGENT_STATUS = {
	QUEUED: "queued",
	RUNNING: "running",
	COMPLETED: "completed",
	ABORTED: "aborted",
	STEERED: "steered",
	ERROR: "error",
	STOPPED: "stopped",
} as const;

export type SubagentStatus = (typeof SUBAGENT_STATUS)[keyof typeof SUBAGENT_STATUS];

export const MIRROR_EVENT_TYPE = {
	SNAPSHOT: "snapshot",
	STATUS: "status",
	ASSISTANT_TEXT_DELTA: "assistant_text_delta",
	ERROR: "error",
} as const;

export type MirrorEventType = (typeof MIRROR_EVENT_TYPE)[keyof typeof MIRROR_EVENT_TYPE];

export interface MirrorAgentSnapshot {
	id: string;
	type: string;
	description: string;
	status: SubagentStatus;
	assistantText: string;
	updatedAt: number;
	result?: string;
	error?: string;
}

export interface SnapshotMirrorEvent {
	type: typeof MIRROR_EVENT_TYPE.SNAPSHOT;
	agent: MirrorAgentSnapshot;
	sequence: number;
}

export interface StatusMirrorEvent {
	type: typeof MIRROR_EVENT_TYPE.STATUS;
	agentId: string;
	status: SubagentStatus;
	sequence: number;
}

export interface AssistantTextDeltaMirrorEvent {
	type: typeof MIRROR_EVENT_TYPE.ASSISTANT_TEXT_DELTA;
	agentId: string;
	delta: string;
	sequence: number;
}

export interface ErrorMirrorEvent {
	type: typeof MIRROR_EVENT_TYPE.ERROR;
	agentId?: string;
	message: string;
	sequence: number;
}

export type MirrorEvent = SnapshotMirrorEvent | StatusMirrorEvent | AssistantTextDeltaMirrorEvent | ErrorMirrorEvent;

export interface MirrorSubscribeRequest {
	agentId: string;
}
