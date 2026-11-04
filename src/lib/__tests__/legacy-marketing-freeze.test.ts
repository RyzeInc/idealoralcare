// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import baseline from "@/components/marketing/legacy-ideal/baseline.json";

// This is deliberately an integrity check: the owner froze historical marketing.
// Updating the manifest to accommodate a rebrand would break that requirement.
test.each(Object.entries(baseline.files))("historical Ideal marketing remains frozen: %s", (file, hash) => {
  expect(createHash("sha256").update(readFileSync(file)).digest("hex")).toBe(hash);
});
