import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { HerdrToolDetails, ManagedPane } from "./herdr-types.js";

export class PaneAliasStore {
	private readonly managedPanes = new Map<string, ManagedPane>();
	private readonly aliasOrder: string[] = [];

	snapshotAliases(): Record<string, ManagedPane> {
		return Object.fromEntries(this.managedPanes.entries());
	}

	withSnapshot(details: Omit<HerdrToolDetails, "aliases" | "aliasOrder">): HerdrToolDetails {
		return {
			...details,
			aliases: this.snapshotAliases(),
			aliasOrder: [...this.aliasOrder],
		};
	}

	setAliases(aliases: Record<string, ManagedPane>, order: string[]) {
		this.managedPanes.clear();
		this.aliasOrder.length = 0;
		for (const [alias, managed] of Object.entries(aliases)) {
			this.managedPanes.set(alias, managed);
		}
		for (const alias of order) {
			if (this.managedPanes.has(alias)) this.aliasOrder.push(alias);
		}
		for (const alias of this.managedPanes.keys()) {
			if (!this.aliasOrder.includes(alias)) this.aliasOrder.push(alias);
		}
	}

	reconstruct(ctx: ExtensionContext) {
		let aliases: Record<string, ManagedPane> = {};
		let order: string[] = [];

		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "message") continue;
			const message = entry.message;
			if (message.role !== "toolResult" || message.toolName !== "herdr") continue;
			const details = message.details as HerdrToolDetails | undefined;
			if (!details?.aliases) continue;
			aliases = details.aliases;
			order = Array.isArray(details.aliasOrder) ? details.aliasOrder : Object.keys(details.aliases);
		}

		this.setAliases(aliases, order);
	}

	recordAlias(alias: string, paneId: string, workspaceId: string) {
		this.managedPanes.set(alias, { paneId, workspaceId });
		const existingIndex = this.aliasOrder.indexOf(alias);
		if (existingIndex !== -1) this.aliasOrder.splice(existingIndex, 1);
		this.aliasOrder.push(alias);
	}

	forgetAlias(alias: string) {
		this.managedPanes.delete(alias);
		const index = this.aliasOrder.indexOf(alias);
		if (index !== -1) this.aliasOrder.splice(index, 1);
	}

	get(alias: string): ManagedPane | undefined {
		return this.managedPanes.get(alias);
	}

	has(alias: string): boolean {
		return this.managedPanes.has(alias);
	}

	entries(): IterableIterator<[string, ManagedPane]> {
		return this.managedPanes.entries();
	}
}
