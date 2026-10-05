/**
 * Shared eligibility email intake for Google Workspace.
 *
 * One dedicated Workspace user mailbox (not a Google Group) serves every site.
 * Each site's address, such as eligibility@getidealoh.com, is an alias of that
 * mailbox, and organizations email plus-addresses such as
 * eligibility+org-abc@getidealoh.com. Every five minutes this script forwards
 * roster attachments from the Inbox to the matching site's signed Convex
 * bridge, emails an opaque receipt from that site's address, and moves handled
 * mail to Trash. The same file is kept in every site's repository.
 *
 * Sites are script properties named SITE_<NAME>, each written by that site's
 * scripts/setup-eligibility-email.sh. Adding a site needs no code change: add
 * its address as a mailbox alias and a Gmail "Send mail as" address, add its
 * SITE_ property, then run setup() again.
 *
 * Trust model: Gmail's own topmost Authentication-Results (mx.google.com) must
 * report dmarc=pass; spam never reaches the Inbox and Gmail blocks malware
 * before delivery. The topmost Delivered-To is added by Google, so it is the
 * plus-address the sender actually used. Each site still checks the sender
 * allowlist and organization alias, and staff review every file.
 *
 * Routing: the site whose domain appears in Delivered-To is asked first. If it
 * does not recognize the sender and organization, the other sites are asked
 * with the same plus-tag, in case Google reports the mailbox's primary domain
 * instead of the alias. Organization tags are random per site and a refusal
 * stores nothing, so at most one site accepts.
 *
 * Setup: paste this file into a script.google.com project while signed in as
 * the mailbox, add the SITE_ script properties, then run setup() once.
 */

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;
const SUPPORTED = /\.(csv|xlsx|txt|json)$/i;
const RUN_BUDGET_MS = 4.5 * 60 * 1000;

function setup() {
  const sites = sites_();
  if (!sites.length)
    throw new Error("No sites configured. Add the SITE_ script property written by setup-eligibility-email.sh.");
  const me = Session.getEffectiveUser().getEmail().toLowerCase();
  const sendAs = GmailApp.getAliases().map((address) => address.toLowerCase());
  for (const site of sites) {
    if (site.address !== me && !sendAs.includes(site.address))
      throw new Error(`Add ${site.address} to this mailbox's Gmail "Send mail as" addresses, then run setup() again.`);
    // A correctly signed empty request is refused as BAD_REQUEST (400);
    // a wrong secret is refused as UNAUTHORIZED (401).
    const status = prepare_(site, {}).getResponseCode();
    if (status === 401) throw new Error(`${site.brand} rejected the secret in ${site.key}. Re-copy it.`);
    if (status !== 400) throw new Error(`${site.brand} is not reachable (HTTP ${status}). Try again shortly.`);
  }
  for (const trigger of ScriptApp.getProjectTriggers())
    if (trigger.getHandlerFunction() === "processInbox") ScriptApp.deleteTrigger(trigger);
  ScriptApp.newTrigger("processInbox").timeBased().everyMinutes(5).create();
  console.log(`Setup complete for ${sites.map((site) => site.address).join(", ")}. The Inbox is checked every 5 minutes.`);
}

function processInbox() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  const started = Date.now();
  try {
    const sites = sites_();
    for (const thread of GmailApp.search("in:inbox", 0, 20)) {
      for (const message of thread.getMessages()) {
        if (Date.now() - started > RUN_BUDGET_MS) return;
        if (!message.isInInbox() || message.isInTrash()) continue;
        if (handleMessage_(message, sites) !== "retry") message.moveToTrash();
      }
    }
  } finally {
    lock.releaseLock();
  }
}

