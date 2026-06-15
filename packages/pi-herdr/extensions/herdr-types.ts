import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import type { Static } from "typebox";

export const AGENT_STATUS = {
	IDLE: "idle",
	WORKING: "working",
	BLOCKED: "blocked",
	DONE: "done",
	UNKNOWN: "unknown",
} as const;

export type AgentStatus = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS];

export const READ_SOURCE = {
	VISIBLE: "visible",
	RECENT: "recent",
	RECENT_UNWRAPPED: "recent-unwrapped",
} as const;

export type ReadSource = (typeof READ_SOURCE)[keyof typeof READ_SOURCE];

export const HERDR_PANE_READ_SOURCE = {
	VISIBLE: "visible",
	RECENT: "recent",
	RECENT_UNWRAPPED: "recent_unwrapped",
} as const;

export type HerdrPaneReadSource = (typeof HERDR_PANE_READ_SOURCE)[keyof typeof HERDR_PANE_READ_SOURCE];

export const HERDR_ACTION = {
	LIST: "list",
	WORKSPACE_LIST: "workspace_list",
	WORKSPACE_CREATE: "workspace_create",
	WORKSPACE_FOCUS: "workspace_focus",
	TAB_LIST: "tab_list",
	TAB_CREATE: "tab_create",
	TAB_FOCUS: "tab_focus",
	FOCUS: "focus",
	PANE_SPLIT: "pane_split",
	RUN: "run",
	READ: "read",
	WATCH: "watch",
	WAIT_AGENT: "wait_agent",
	SEND: "send",
	STOP: "stop",
} as const;

export type HerdrAction = (typeof HERDR_ACTION)[keyof typeof HERDR_ACTION];

export const SPLIT_DIRECTION = {
	RIGHT: "right",
	DOWN: "down",
} as const;

export const WAIT_MODE = {
	ALL: "all",
	ANY: "any",
} as const;

export interface HerdrErrorPayload {
	code?: string;
	message?: string;
}

export interface WorkspaceInfo {
	workspace_id: string;
	number: number;
	label: string;
	focused: boolean;
	pane_count: number;
	tab_count: number;
	active_tab_id: string;
	agent_status: AgentStatus;
}

export interface TabInfo {
	tab_id: string;
	workspace_id: string;
	number: number;
	label: string;
	focused: boolean;
	pane_count: number;
	agent_status: AgentStatus;
}

export interface PaneInfo {
	pane_id: string;
	workspace_id: string;
	tab_id: string;
	focused: boolean;
	cwd?: string;
	agent?: string;
	agent_status: AgentStatus;
	revision: number;
}

export interface PaneReadResult {
	pane_id: string;
	workspace_id: string;
	tab_id: string;
	source: HerdrPaneReadSource;
	text: string;
	revision: number;
	truncated: boolean;
}

export interface ManagedPane {
	paneId: string;
	workspaceId: string;
}

export interface HerdrJsonEnvelope {
	id?: string;
	result?: unknown;
	error?: HerdrErrorPayload;
}

export interface HerdrToolDetails {
	action?: HerdrAction;
	aliases: Record<string, ManagedPane>;
	aliasOrder: string[];
	[key: string]: unknown;
}

export interface StyleTheme {
	fg(color: string, text: string): string;
	bold(text: string): string;
}

export interface WatchRenderState {
	watchElapsed?: number;
}

const ActionEnum = StringEnum(
	[
		HERDR_ACTION.LIST,
		HERDR_ACTION.WORKSPACE_LIST,
		HERDR_ACTION.WORKSPACE_CREATE,
		HERDR_ACTION.WORKSPACE_FOCUS,
		HERDR_ACTION.TAB_LIST,
		HERDR_ACTION.TAB_CREATE,
		HERDR_ACTION.TAB_FOCUS,
		HERDR_ACTION.FOCUS,
		HERDR_ACTION.PANE_SPLIT,
		HERDR_ACTION.RUN,
		HERDR_ACTION.READ,
		HERDR_ACTION.WATCH,
		HERDR_ACTION.WAIT_AGENT,
		HERDR_ACTION.SEND,
		HERDR_ACTION.STOP,
	] as const,
	{ description: "Action to perform" },
);

const StatusEnum = StringEnum([
	AGENT_STATUS.IDLE,
	AGENT_STATUS.WORKING,
	AGENT_STATUS.BLOCKED,
	AGENT_STATUS.DONE,
	AGENT_STATUS.UNKNOWN,
] as const, {
	description: "Agent status to wait for",
});

const SourceEnum = StringEnum([READ_SOURCE.VISIBLE, READ_SOURCE.RECENT, READ_SOURCE.RECENT_UNWRAPPED] as const, {
	description: "Read source for read/watch",
});

const DirectionEnum = StringEnum([SPLIT_DIRECTION.RIGHT, SPLIT_DIRECTION.DOWN] as const, {
	description: "Split direction for pane_split. Defaults to right.",
});

const WaitModeEnum = StringEnum([WAIT_MODE.ALL, WAIT_MODE.ANY] as const, {
	description: "How multi-pane waits should resolve",
});

export const HerdrToolParameters = Type.Object({
	action: ActionEnum,
	pane: Type.Optional(Type.String({ description: "Friendly pane alias or explicit pane id. For pane_split, omit to split the agent's own pane." })),
	panes: Type.Optional(Type.Array(Type.String(), { description: "Pane aliases or pane ids for multi-pane waits" })),
	workspace: Type.Optional(Type.String({ description: "Workspace id for workspace or tab actions" })),
	tab: Type.Optional(Type.String({ description: "Tab id for tab actions or focus(tab) only. Pane actions must use pane ids or aliases." })),
	label: Type.Optional(Type.String({ description: "Workspace or tab label for create actions" })),
	newPane: Type.Optional(Type.String({ description: "Alias to remember for the pane created by pane_split" })),
	direction: Type.Optional(DirectionEnum),
	command: Type.Optional(Type.String({ description: "Line to submit atomically with Enter (for run action)" })),
	match: Type.Optional(Type.String({ description: "Text or regex to wait for (for watch action)" })),
	regex: Type.Optional(Type.Boolean({ description: "Treat match as a regex (for watch action)" })),
	status: Type.Optional(StatusEnum),
	statuses: Type.Optional(Type.Array(StatusEnum, { description: "Accepted agent statuses for wait_agent" })),
	mode: Type.Optional(WaitModeEnum),
	timeout: Type.Optional(Type.Number({ description: "Timeout in ms (for watch or wait_agent action)" })),
	lines: Type.Optional(Type.Number({ description: "Scrollback lines to capture or inspect" })),
	source: Type.Optional(SourceEnum),
	raw: Type.Optional(Type.Boolean({ description: "Disable ANSI stripping for read/watch" })),
	text: Type.Optional(Type.String({ description: "Literal text to send without Enter (for send action). Use run if you want text plus Enter atomically." })),
	keys: Type.Optional(
		Type.String({
			description: "Keys to send, space-separated (for send action). Examples: C-c, Enter, q, y",
		}),
	),
	cwd: Type.Optional(Type.String({ description: "Working directory for workspace_create, tab_create, and pane_split where supported" })),
	focus: Type.Optional(Type.Boolean({ description: "Explicitly change focus for create/focus actions. Defaults should preserve current focus." })),
});

export type HerdrToolInput = Static<typeof HerdrToolParameters>;
