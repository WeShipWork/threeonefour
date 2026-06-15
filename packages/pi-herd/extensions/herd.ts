import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HerdrMirrorPaneLauncher } from "../src/herdr-pane-launcher.js";
import { MirrorRuntime } from "../src/mirror-runtime.js";
import type { MirrorObservationSource } from "../src/mirror-observation.js";
import { MirrorServer } from "../src/mirror-server.js";
import { PiSubagentsObservationSource, type PiSubagentsMirrorService } from "../src/pi-subagents-observation-source.js";

export const PI_HERD_OBSERVATION_SOURCE_KEY = "__piHerdObservationSource";
export const PI_SUBAGENTS_MIRROR_SERVICE_KEY = "__piSubagentsMirrorService";

export type MirrorObservationSourceResolver = () => MirrorObservationSource | undefined;

export function installPiHerdObservationSource(source: MirrorObservationSource): void {
	Reflect.set(globalThis, PI_HERD_OBSERVATION_SOURCE_KEY, source);
}

export function resolveGlobalObservationSource(): MirrorObservationSource | undefined {
	const directSource = Reflect.get(globalThis, PI_HERD_OBSERVATION_SOURCE_KEY) as unknown;
	if (isMirrorObservationSource(directSource)) return directSource;

	const piSubagentsService = Reflect.get(globalThis, PI_SUBAGENTS_MIRROR_SERVICE_KEY) as unknown;
	if (!isPiSubagentsMirrorService(piSubagentsService)) return undefined;
	return new PiSubagentsObservationSource(piSubagentsService);
}

export function createPiHerdExtension(resolveSource: MirrorObservationSourceResolver = resolveGlobalObservationSource) {
	return function piHerdExtension(pi: ExtensionAPI): void {
		const herdrEnv = process.env.HERDR_ENV;
		const currentPaneId = process.env.HERDR_PANE_ID;
		if (!herdrEnv || !currentPaneId) return;

		let runtime: MirrorRuntime | undefined;

		pi.on("session_start", async () => {
			const source = resolveSource();
			if (!source || runtime) return;
			const socketPath = join(tmpdir(), `pi-herd-${process.pid}-${Date.now()}.sock`);
			const server = new MirrorServer({ socketPath });
			const launcher = new HerdrMirrorPaneLauncher({ pi, currentPaneId });
			runtime = new MirrorRuntime({ source, server, launcher, socketPath });
			await runtime.start();
		});

		pi.on("session_shutdown", async () => {
			const activeRuntime = runtime;
			runtime = undefined;
			await activeRuntime?.stop();
		});
	};
}

function isMirrorObservationSource(value: unknown): value is MirrorObservationSource {
	return (
		typeof value === "object" &&
		value !== null &&
		"listAgents" in value &&
		"subscribe" in value &&
		typeof value.listAgents === "function" &&
		typeof value.subscribe === "function"
	);
}

function isPiSubagentsMirrorService(value: unknown): value is PiSubagentsMirrorService {
	return (
		typeof value === "object" &&
		value !== null &&
		"listMirrorSnapshots" in value &&
		"subscribeToMirrorEvents" in value &&
		typeof value.listMirrorSnapshots === "function" &&
		typeof value.subscribeToMirrorEvents === "function"
	);
}

export default createPiHerdExtension();
