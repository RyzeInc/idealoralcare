// No dependency installation needed. Keep credentials in environment variables,
// never in URLs, command arguments, file names, or console output.
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";

const base = process.env.ELIGIBILITY_API_BASE?.replace(/\/$/, "");
const key = process.env.ELIGIBILITY_API_KEY;
if (!base?.startsWith("https://") || !key)
  throw new Error(
    "Set ELIGIBILITY_API_BASE (the .convex.site URL) and ELIGIBILITY_API_KEY.",
  );
async function request(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Eligibility-Key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Intake request failed.");
  return data;
}
try {
  if (process.argv[2] === "--status") {
    if (!process.argv[3])
      throw new Error("Provide a receipt ID after --status.");
    console.log(
      JSON.stringify(
        await request("/eligibility/status", { receiptId: process.argv[3] }),
        null,
        2,
      ),
    );
  } else {
    const path = process.argv[2];
    if (!path)
      throw new Error(
        "Usage: node scripts/eligibility-upload.mjs FILE [YYYY-MM-DD] or --status RECEIPT_ID",
      );
    const { size } = await stat(path);
    if (size < 1 || size > 10 * 1024 * 1024)
      throw new Error("Files must be between 1 byte and 10 MB.");
    const ticket = await request("/eligibility/sessions", {
      fileName: basename(path),
      fileBytes: size,
      sourceDate: process.argv[3],
    });
    if (new URL(ticket.uploadUrl).origin !== new URL(base).origin)
      throw new Error("Unexpected upload endpoint.");
    const response = await fetch(ticket.uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Upload-Token": ticket.uploadToken,
      },
      body: await readFile(path),
      signal: AbortSignal.timeout(120000),
    });
    const receipt = await response.json();
    if (!response.ok)
      throw new Error(receipt.error ?? "File submission failed.");
    console.log(JSON.stringify(receipt, null, 2));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
