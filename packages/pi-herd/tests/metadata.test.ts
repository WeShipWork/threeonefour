import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface PackageMetadata {
	pi?: PackagePiMetadata;
	files?: string[];
}

interface PackagePiMetadata {
	extensions?: string[];
}

describe("package metadata", () => {
	it("declares the pi-herd Pi extension entrypoint", async () => {
		const packageJson = await readFile(join(import.meta.dirname, "..", "package.json"), "utf8");
		const metadata = JSON.parse(packageJson) as PackageMetadata;

		assert.deepEqual(metadata.pi?.extensions, ["./extensions/herd.ts"]);
		assert.equal(metadata.files?.includes("extensions/"), true);
	});
});
