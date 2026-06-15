import { describe, it } from "node:test";
import assert from "node:assert/strict";
import packageJson from "../package.json" with { type: "json" };

describe("package metadata", () => {
	it("declares the herdr Pi extension entrypoint", () => {
		assert.deepEqual(packageJson.pi?.extensions, ["./extensions/herdr.ts"]);
	});

	it("is configured for public npm publishing", () => {
		assert.equal(packageJson.name, "@weshipwork/pi-herdr");
		assert.equal(packageJson.publishConfig?.access, "public");
	});
});
