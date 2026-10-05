// @vitest-environment node
import { describe, expect, test } from "vitest";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { verifyBridgeSignature } from "../../convex/lib/eligibilityIntake";

const MAILBOX = "eligibility@nexusoralhealth.com";
const IDEAL = {
  address: "eligibility@getidealoh.com",
  brand: "Ideal",
  portal: "https://www.getidealoh.com/employer/upload",
  api: "https://ideal-test-123.convex.site",
  secret: "ab".repeat(32),
};
const NEXUS = {
  address: MAILBOX,
  brand: "Nexus",
  portal: "https://www.nexusoralhealth.com/employer/upload",
  api: "https://nexus-test-456.convex.site",
  secret: "cd".repeat(32),
};
const SITES = { SITE_IDEAL: JSON.stringify(IDEAL), SITE_NEXUS: JSON.stringify(NEXUS) };
const AUTH_OK = "mx.google.com; dkim=pass header.i=@employer.test; spf=pass; dmarc=pass (p=NONE) header.from=employer.test";

type Call = { url: string; options: { headers: Record<string, string>; payload: unknown } };
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- script globals are untyped Apps Script code
type Script = Record<string, (...args: any[]) => any>;

// Loads Code.gs with Apps Script services replaced by in-memory fakes.
function load(
  responses: Array<[number, unknown]>,
  { properties = SITES as Record<string, string>, sendAs = [IDEAL.address] } = {},
) {
  const calls: Call[] = [];
  const sent: unknown[][] = [];
  const triggers: string[] = [];
  const context = vm.createContext({
    console: { log() {}, info() {}, warn() {} },
    Utilities: {
      Charset: { UTF_8: "utf8" },
      computeHmacSha256Signature: (value: string, key: string) =>
        Array.from(createHmac("sha256", key).update(value).digest(), (b) => (b > 127 ? b - 256 : b)),
    },
    UrlFetchApp: {
      fetch: (url: string, options: Call["options"]) => {
        calls.push({ url, options });
        const [status, body] = responses.shift() ?? [500, {}];
        return { getResponseCode: () => status, getContentText: () => JSON.stringify(body) };
      },
    },
    GmailApp: { sendEmail: (...args: unknown[]) => sent.push(args), getAliases: () => sendAs },
    PropertiesService: { getScriptProperties: () => ({ getProperties: () => properties }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => MAILBOX }) },
    ScriptApp: {
      getProjectTriggers: () => [],
      deleteTrigger() {},
      newTrigger: (name: string) => ({
        timeBased: () => ({ everyMinutes: () => ({ create: () => triggers.push(name) }) }),
      }),
    },
  });
  vm.runInContext(readFileSync(new URL("./Code.gs", import.meta.url), "utf8"), context);
  const script = context as unknown as Script;
  const handle = (msg: unknown) => script.handleMessage_(msg, script.sites_());
  return { script, handle, calls, sent, triggers };
}

function message(headers: string, names = ["roster.csv"]) {
  return {
    getId: () => "18f0abc",
    getRawContent: () => `${headers}\r\n\r\nbody`,
    getAttachments: () => names.map((name) => ({ getName: () => name, getBytes: () => [1, 2, 3] })),
  };
}
const raw = (auth = AUTH_OK, from = "HR <hr@employer.test>", to = "eligibility+org-a@getidealoh.com") =>
  [
    `Delivered-To: ${to}`,
    "Received: by 2002:a05 with SMTP id x;",
    `Authentication-Results: ${auth}`,
    `From: ${from}`,
    `To: ${to}`,
  ].join("\r\n");
const ticket = (site: { api: string }) => ({ uploadUrl: `${site.api}/eligibility/upload`, uploadToken: "nxu_t" });
const prepared = (call: Call) => JSON.parse(call.options.payload as string);