// Each SITE_<NAME> script property holds the JSON written by that site's setup
// script: { address, brand, portal, api, secret }.
function sites_() {
  const properties = PropertiesService.getScriptProperties().getProperties();
  return Object.keys(properties)
    .filter((key) => /^SITE_[A-Z0-9_]+$/.test(key))
    .sort()
    .map((key) => {
      let site = null;
      try {
        site = JSON.parse(properties[key]);
      } catch (error) {}
      if (
        !site ||
        !/^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(site.address) ||
        !/^[A-Za-z0-9 .&'-]{1,40}$/.test(site.brand) ||
        !/^https:\/\/[^\s"<>]+$/.test(site.portal) ||
        !/^https:\/\/[a-z0-9-]+\.convex\.site$/.test(site.api) ||
        !/^[a-f0-9]{64}$/.test(site.secret)
      )
        throw new Error(`${key} is invalid. Paste the value from setup-eligibility-email.sh again.`);
      return { key, address: site.address.toLowerCase(), brand: site.brand, portal: site.portal, api: site.api, secret: site.secret };
    });
}

// The site whose domain received the message comes first; the others follow
// with the same plus-tag. A recipient without a plus-tag names no organization.
function routes_(recipient, sites) {
  const [local, domain] = recipient.split("@");
  const plus = local.indexOf("+");
  if (plus < 1 || plus === local.length - 1) return [];
  const tag = local.slice(plus + 1);
  return sites
    .map((site) => {
      const [box, siteDomain] = site.address.split("@");
      return { site, recipient: `${box}+${tag}@${siteDomain}`, first: siteDomain === domain };
    })
    .sort((a, b) => Number(b.first) - Number(a.first));
}

// Returns "done", "refused", or "retry" (left in the Inbox for the next run).
function handleMessage_(message, sites) {
  const headers = parseHeaders_(message.getRawContent());
  const dmarc = dmarcVerdict_(firstHeader_(headers, "authentication-results"));
  const sender = singleAddress_(firstHeader_(headers, "from"));
  const recipient = singleAddress_(firstHeader_(headers, "delivered-to"));
  if (dmarc !== "PASS" || !sender || !recipient) {
    console.info("eligibility_email_rejected_authentication");
    return "refused";
  }
  const routes = routes_(recipient, sites);
  if (!routes.length) {
    console.info("eligibility_email_rejected_recipient");
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
  // Once a site accepts one attachment, the rest of the message goes there too.
  let accepted = null;
  for (let i = 0; i < attachments.length; i++) {
    const bytes = attachments[i].getBytes();
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) {
      refused++;
      continue;
    }
    let route = null;
    let status = 403;
    let preparation = null;
    for (const candidate of accepted ? [accepted] : routes) {
      preparation = prepare_(candidate.site, {
        sender,
        recipients: [candidate.recipient],
        messageId: `gmail:${message.getId()}:${i}`,
        fileName: attachments[i].getName(),
        fileBytes: bytes.length,
        dmarc,
        spam: "PASS",
        virus: "PASS",
      });
      status = preparation.getResponseCode();
      if (status === 401) throw new Error(`Email bridge authentication failed for ${candidate.site.key}`);
      // 403: this site does not know this sender and organization.
      if (status !== 403) {
        route = candidate;
        break;
      }
    }
    // Never reply to unapproved senders; avoid backscatter and address enumeration.
    if (status === 400 || status === 403) {
      refused++;
      continue;
    }
    if (status < 200 || status >= 300) return "retry";
    const ticket = JSON.parse(preparation.getContentText());
    if (ticket.uploadUrl !== `${route.site.api}/eligibility/upload`)
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
    accepted = route;
  }
  if (!receipts.length) {
    console.info("eligibility_email_rejected_sender");
    return "refused";
  }
  try {
    sendReceipt_(accepted.site, sender, receipts, refused);
  } catch (error) {
    console.warn("eligibility_receipt_delivery_failed");
  }
  console.info("eligibility_email_completed", { site: accepted.site.key, accepted: receipts.length, refused });
  return "done";
}

// Receipts come from the site's own address so senders only see that brand.
function sendReceipt_(site, sender, receipts, refused) {
  const options = { name: `${site.brand} Eligibility` };
  if (site.address !== Session.getEffectiveUser().getEmail().toLowerCase()) options.from = site.address;
  GmailApp.sendEmail(
    sender,
    `${site.brand} eligibility submission received`,
    `Your submission was received for review. Member coverage has not been changed.\n\nReceipt(s):\n${receipts.join("\n")}\n\n` +
      (refused ? `${refused} attachment(s) were not accepted. Use the upload page or contact ${site.brand} for help.\n\n` : "") +
      `You can check submissions at ${site.portal}.\nDo not include member information in email subjects or replies.`,
    options,
  );
}

function prepare_(site, payload) {
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  return UrlFetchApp.fetch(`${site.api}/eligibility/email/prepare`, {
    method: "post",
    contentType: "application/json",
    headers: {
      "X-Intake-Timestamp": timestamp,
      "X-Intake-Signature": hmacHex_(`${timestamp}.${body}`, site.secret),
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
