/**
 * Ideal eligibility email intake for Google Workspace.
 *
 * Runs as the dedicated eligibility@ mailbox (not a Google Group). Every five
 * minutes it forwards roster attachments from the Inbox to the signed Convex
 * bridge, emails an opaque receipt, and moves handled mail to Trash.
 *
 * Trust model: Gmail's own topmost Authentication-Results (mx.google.com) must
 * report dmarc=pass; spam never reaches the Inbox and Gmail blocks malware
 * before delivery. The topmost Delivered-To is added by Google, so it is the
 * plus-address the sender actually used. Ideal still checks the sender
 * allowlist and organization alias, and staff review every file.
 *
 * Setup: paste this file into a script.google.com project while signed in as
 * the mailbox, then run setup() once.
 */

const CONVEX_SITE_URL = "__CONVEX_SITE_URL__";
const MAILBOX = "eligibility@getidealoh.com";
const BRIDGE_SECRET = "__BRIDGE_SECRET__";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;
const SUPPORTED = /\.(csv|xlsx|txt|json)$/i;
const RUN_BUDGET_MS = 4.5 * 60 * 1000;

function setup() {
  const me = Session.getEffectiveUser().getEmail().toLowerCase();
  if (me !== MAILBOX)
    throw new Error(`Run this signed in as ${MAILBOX}, not ${me}.`);
  if (!/^https:\/\/[a-z0-9-]+\.convex\.site$/.test(CONVEX_SITE_URL))
    throw new Error("CONVEX_SITE_URL is missing. Use the copy of this script Ideal gave you.");
  if (!/^[a-f0-9]{64}$/.test(BRIDGE_SECRET))
    throw new Error("BRIDGE_SECRET is missing. Use the copy of this script Ideal gave you.");
  // A correctly signed empty request is refused as BAD_REQUEST (400);
  // a wrong secret is refused as UNAUTHORIZED (401).
  const status = prepare_({}).getResponseCode();
  if (status === 401) throw new Error("Ideal rejected the secret. Re-copy the script.");
  if (status !== 400) throw new Error(`Ideal is not reachable (HTTP ${status}). Try again shortly.`);
  for (const trigger of ScriptApp.getProjectTriggers())
    if (trigger.getHandlerFunction() === "processInbox") ScriptApp.deleteTrigger(trigger);
  ScriptApp.newTrigger("processInbox").timeBased().everyMinutes(5).create();
  console.log("Setup complete. Eligibility email intake checks the Inbox every 5 minutes.");
}

function processInbox() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  const started = Date.now();
  try {
    for (const thread of GmailApp.search("in:inbox", 0, 20)) {
      for (const message of thread.getMessages()) {
        if (Date.now() - started > RUN_BUDGET_MS) return;
        if (!message.isInInbox() || message.isInTrash()) continue;
        if (handleMessage_(message) !== "retry") message.moveToTrash();
      }
    }
  } finally {
    lock.releaseLock();
  }
}

