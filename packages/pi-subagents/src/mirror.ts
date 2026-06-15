/**
 * mirror.ts — Read-only mirror observation API for external transcript viewers.
 */

import type { AgentRecord } from "./types.js";

export const PI_SUBAGENTS_MIRROR_EVENT_TYPE = {
  AGENT_SNAPSHOT: "agent_snapshot",
  STATUS: "status",
  ASSISTANT_TEXT_DELTA: "assistant_text_delta",
} as const;

export type PiSubagentsMirrorEventType =
  (typeof PI_SUBAGENTS_MIRROR_EVENT_TYPE)[keyof typeof PI_SUBAGENTS_MIRROR_EVENT_TYPE];

export interface PiSubagentsMirrorSnapshot {
  id: string;
  type: string;
  description: string;
  status: AgentRecord["status"];
  assistantText: string;
  updatedAt: number;
  result?: string;
  error?: string;
}

export interface PiSubagentsMirrorSnapshotEvent {
  type: typeof PI_SUBAGENTS_MIRROR_EVENT_TYPE.AGENT_SNAPSHOT;
  agent: PiSubagentsMirrorSnapshot;
}

export interface PiSubagentsMirrorStatusEvent {
  type: typeof PI_SUBAGENTS_MIRROR_EVENT_TYPE.STATUS;
  agentId: string;
  status: AgentRecord["status"];
}

export interface PiSubagentsMirrorAssistantTextDeltaEvent {
  type: typeof PI_SUBAGENTS_MIRROR_EVENT_TYPE.ASSISTANT_TEXT_DELTA;
  agentId: string;
  delta: string;
}

export type PiSubagentsMirrorEvent =
  | PiSubagentsMirrorSnapshotEvent
  | PiSubagentsMirrorStatusEvent
  | PiSubagentsMirrorAssistantTextDeltaEvent;

export type PiSubagentsMirrorListener = (event: PiSubagentsMirrorEvent) => void | Promise<void>;

export type PiSubagentsMirrorUnsubscribe = () => void;

export interface PiSubagentsMirrorService {
  listMirrorSnapshots(): readonly PiSubagentsMirrorSnapshot[];
  subscribeToMirrorEvents(listener: PiSubagentsMirrorListener): PiSubagentsMirrorUnsubscribe;
}

export interface PiSubagentsMirrorHub extends PiSubagentsMirrorService {
  publish(event: PiSubagentsMirrorEvent): void;
}

interface SessionMessagePart {
  type?: string;
  text?: string;
}

interface SessionMessage {
  role?: string;
  content?: string | readonly SessionMessagePart[];
}

interface SessionWithMessages {
  messages?: readonly SessionMessage[];
}

export function createMirrorEventHub(listRecords: () => readonly AgentRecord[]): PiSubagentsMirrorHub {
  const listeners = new Set<PiSubagentsMirrorListener>();
  return {
    listMirrorSnapshots: () => listRecords().map(agentRecordToMirrorSnapshot),
    subscribeToMirrorEvents: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish: (event) => {
      for (const listener of listeners) {
        Promise.resolve(listener(event)).catch(() => undefined);
      }
    },
  };
}

export function agentRecordToMirrorSnapshot(record: AgentRecord): PiSubagentsMirrorSnapshot {
  return {
    id: record.id,
    type: record.type,
    description: record.description,
    status: record.status,
    assistantText: extractAssistantText(record.session as SessionWithMessages | undefined),
    updatedAt: record.completedAt ?? record.startedAt,
    result: record.result,
    error: record.error,
  };
}

function extractAssistantText(session: SessionWithMessages | undefined): string {
  const messages = session?.messages ?? [];
  const chunks: string[] = [];
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    const text = extractMessageText(message.content);
    if (text) chunks.push(text);
  }
  return chunks.join("\n");
}

function extractMessageText(content: SessionMessage["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => part.text ?? "")
    .filter((text) => text.length > 0)
    .join("");
}
