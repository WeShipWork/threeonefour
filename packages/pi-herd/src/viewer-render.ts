import { MIRROR_EVENT_TYPE, type MirrorEvent } from "./mirror-types.js";

export function renderMirrorEvent(event: MirrorEvent): string {
	switch (event.type) {
		case MIRROR_EVENT_TYPE.SNAPSHOT: {
			const header = `[${event.agent.status}] ${event.agent.type} — ${event.agent.description}`;
			return event.agent.assistantText ? `${header}\n${event.agent.assistantText}` : header;
		}
		case MIRROR_EVENT_TYPE.STATUS:
			return `\n[${event.status}]`;
		case MIRROR_EVENT_TYPE.ASSISTANT_TEXT_DELTA:
			return event.delta;
		case MIRROR_EVENT_TYPE.ERROR:
			return `\n[mirror error] ${event.message}\n`;
	}
}
