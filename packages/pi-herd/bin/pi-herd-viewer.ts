#!/usr/bin/env node
import { streamMirrorEvents } from "../src/mirror-client.js";
import { renderMirrorEvent } from "../src/viewer-render.js";

interface ViewerArgs {
	socketPath: string;
	agentId: string;
}

function parseArgs(argv: string[]): ViewerArgs {
	const socketIndex = argv.indexOf("--socket");
	const agentIndex = argv.indexOf("--agent-id");
	const socketPath = socketIndex === -1 ? undefined : argv[socketIndex + 1];
	const agentId = agentIndex === -1 ? undefined : argv[agentIndex + 1];
	if (!socketPath || !agentId) {
		throw new Error("Usage: pi-herd-viewer --socket <path> --agent-id <id>");
	}
	return { socketPath, agentId };
}

try {
	const args = parseArgs(process.argv.slice(2));
	await streamMirrorEvents(args, (event) => process.stdout.write(renderMirrorEvent(event)));
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(`${message}\n`);
	process.exitCode = 1;
}
