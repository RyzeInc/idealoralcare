"use node";

import { inflateRawSync } from "node:zlib";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { fail, validateFileBytes } from "./lib/eligibilityIntake";

// ZIP directory sizes alone are attacker-controlled. Bound actual inflation
// before a workbook reaches the staff preview/importer.
export const validateWorkbook = internalAction({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const file = await ctx.storage.get(args.storageId);
    if (!file) fail("BAD_REQUEST", "Workbook is unavailable.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entries = validateFileBytes(bytes, "xlsx")!;
    for (const entry of entries) {
      if (entry.method === 0) continue;
      try {
        const inflated = inflateRawSync(
          bytes.subarray(entry.offset, entry.offset + entry.compressedBytes),
          { maxOutputLength: Math.max(1, entry.expandedBytes) },
        );
        if (inflated.byteLength !== entry.expandedBytes)
          fail("BAD_REQUEST", "Invalid workbook expansion sizes.");
      } catch {
        fail(
          "BAD_REQUEST",
          "Workbook contents are corrupt or exceed their expansion limits.",
        );
      }
    }
  },
});
