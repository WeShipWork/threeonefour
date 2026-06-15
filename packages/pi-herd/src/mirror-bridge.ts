import { MIRROR_EVENT_TYPE, type MirrorEvent } from "./mirror-types.js";
import type { MirrorObservationEvent, MirrorObservationSource, MirrorObservationUnsubscribe } from "./mirror-observation.js";
import { MIRROR_OBSERVATION_EVENT_TYPE } from "./mirror-observation.js";
import type { MirrorServer } from "./mirror-server.js";

export interface MirrorBridgeOptions {
	source: MirrorObservationSource;
	server: MirrorServer;
}

export class MirrorBridge {
	private unsubscribe: MirrorObservationUnsubscribe | undefined;
	private sequence = 1;
	private started = false;

	constructor(private readonly options: MirrorBridgeOptions) {}

	async start(): Promise<void> {
		if (this.started) return;
		this.started = true;
		await this.options.server.start();
		this.unsubscribe = this.options.source.subscribe((event) => this.handleObservation(event));
		const agents = await this.options.source.listAgents();
		for (const agent of agents) {
			this.options.server.upsertSnapshot(agent);
		}
	}

	async stop(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.started = false;
		await this.options.server.stop();
	}

	private async handleObservation(event: MirrorObservationEvent): Promise<void> {
		if (event.type === MIRROR_OBSERVATION_EVENT_TYPE.SNAPSHOT) {
			this.options.server.upsertSnapshot(event.agent);
			return;
		}
		await this.options.server.publish(this.toMirrorEvent(event));
	}

	private toMirrorEvent(event: Exclude<MirrorObservationEvent, { type: typeof MIRROR_OBSERVATION_EVENT_TYPE.SNAPSHOT }>): MirrorEvent {
		const sequence = this.sequence;
		this.sequence += 1;
		switch (event.type) {
			case MIRROR_OBSERVATION_EVENT_TYPE.STATUS:
				return { type: MIRROR_EVENT_TYPE.STATUS, agentId: event.agentId, status: event.status, sequence };
			case MIRROR_OBSERVATION_EVENT_TYPE.ASSISTANT_TEXT_DELTA:
				return { type: MIRROR_EVENT_TYPE.ASSISTANT_TEXT_DELTA, agentId: event.agentId, delta: event.delta, sequence };
		}
	}
}
