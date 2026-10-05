import { ConvexError } from "convex/values";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const SESSION_TTL_MS = 15 * 60 * 1000;
export const MAX_SESSIONS_PER_HOUR = 60;
export type IntakeFileType = "csv" | "xlsx" | "txt" | "json";
export type WorkbookEntry = {
  offset: number;
  compressedBytes: number;
  expandedBytes: number;
  method: number;
};

export function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}
export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email))
    fail("BAD_REQUEST", "Enter a valid email address.");
  return email;
}
export function inboundDomain(): string | undefined {
  const value = process.env.ELIGIBILITY_INBOUND_DOMAIN?.trim().toLowerCase();
  return value && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(value) ? value : undefined;
}
export function validateMetadata(
  fileName: string,
  bytes: number,
  sourceDate?: string,
) {
  if (!fileName || fileName.length > 180 || /[\x00-\x1f\x7f/\\]/.test(fileName))
    fail("BAD_REQUEST", "Invalid file name.");
  const fileType = fileName.split(".").pop()?.toLowerCase() as IntakeFileType;
  if (!["csv", "xlsx", "txt", "json"].includes(fileType))
    fail("BAD_REQUEST", "Use CSV, XLSX, TXT, or JSON files.");
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_UPLOAD_BYTES)
    fail("BAD_REQUEST", "Files must be between 1 byte and 10 MB.");
  if (
    sourceDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDate) ||
      Number.isNaN(Date.parse(sourceDate)) ||
      new Date(sourceDate).toISOString().slice(0, 10) !== sourceDate)
  ) {
    fail("BAD_REQUEST", "Use a valid YYYY-MM-DD roster date.");
  }
  return { fileName: fileName.trim(), fileType, fileBytes: bytes, sourceDate };
}
export async function sha256(value: string | ArrayBuffer): Promise<string> {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}
export function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
export function secretToken(prefix: string): string {
  return prefix + hex(crypto.getRandomValues(new Uint8Array(32)));
}

// Inspect the ZIP directory without inflating untrusted workbook contents.
// This is a format/expansion guard, not a substitute for malware scanning.
export function validateFileBytes(bytes: Uint8Array, type: IntakeFileType) {
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_UPLOAD_BYTES)
    fail("BAD_REQUEST", "Invalid file size.");
  if (type !== "xlsx") {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      fail("BAD_REQUEST", "Text files must use UTF-8 encoding.");
    }
    if (!text.trim() || text.includes("\0"))
      fail("BAD_REQUEST", "The file must contain text records.");
    if (type === "json") {
      try {
        const value = JSON.parse(text);
        if (!value || typeof value !== "object")
          fail("BAD_REQUEST", "JSON must contain records.");
      } catch {
        fail("BAD_REQUEST", "Invalid JSON file.");
      }
    }
    return;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 22 || view.getUint32(0, true) !== 0x04034b50)
    fail("BAD_REQUEST", "Invalid XLSX workbook.");
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === bytes.length
    ) {
      end = i;
      break;
    }
  }
  if (end < 0) fail("BAD_REQUEST", "Invalid XLSX directory.");
  const entries = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const directoryBytes = view.getUint32(end + 12, true);
  const directoryStart = offset;
  if (
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true) ||
    view.getUint16(end + 8, true) !== entries ||
    entries < 1 ||
    entries > 1000 ||
    offset + directoryBytes !== end
  )
    fail("BAD_REQUEST", "Unsupported workbook archive.");
  let expanded = 0;
  const names = new Set<string>();
  const files: WorkbookEntry[] = [];
  for (let n = 0; n < entries; n++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
      fail("BAD_REQUEST", "Invalid workbook archive.");
    const nameLength = view.getUint16(offset + 28, true);
    const next =
      offset +
      46 +
      nameLength +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
    const flags = view.getUint16(offset + 8, true);
    if (next > end || flags & ~0x080e)
      fail("BAD_REQUEST", "Encrypted workbooks are not supported.");
    const expandedBytes = view.getUint32(offset + 24, true);
    const compressedBytes = view.getUint32(offset + 20, true);
    const method = view.getUint16(offset + 10, true);
    expanded += expandedBytes;
    const name = new TextDecoder().decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );
    if (/vbaproject|\.\.\//i.test(name) || expanded > 50 * 1024 * 1024)
      fail(
        "BAD_REQUEST",
        "Macros or oversized workbook contents are not supported.",
      );
    if (
      names.has(name) ||
      /[\\\x00]/.test(name) ||
      name.startsWith("/") ||
      ![0, 8].includes(method)
    )
      fail("BAD_REQUEST", "Unsupported workbook contents.");
    const local = view.getUint32(offset + 42, true);
    if (
      local + 30 > directoryStart ||
      view.getUint32(local, true) !== 0x04034b50 ||
      view.getUint16(local + 6, true) !== flags ||
      view.getUint16(local + 8, true) !== method
    )
      fail("BAD_REQUEST", "Invalid workbook entry.");
    const localCompressed = view.getUint32(local + 18, true);
    const localExpanded = view.getUint32(local + 22, true);
    if (
      (localCompressed !== compressedBytes &&
        (!(flags & 8) || localCompressed !== 0)) ||
      (localExpanded !== expandedBytes && (!(flags & 8) || localExpanded !== 0))
    )
      fail("BAD_REQUEST", "Inconsistent workbook entry sizes.");
    const localNameLength = view.getUint16(local + 26, true);
    const dataOffset =
      local + 30 + localNameLength + view.getUint16(local + 28, true);
    if (
      dataOffset + compressedBytes > directoryStart ||
      new TextDecoder().decode(
        bytes.subarray(local + 30, local + 30 + localNameLength),
      ) !== name ||
      (method === 0 && compressedBytes !== expandedBytes)
    )
      fail("BAD_REQUEST", "Invalid workbook entry sizes.");
    files.push({ offset: dataOffset, compressedBytes, expandedBytes, method });
    names.add(name);
    offset = next;
  }
  if (
    offset !== end ||
    !names.has("[Content_Types].xml") ||
    !names.has("xl/workbook.xml")
  )
    fail("BAD_REQUEST", "Upload a standard XLSX workbook.");
  return files;
}

export async function verifyBridgeSignature(
  body: string,
  timestamp: string | null,
  signature: string | null,
  secret: string | undefined,
) {
  if (
    !secret ||
    !timestamp ||
    !signature ||
    !/^\d{10,13}$/.test(timestamp) ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return false;
  if (Math.abs(Date.now() - Number(timestamp)) > 5 * 60 * 1000) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const digest = Uint8Array.from(signature.match(/../g)!, (s) =>
    parseInt(s, 16),
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    digest,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
}
