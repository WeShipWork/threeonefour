import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { connect, type Socket } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MirrorBridge } from "../src/mirror-bridge.js";
import { MIRROR_EVENT_TYPE, SUBAGENT_STATUS, type MirrorAgentSnapshot, type MirrorEvent } from "../src/mirror-types.js";
import {
	MIRROR_OBSERVATION_EVENT_TYPE,
	type MirrorObservationEvent,
	type MirrorObservationListener,
	type MirrorObservationSource,
} from "../src/mirror-observation.js";
import { MirrorServer } from "../src/mirror-server.js";

const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
	tempDirs.length = 0;
});

async function tempSocketPath(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "pi-herd-"));
	tempDirs.push(dir);
	return join(dir, "mirror.sock");
}

interface EventStream {
	next(): Promise<MirrorEvent>;
	close(): void;
}

async function openEventStream(socketPath: string, agentId: string): Promise<EventStream> {
	const socket = connect(socketPath);
	const events: MirrorEvent[] = [];
	const waiters: Array<(event: MirrorEvent) => void> = [];
	let buffer = "";
	socket.setEncoding("utf8");
	socket.on("data", (chunk) => {
		buffer += chunk;
		for (;;) {
			const newline = buffer.indexOf("\n");
			if (newline === -1) break;
			const line = buffer.slice(0, newline);
			buffer = buffer.slice(newline + 1);
			if (!line.trim()) continue;
			const event = JSON.parse(line) as MirrorEvent;
			const waiter = waiters.shift();
			if (waiter) waiter(event);
			else events.push(event);
		}
	});
	await new Promise<void>((resolve, reject) => {
		socket.once("connect", resolve);
		socket.once("error", reject);
	});
	socket.write(`${JSON.stringify({ agentId })}\n`);
	return {
		next: () => {
			const event = events.shift();
			if (event) return Promise.resolve(event);
			return new Promise((resolve) => waiters.push(resolve));
		},
		close: () => socket.end(),
	};
}

class FakeObservationSource implements MirrorObservationSource {
	private readonly listeners = new Set<MirrorObservationListener>();

	constructor(private readonly agents: readonly MirrorAgentSnapshot[]) {}

	listAgents(): readonly MirrorAgentSnapshot[] {
		return this.agents;
	}

	subscribe(listener: MirrorObservationListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	async emit(event: MirrorObservationEvent): Promise<void> {
		await Promise.all([...this.listeners].map((listener) => listener(event)));
	}
}

describe("MirrorBridge", () => {
	it("bridges observed Subagent snapshots and live updates to mirror viewers", async () => {
		const socketPath = await tempSocketPath();
		const source = new FakeObservationSource([{
			id: "agent-1",
			type: "Explore",
			description: "Inspect package layout",
			status: SUBAGENT_STATUS.RUNNING,
			assistantText: "Initial notes.",
			updatedAt: 1,
		}]);
		const server = new MirrorServer({ socketPath });
		const bridge = new MirrorBridge({ source, server });
		await bridge.start();
		try {
			const stream = await openEventStream(socketPath, "agent-1");
			try {
				assert.deepEqual(await stream.next(), {
					type: MIRROR_EVENT_TYPE.SNAPSHOT,
					agent: {
						id: "agent-1",
						type: "Explore",
						description: "Inspect package layout",
						status: SUBAGENT_STATUS.RUNNING,
						assistantText: "Initial notes.",
						updatedAt: 1,
					},
					sequence: 0,
				});

				await source.emit({
					type: MIRROR_OBSERVATION_EVENT_TYPE.ASSISTANT_TEXT_DELTA,
					agentId: "agent-1",
					delta: " More notes.",
				});
				assert.deepEqual(await stream.next(), {
					type: MIRROR_EVENT_TYPE.ASSISTANT_TEXT_DELTA,
					agentId: "agent-1",
					delta: " More notes.",
					sequence: 1,
				});

				await source.emit({
					type: MIRROR_OBSERVATION_EVENT_TYPE.STATUS,
					agentId: "agent-1",
					status: SUBAGENT_STATUS.COMPLETED,
				});
				assert.deepEqual(await stream.next(), {
					type: MIRROR_EVENT_TYPE.STATUS,
					agentId: "agent-1",
					status: SUBAGENT_STATUS.COMPLETED,
					sequence: 2,
				});
			} finally {
				stream.close();
			}
		} finally {
			await bridge.stop();
		}
	});
});
