import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { MirrorAgentSnapshot } from "./mirror-types.js";

export interface PiExecResult {
	code: number;
	stdout: string;
	stderr: string;
	killed?: boolean;
}

export interface PiExecutor {
	exec(command: string, args: readonly string[], options?: { signal?: AbortSignal }): Promise<PiExecResult>;
}

export interface HerdrMirrorPaneLauncherOptions {
	pi: PiExecutor;
	currentPaneId: string;
	signal?: AbortSignal;
}

interface HerdrPaneEnvelope {
	result?: HerdrPaneResult;
	error?: HerdrErrorResult;
}

interface HerdrPaneResult {
	pane?: HerdrPaneInfo;
}

interface HerdrTabEnvelope {
	result?: HerdrTabResult;
	error?: HerdrErrorResult;
}

interface HerdrTabResult {
	tab?: HerdrTabInfo;
	root_pane?: HerdrPaneInfo;
}

interface HerdrTabInfo {
	tab_id?: string;
}

interface HerdrPaneInfo {
	pane_id?: string;
}

interface HerdrErrorResult {
	code?: string;
	message?: string;
}

interface CategoryTab {
	tabId: string;
	rootPaneId: string;
	paneIds: string[];
}

const AGENT_CATEGORY_RULES = [
	{ pattern: /scout|explore|research|inspect|search|find/i, label: "scouts" },
	{ pattern: /debug|diagnos|triage|bug|fix/i, label: "debuggers" },
	{ pattern: /plan|architect|design/i, label: "planners" },
	{ pattern: /review|audit|security/i, label: "reviewers" },
	{ pattern: /test|qa|spec/i, label: "testers" },
	{ pattern: /doc|write|readme/i, label: "documenters" },
] as const;

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", "'\\''")}'`;
}

function viewerCommand(socketPath: string, agentId: string): string {
	const sourceDir = dirname(fileURLToPath(import.meta.url));
	const packageDir = dirname(sourceDir);
	const viewerPath = fileURLToPath(new URL("../bin/pi-herd-viewer.ts", import.meta.url));
	return [
		"pnpm",
		"--dir",
		shellQuote(packageDir),
		"exec",
		"tsx",
		shellQuote(viewerPath),
		"--socket",
		shellQuote(socketPath),
		"--agent-id",
		shellQuote(agentId),
	].join(" ");
}

function parseSplitPaneId(stdout: string): string {
	let envelope: HerdrPaneEnvelope;
	try {
		envelope = JSON.parse(stdout) as HerdrPaneEnvelope;
	} catch {
		throw new Error("Failed to parse Herdr pane split response.");
	}
	if (envelope.error) {
		throw new Error(envelope.error.message || envelope.error.code || "Herdr pane split failed.");
	}
	const paneId = envelope.result?.pane?.pane_id;
	if (!paneId) throw new Error("Herdr pane split response did not include a pane id.");
	return paneId;
}

function parseCreatedTab(stdout: string): CategoryTab {
	let envelope: HerdrTabEnvelope;
	try {
		envelope = JSON.parse(stdout) as HerdrTabEnvelope;
	} catch {
		throw new Error("Failed to parse Herdr tab create response.");
	}
	if (envelope.error) {
		throw new Error(envelope.error.message || envelope.error.code || "Herdr tab create failed.");
	}
	const tabId = envelope.result?.tab?.tab_id;
	const paneId = envelope.result?.root_pane?.pane_id;
	if (!tabId) throw new Error("Herdr tab create response did not include a tab id.");
	if (!paneId) throw new Error("Herdr tab create response did not include a root pane id.");
	return { tabId, rootPaneId: paneId, paneIds: [] };
}

function normalizeCategoryFallback(type: string): string {
	const words = type
		.trim()
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, " ")
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	const base = words.at(-1) ?? "agents";
	if (base.endsWith("s")) return base;
	if (base.endsWith("y")) return `${base.slice(0, -1)}ies`;
	return `${base}s`;
}

export function agentCategoryLabel(agent: MirrorAgentSnapshot): string {
	for (const rule of AGENT_CATEGORY_RULES) {
		if (rule.pattern.test(agent.type)) return rule.label;
	}
	for (const rule of AGENT_CATEGORY_RULES) {
		if (rule.pattern.test(agent.description)) return rule.label;
	}
	return normalizeCategoryFallback(agent.type);
}

export class HerdrMirrorPaneLauncher {
	private readonly paneIdsByAgentId = new Map<string, string>();
	private readonly tabsByCategory = new Map<string, CategoryTab>();

	constructor(private readonly options: HerdrMirrorPaneLauncherOptions) {}

	async launch(agent: MirrorAgentSnapshot, socketPath: string): Promise<string> {
		const existingPaneId = this.paneIdsByAgentId.get(agent.id);
		if (existingPaneId) return existingPaneId;

		const category = agentCategoryLabel(agent);
		const categoryTab = await this.getOrCreateCategoryTab(category);
		const paneId = await this.allocatePane(categoryTab);
		await this.execHerdr(["pane", "run", paneId, viewerCommand(socketPath, agent.id)]);
		this.paneIdsByAgentId.set(agent.id, paneId);
		return paneId;
	}

	async closeAll(): Promise<void> {
		const tabIds = [...this.tabsByCategory.values()].map((tab) => tab.tabId);
		this.paneIdsByAgentId.clear();
		this.tabsByCategory.clear();
		await Promise.all(tabIds.map((tabId) => this.execHerdr(["tab", "close", tabId]).catch(() => undefined)));
	}

	private async getOrCreateCategoryTab(category: string): Promise<CategoryTab> {
		const existing = this.tabsByCategory.get(category);
		if (existing) return existing;

		const created = await this.execHerdr(["tab", "create", "--label", `herd: ${category}`, "--no-focus"]);
		const tab = parseCreatedTab(created.stdout.trim());
		this.tabsByCategory.set(category, tab);
		return tab;
	}

	private async allocatePane(tab: CategoryTab): Promise<string> {
		if (tab.paneIds.length === 0) {
			tab.paneIds.push(tab.rootPaneId);
			return tab.rootPaneId;
		}

		const split = await this.execHerdr(["pane", "split", tab.rootPaneId, "--direction", "right", "--no-focus"]);
		const paneId = parseSplitPaneId(split.stdout.trim());
		tab.paneIds.push(paneId);
		return paneId;
	}

	private async execHerdr(args: readonly string[]): Promise<PiExecResult> {
		const result = await this.options.pi.exec("herdr", args, { signal: this.options.signal });
		if (this.options.signal?.aborted || result.killed) throw new Error("Aborted");
		if (result.code !== 0) {
			const message = result.stderr.trim() || result.stdout.trim() || `herdr ${args.join(" ")} failed with exit code ${result.code}`;
			throw new Error(message);
		}
		return result;
	}
}