// Returns "done", "refused", or "retry" (left in the Inbox for the next run).
function handleMessage_(message) {
  const headers = parseHeaders_(message.getRawContent());
  const dmarc = dmarcVerdict_(firstHeader_(headers, "authentication-results"));
  const sender = singleAddress_(firstHeader_(headers, "from"));
  const recipient = singleAddress_(firstHeader_(headers, "delivered-to"));
  if (dmarc !== "PASS" || !sender || !recipient) {
    console.info("eligibility_email_rejected_authentication");
    return "refused";
  }
  const attachments = message
    .getAttachments({ includeInlineImages: false })
    .filter((a) => SUPPORTED.test(a.getName() || ""));
  if (!attachments.length || attachments.length > MAX_ATTACHMENTS) {
    console.info("eligibility_email_rejected_attachments");
    return "refused";
  }
  const receipts = [];
  let refused = 0;
  for (let i = 0; i < attachments.length; i++) {
    const bytes = attachments[i].getBytes();
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) {
      refused++;
      continue;
    }
    const preparation = prepare_({
      sender,
      recipients: [recipient],
      messageId: `gmail:${message.getId()}:${i}`,
      fileName: attachments[i].getName(),
      fileBytes: bytes.length,
      dmarc,
      spam: "PASS",
      virus: "PASS",
    });
    const status = preparation.getResponseCode();
    if (status === 401) throw new Error("Email bridge authentication failed");
    // Never reply to unapproved senders; avoid backscatter and address enumeration.
    if (status === 400 || status === 403) {
      refused++;
      continue;
    }
    if (status < 200 || status >= 300) return "retry";
    const ticket = JSON.parse(preparation.getContentText());
    if (ticket.uploadUrl !== `${CONVEX_SITE_URL}/eligibility/upload`)
      throw new Error("Unexpected upload endpoint");
    const upload = UrlFetchApp.fetch(ticket.uploadUrl, {
      method: "post",
      contentType: "application/octet-stream",
      headers: { "X-Upload-Token": ticket.uploadToken },
      payload: bytes,
      muteHttpExceptions: true,
    });
    const uploaded = upload.getResponseCode();
    if (uploaded === 400 || uploaded === 403) {
      refused++;
      continue;
    }
    if (uploaded < 200 || uploaded >= 300) return "retry";
    receipts.push(JSON.parse(upload.getContentText()).receiptId);
  }
  if (!receipts.length) {
    console.info("eligibility_email_rejected_sender");
    return "refused";
  }
  try {
    GmailApp.sendEmail(
      sender,
      "Ideal eligibility submission received",
      `Your submission was received for review. Member coverage has not been changed.\n\nReceipt(s):\n${receipts.join("\n")}\n\n` +
        (refused ? `${refused} attachment(s) were not accepted. Use the upload page or contact Ideal for help.\n\n` : "") +
        "You can check submissions at https://www.getidealoh.com/employer/upload.\nDo not include member information in email subjects or replies.",
      { name: "Ideal Eligibility" },
    );
  } catch (error) {
    console.warn("eligibility_receipt_delivery_failed");
  }
  console.info("eligibility_email_completed", { accepted: receipts.length, refused });
  return "done";
}

function prepare_(payload) {
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  return UrlFetchApp.fetch(`${CONVEX_SITE_URL}/eligibility/email/prepare`, {
    method: "post",
    contentType: "application/json",
    headers: {
      "X-Intake-Timestamp": timestamp,
      "X-Intake-Signature": hmacHex_(`${timestamp}.${body}`, BRIDGE_SECRET),
    },
    payload: body,
    muteHttpExceptions: true,
  });
}

function hmacHex_(value, secret) {
  return Utilities.computeHmacSha256Signature(value, secret, Utilities.Charset.UTF_8)
    .map((b) => (b & 0xff).toString(16).padStart(2, "0"))
    .join("");
}

// Header block in original order, folded lines joined, names lower-cased.
function parseHeaders_(raw) {
  const end = raw.search(/\r?\n\r?\n/);
  return (end === -1 ? raw : raw.slice(0, end))
    .replace(/\r?\n[ \t]+/g, " ")
    .split(/\r?\n/)
    .map((line) => {
      const colon = line.indexOf(":");
      return colon > 0 ? [line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()] : null;
    })
    .filter(Boolean);
}

// Google prepends its own headers, so the topmost one is the trustworthy one;
// anything below it may have been written by the sender.
function firstHeader_(headers, name) {
  const found = headers.find(([key]) => key === name);
  return found ? found[1] : "";
}

function dmarcVerdict_(authResults) {
  if (!/^mx\.google\.com\s*;/i.test(authResults)) return "NONE";
  const match = authResults.match(/\bdmarc=([a-z]+)/i);
  return match ? match[1].toUpperCase() : "NONE";
}

// Exactly one mailbox, preferring <angle> addresses so a display name such as
// "hr@a.com" <x@b.com> cannot smuggle in a second address.
function singleAddress_(value) {
  const angled = value.match(/<[^<>\s@]+@[^<>\s@]+>/g);
  const found = angled
    ? angled.map((a) => a.slice(1, -1))
    : value.match(/[^\s<>,;"]+@[^\s<>,;"]+/g) || [];
  return found.length === 1 ? found[0].trim().toLowerCase() : "";
}