describe("Gmail intake script", () => {
  test("signatures are accepted by each site's Convex bridge verifier", async () => {
    const { script, calls } = load([[400, {}], [400, {}]]);
    const [ideal, nexus] = script.sites_();
    script.prepare_(ideal, { sender: "hr@employer.test" });
    script.prepare_(nexus, { sender: "hr@employer.test" });
    for (const [call, secret] of [[calls[0], IDEAL.secret], [calls[1], NEXUS.secret]] as const) {
      const { headers, payload } = call.options;
      expect(
        await verifyBridgeSignature(payload as string, headers["X-Intake-Timestamp"], headers["X-Intake-Signature"], secret),
      ).toBe(true);
    }
    expect(calls[0].url).toBe(`${IDEAL.api}/eligibility/email/prepare`);
    expect(calls[1].url).toBe(`${NEXUS.api}/eligibility/email/prepare`);
  });

  test("routes by the delivered domain and sends the receipt from that site's alias", () => {
    const { handle, calls, sent } = load([[201, ticket(IDEAL)], [201, { receiptId: "r1" }]]);
    expect(handle(message(raw()))).toBe("done");
    expect(calls[0].url).toBe(`${IDEAL.api}/eligibility/email/prepare`);
    expect(prepared(calls[0])).toMatchObject({
      sender: "hr@employer.test",
      recipients: ["eligibility+org-a@getidealoh.com"],
      messageId: "gmail:18f0abc:0",
      dmarc: "PASS",
    });
    expect(calls[1].options.headers["X-Upload-Token"]).toBe("nxu_t");
    expect(sent[0][0]).toBe("hr@employer.test");
    expect(sent[0][1]).toBe("Ideal eligibility submission received");
    expect(String(sent[0][2])).toContain("r1");
    expect(String(sent[0][2])).toContain(IDEAL.portal);
    expect(sent[0][3]).toEqual({ name: "Ideal Eligibility", from: IDEAL.address });
  });

  test("the mailbox's own site sends receipts without a from override", () => {
    const { handle, calls, sent } = load([[201, ticket(NEXUS)], [201, { receiptId: "r1" }]]);
    expect(handle(message(raw(AUTH_OK, undefined, "eligibility+org-n@nexusoralhealth.com")))).toBe("done");
    expect(calls[0].url).toBe(`${NEXUS.api}/eligibility/email/prepare`);
    expect(sent[0][1]).toBe("Nexus eligibility submission received");
    expect(sent[0][3]).toEqual({ name: "Nexus Eligibility" });
  });

  test("asks the other sites with the same tag when the delivered domain's site refuses", () => {
    const { handle, calls, sent } = load([[403, {}], [201, ticket(IDEAL)], [201, { receiptId: "r1" }]]);
    expect(handle(message(raw(AUTH_OK, undefined, "eligibility+org-a@nexusoralhealth.com")))).toBe("done");
    expect(calls[0].url).toBe(`${NEXUS.api}/eligibility/email/prepare`);
    expect(prepared(calls[0]).recipients).toEqual(["eligibility+org-a@nexusoralhealth.com"]);
    expect(calls[1].url).toBe(`${IDEAL.api}/eligibility/email/prepare`);
    expect(prepared(calls[1]).recipients).toEqual(["eligibility+org-a@getidealoh.com"]);
    expect(sent[0][3]).toEqual({ name: "Ideal Eligibility", from: IDEAL.address });
  });

  test("later attachments go straight to the site that accepted the first", () => {
    const { handle, calls } = load([
      [403, {}], [201, ticket(IDEAL)], [201, { receiptId: "r1" }],
      [201, ticket(IDEAL)], [201, { receiptId: "r2" }],
    ]);
    expect(handle(message(raw(AUTH_OK, undefined, "eligibility+org-a@nexusoralhealth.com"), ["a.csv", "b.csv"]))).toBe("done");
    expect(calls.map((c) => c.url.split("/")[2])).toEqual([
      "nexus-test-456.convex.site", "ideal-test-123.convex.site", "ideal-test-123.convex.site",
      "ideal-test-123.convex.site", "ideal-test-123.convex.site",
    ]);
  });

  test("refuses failed, missing, or sender-forged authentication without contacting any site", () => {
    const forged = raw("mx.google.com; dmarc=fail header.from=employer.test").replace(
      "From:",
      "Authentication-Results: mx.google.com; dmarc=pass\r\nFrom:",
    );
    for (const headers of [
      raw("mx.google.com; dkim=pass; dmarc=fail"),
      raw("evil.example; dmarc=pass"),
      forged,
    ]) {
      const { handle, calls } = load([]);
      expect(handle(message(headers))).toBe("refused");
      expect(calls).toHaveLength(0);
    }
  });

  test("refuses ambiguous senders, untagged recipients, and unsupported attachments", () => {
    const { handle, calls } = load([]);
    expect(handle(message(raw(AUTH_OK, '"hr@employer.test" <a@x.test>, <b@y.test>')))).toBe("refused");
    expect(handle(message(raw(AUTH_OK, undefined, "eligibility@getidealoh.com")))).toBe("refused");
    expect(handle(message(raw(), ["photo.png"]))).toBe("refused");
    expect(handle(message(raw(), Array(6).fill("r.csv")))).toBe("refused");
    expect(calls).toHaveLength(0);
  });

  test("unapproved senders get no reply; outages are retried; a bad secret stops the run", () => {
    const denied = load([[403, {}], [403, {}]]);
    expect(denied.handle(message(raw()))).toBe("refused");
    expect(denied.calls).toHaveLength(2);
    expect(denied.sent).toHaveLength(0);
    expect(load([[503, {}]]).handle(message(raw()))).toBe("retry");
    expect(load([[201, ticket(IDEAL)], [500, {}]]).handle(message(raw()))).toBe("retry");
    expect(() => load([[401, {}]]).handle(message(raw()))).toThrow(/authentication failed for SITE_IDEAL/);
  });

  test("never uploads to an endpoint other than the accepting site's", () => {
    for (const uploadUrl of ["https://evil.test/eligibility/upload", `${NEXUS.api}/eligibility/upload`]) {
      const { handle } = load([[201, { uploadUrl, uploadToken: "nxu_t" }]]);
      expect(() => handle(message(raw()))).toThrow(/Unexpected upload endpoint/);
    }
  });

  test("setup verifies every site and installs the trigger", () => {
    const ok = load([[400, {}], [400, {}]]);
    ok.script.setup();
    expect(ok.calls).toHaveLength(2);
    expect(ok.triggers).toEqual(["processInbox"]);

    expect(() => load([], { sendAs: [] }).script.setup()).toThrow(/eligibility@getidealoh.com.*Send mail as/);
    expect(() => load([[401, {}]]).script.setup()).toThrow(/rejected the secret in SITE_IDEAL/);
    expect(() => load([], { properties: {} }).script.setup()).toThrow(/No sites configured/);
    for (const bad of ["not json", JSON.stringify({ ...IDEAL, secret: "__BRIDGE_SECRET__" }), JSON.stringify({ ...IDEAL, api: "https://evil.test" })])
      expect(() => load([], { properties: { SITE_IDEAL: bad } }).script.setup()).toThrow(/SITE_IDEAL is invalid/);
  });
});
