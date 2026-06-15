import { createServer, type Server, type Socket } from "node:net";
import { rm } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { MIRROR_EVENT_TYPE, type MirrorAgentSnapshot, type MirrorEvent, type MirrorSubscribeRequest } from "./mirror-types.js";

export interface MirrorServerOptions {
	socketPath: string;
}

interface MirrorClient {
	socket: Socket;
	agentId?: string;
}

function encodeEvent(event: MirrorEvent): string {
	return `${JSON.stringify(event)}\n`;
}

function shouldSendToClient(event: MirrorEvent, agentId: string | undefined): boolean {
	if (event.type === MIRROR_EVENT_TYPE.ERROR) return event.agentId == null || event.agentId === agentId;
	if (event.type === MIRROR_EVENT_TYPE.SNAPSHOT) return event.agent.id === agentId;
	return event.agentId === agentId;
}

function parseSubscribeRequest(line: string): MirrorSubscribeRequest {
	const value = JSON.parse(line) as Partial<MirrorSubscribeRequest>;
	if (typeof value.agentId !== "string" || value.agentId.length === 0) {
		throw new Error("Mirror subscribe request requires agentId.");
	}
	return { agentId: value.agentId };
}

export class MirrorServer {
	private server: Server | undefined;
	private readonly clients = new Set<MirrorClient>();
	private readonly snapshots = new Map<string, MirrorAgentSnapshot>();

	constructor(private readonly options: MirrorServerOptions) {}

	async start(): Promise<void> {
		if (this.server) return;
		mkdirSync(dirname(this.options.socketPath), { recursive: true });
		await rm(this.options.socketPath, { force: true });
		this.server = createServer((socket) => this.handleConnection(socket));
		await new Promise<void>((resolve, reject) => {
			this.server?.once("error", reject);
			this.server?.listen(this.options.socketPath, () => {
				this.server?.off("error", reject);
				resolve();
			});
		});
	}

	async stop(): Promise<void> {
		for (const client of this.clients) client.socket.destroy();
		this.clients.clear();
		const server = this.server;
		this.server = undefined;
		if (server) {
			await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
		}
		await rm(this.options.socketPath, { force: true });
	}

	upsertSnapshot(snapshot: MirrorAgentSnapshot): void {
		this.snapshots.set(snapshot.id, snapshot);
	}

	async publish(event: MirrorEvent): Promise<void> {
		if (event.type === MIRROR_EVENT_TYPE.ASSISTANT_TEXT_DELTA) {
			const snapshot = this.snapshots.get(event.agentId);
			if (snapshot) {
				this.snapshots.set(event.agentId, {
					...snapshot,
					assistantText: snapshot.assistantText + event.delta,
					updatedAt: Date.now(),
				});
			}
		}
		if (event.type === MIRROR_EVENT_TYPE.STATUS) {
			const snapshot = this.snapshots.get(event.agentId);
			if (snapshot) {
				this.snapshots.set(event.agentId, { ...snapshot, status: event.status, updatedAt: Date.now() });
			}
		}
		for (const client of this.clients) {
			if (!shouldSendToClient(event, client.agentId)) continue;
			client.socket.write(encodeEvent(event));
		}
	}

	private handleConnection(socket: Socket): void {
		const client: MirrorClient = { socket };
		this.clients.add(client);
		let buffer = "";
		socket.setEncoding("utf8");
		socket.on("data", (chunk) => {
			buffer += chunk;
			const newline = buffer.indexOf("\n");
			if (newline === -1 || client.agentId) return;
			const line = buffer.slice(0, newline);
			try {
				const request = parseSubscribeRequest(line);
				client.agentId = request.agentId;
				const snapshot = this.snapshots.get(request.agentId);
				if (snapshot) {
					socket.write(encodeEvent({ type: MIRROR_EVENT_TYPE.SNAPSHOT, agent: snapshot, sequence: 0 }));
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : "Invalid mirror subscribe request.";
				socket.write(encodeEvent({ type: MIRROR_EVENT_TYPE.ERROR, message, sequence: 0 }));
				socket.end();
			}
		});
		socket.on("close", () => this.clients.delete(client));
		socket.on("error", () => this.clients.delete(client));
	}
}
