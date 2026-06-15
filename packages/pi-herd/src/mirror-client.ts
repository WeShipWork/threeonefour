import { connect, type Socket } from "node:net";
import type { MirrorEvent } from "./mirror-types.js";

export interface MirrorClientOptions {
	socketPath: string;
	agentId: string;
}

export async function streamMirrorEvents(
	options: MirrorClientOptions,
	onEvent: (event: MirrorEvent) => void,
): Promise<Socket> {
	const socket = connect(options.socketPath);
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
			onEvent(JSON.parse(line) as MirrorEvent);
		}
	});
	await new Promise<void>((resolve, reject) => {
		socket.once("connect", resolve);
		socket.once("error", reject);
	});
	socket.write(`${JSON.stringify({ agentId: options.agentId })}\n`);
	return socket;
}
