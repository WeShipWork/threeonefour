import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, type Socket } from "node:net";
import { MirrorServer } from "../src/mirror-server.js";
import { MIRROR_EVENT_TYPE, SUBAGENT_STATUS, type MirrorEvent } from "../src/mirror-types.js";

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
	socket.write(JSON.stringify({ agentId }) + "\n");
	return {
		next: () => {
			const event = events.shift();
			if (event) return Promise.resolve(event);
			return new Promise((resolve) => waiters.push(resolve));
		},
		close: () => socket.end(),
	};
}

describe("MirrorServer", () => {
	it("streams a Subagent snapshot followed by live assistant text over a Unix socket", async () => {
		const socketPath = await tempSocketPath();
		const server = new MirrorServer({ socketPath });
		await server.start();
		try {
			server.upsertSnapshot({
				id: "agent-1",
				type: "Explore",
				description: "Inspect package layout",
				status: SUBAGENT_STATUS.RUNNING,
				assistantText: "",
				updatedAt: 1,
			});

			const stream = await openEventStream(socketPath, "agent-1");
			try {
				assert.deepEqual(await stream.next(), {
					type: MIRROR_EVENT_TYPE.SNAPSHOT,
					agent: {
						id: "agent-1",
						type: "Explore",
						description: "Inspect package layout",
						status: SUBAGENT_STATUS.RUNNING,
						assistantText: "",
						updatedAt: 1,
					},
					sequence: 0,
				});

				await server.publish({
					type: MIRROR_EVENT_TYPE.ASSISTANT_TEXT_DELTA,
					agentId: "agent-1",
					delta: "Found packages/pi-herdr.",
					sequence: 1,
				});

				assert.deepEqual(await stream.next(), {
					type: MIRROR_EVENT_TYPE.ASSISTANT_TEXT_DELTA,
					agentId: "agent-1",
					delta: "Found packages/pi-herdr.",
					sequence: 1,
				});
			} finally {
				stream.close();
			}
		} finally {
			await server.stop();
		}
	});
});
