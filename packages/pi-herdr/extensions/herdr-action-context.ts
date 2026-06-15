import type { AgentToolResult, AgentToolUpdateCallback } from "@earendil-works/pi-coding-agent";
import type { HerdrClient } from "./herdr-client.js";
import type { HerdrToolDetails, ManagedPane, PaneInfo } from "./herdr-types.js";
import type { PaneAliasStore } from "./herdr-state.js";

export type HerdrToolResult = AgentToolResult<HerdrToolDetails>;

export interface ResolvedPaneRef {
	pane: PaneInfo;
	alias?: string;
}

export interface ResolvedManagedPane {
	managed: ManagedPane;
	pane: PaneInfo;
}

export class HerdrActionRuntime {
	constructor(
		readonly client: HerdrClient,
		readonly aliasStore: PaneAliasStore,
		readonly currentPaneId: string,
		readonly currentWorkspaceId: string,
		readonly signal: AbortSignal | undefined,
		readonly onUpdate: AgentToolUpdateCallback<HerdrToolDetails> | undefined,
	) {}

	withSnapshot(details: Omit<HerdrToolDetails, "aliases" | "aliasOrder">): HerdrToolDetails {
		return this.aliasStore.withSnapshot(details);
	}

	aliasByPaneId(workspaceId: string): Map<string, string> {
		const aliases = new Map<string, string>();
		for (const [alias, managed] of this.aliasStore.entries()) {
			if (managed.workspaceId === workspaceId) aliases.set(managed.paneId, alias);
		}
		return aliases;
	}

	async resolveManagedPane(alias: string, workspaceId = this.currentWorkspaceId): Promise<ResolvedManagedPane | null> {
		const managed = this.aliasStore.get(alias);
		if (!managed) return null;
		if (managed.workspaceId !== workspaceId) return null;

		const pane = await this.client.getPaneInfo(managed.paneId, this.signal);
		if (!pane) {
			this.aliasStore.forgetAlias(alias);
			return null;
		}

		return { managed, pane };
	}

	async resolvePaneRef(ref: string, workspaceId = this.currentWorkspaceId): Promise<ResolvedPaneRef | null> {
		const managed = await this.resolveManagedPane(ref, workspaceId);
		if (managed) {
			return { pane: managed.pane, alias: ref };
		}

		const pane = await this.client.getPaneInfo(ref, this.signal);
		if (!pane || pane.workspace_id !== workspaceId) return null;
		const alias = [...this.aliasStore.entries()].find(([, managedPane]) => managedPane.paneId === pane.pane_id)?.[0];
		return { pane, alias };
	}

	async requirePaneRef(ref: string, workspaceId = this.currentWorkspaceId): Promise<ResolvedPaneRef> {
		const hadAlias = this.aliasStore.has(ref);
		const resolved = await this.resolvePaneRef(ref, workspaceId);
		if (resolved) return resolved;
		if (hadAlias) {
			throw new Error(`Pane alias '${ref}' no longer points to a live pane and was removed.`);
		}
		throw new Error(`Pane '${ref}' not found in the current workspace.`);
	}
}
