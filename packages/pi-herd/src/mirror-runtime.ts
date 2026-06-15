import type { HerdrMirrorPaneLauncher } from "./herdr-pane-launcher.js";
import { MirrorBridge } from "./mirror-bridge.js";
import {
	MIRROR_OBSERVATION_EVENT_TYPE,
	type MirrorObservationEvent,
	type MirrorObservationSource,
	type MirrorObservationUnsubscribe,
} from "./mirror-observation.js";
import type { MirrorServer } from "./mirror-server.js";
import type { MirrorAgentSnapshot } from "./mirror-types.js";

export interface MirrorPaneLauncher {
	launch(agent: MirrorAgentSnapshot, socketPath: string): Promise<string>;
	closeAll(): Promise<void>;
}

export interface MirrorRuntimeOptions {
	source: MirrorObservationSource;
	server: MirrorServer;
	launcher: MirrorPaneLauncher | HerdrMirrorPaneLauncher;
	socketPath: string;
}

export class MirrorRuntime {
	private readonly bridge: MirrorBridge;
	private readonly launchedAgentIds = new Set<string>();
	private unsubscribe: MirrorObservationUnsubscribe | undefined;
	private started = false;

	constructor(private readonly options: MirrorRuntimeOptions) {
		this.bridge = new MirrorBridge({ source: options.source, server: options.server });
	}

	async start(): Promise<void> {
		if (this.started) return;
		this.started = true;
		this.unsubscribe = this.options.source.subscribe((event) => this.handleObservation(event));
		await this.bridge.start();
		const agents = await this.options.source.listAgents();
		await Promise.all(agents.map((agent) => this.launchOnce(agent)));
	}

	async stop(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.launchedAgentIds.clear();
		this.started = false;
		await Promise.all([
			this.bridge.stop(),
			this.options.launcher.closeAll(),
		]);
	}

	private async handleObservation(event: MirrorObservationEvent): Promise<void> {
		if (event.type !== MIRROR_OBSERVATION_EVENT_TYPE.SNAPSHOT) return;
		await this.launchOnce(event.agent);
	}

	private async launchOnce(agent: MirrorAgentSnapshot): Promise<void> {
		if (this.launchedAgentIds.has(agent.id)) return;
		this.launchedAgentIds.add(agent.id);
		try {
			await this.options.launcher.launch(agent, this.options.socketPath);
		} catch (error) {
			this.launchedAgentIds.delete(agent.id);
			throw error;
		}
	}
}
