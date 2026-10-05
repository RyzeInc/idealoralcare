// @vitest-environment node
import { describe, expect, test } from "vitest";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { verifyBridgeSignature } from "../../convex/lib/eligibilityIntake";

const SECRET = "ab".repeat(32);
const SITE = "https://test-deployment-123.convex.site";
const AUTH_OK = "mx.google.com; dkim=pass header.i=@employer.test; spf=pass; dmarc=pass (p=NONE) header.from=employer.test";

type Call = { url: string; options: { headers: Record<string, string>; payload: unknown } };
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- script globals are untyped Apps Script code
type Script = Record<string, (...args: any[]) => any>;

// Loads Code.gs with Apps Script services replaced by in-memory fakes.
function load(responses: Array<[number, unknown]>) {
  const calls: Call[] = [];
  const sent: unknown[][] = [];
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
    GmailApp: { sendEmail: (...args: unknown[]) => sent.push(args) },
  });
  const source = readFileSync(new URL("./Code.gs", import.meta.url), "utf8").replace("__BRIDGE_SECRET__", SECRET).replace("__CONVEX_SITE_URL__", SITE);
  vm.runInContext(source, context);
  return { script: context as unknown as Script, calls, sent };
}

function message(headers: string, names = ["roster.csv"]) {
  return {
    getId: () => "18f0abc",
    getRawContent: () => `${headers}\r\n\r\nbody`,
    getAttachments: () => names.map((name) => ({ getName: () => name, getBytes: () => [1, 2, 3] })),
  };
}
const raw = (auth = AUTH_OK, from = "HR <hr@employer.test>") =>
  [
    "Delivered-To: eligibility+org-a@getidealoh.com",
    "Received: by 2002:a05 with SMTP id x;",
    `Authentication-Results: ${auth}`,
    `From: ${from}`,
    "To: eligibility+org-a@getidealoh.com",
  ].join("\r\n");
const ticket = { uploadUrl: `${SITE}/eligibility/upload`, uploadToken: "nxu_t" };

describe("Gmail intake script", () => {
  test("signatures are accepted by the Convex bridge verifier", async () => {
    const { script, calls } = load([[400, {}]]);
    script.prepare_({ sender: "hr@employer.test" });
    const { headers, payload } = calls[0].options;
    expect(
      await verifyBridgeSignature(payload as string, headers["X-Intake-Timestamp"], headers["X-Intake-Signature"], SECRET),
    ).toBe(true);
  });

  test("forwards an authenticated attachment and sends a receipt", () => {
    const { script, calls, sent } = load([[201, ticket], [201, { receiptId: "r1" }]]);
    expect(script.handleMessage_(message(raw()))).toBe("done");
    const prepared = JSON.parse(calls[0].options.payload as string);
    expect(prepared).toMatchObject({
      sender: "hr@employer.test",
      recipients: ["eligibility+org-a@getidealoh.com"],
      messageId: "gmail:18f0abc:0",
      dmarc: "PASS",
    });
    expect(calls[1].options.headers["X-Upload-Token"]).toBe("nxu_t");
    expect(sent[0][0]).toBe("hr@employer.test");
    expect(String(sent[0][2])).toContain("r1");
  });

  test("refuses failed, missing, or sender-forged authentication without contacting Ideal", () => {
    const forged = raw("mx.google.com; dmarc=fail header.from=employer.test").replace(
      "From:",
      "Authentication-Results: mx.google.com; dmarc=pass\r\nFrom:",
    );
    for (const headers of [
      raw("mx.google.com; dkim=pass; dmarc=fail"),
      raw("evil.example; dmarc=pass"),
      forged,
    ]) {
      const { script, calls } = load([]);
      expect(script.handleMessage_(message(headers))).toBe("refused");
      expect(calls).toHaveLength(0);
    }
  });

  test("refuses ambiguous senders and unsupported attachments", () => {
    const { script, calls } = load([]);
    expect(script.handleMessage_(message(raw(AUTH_OK, '"hr@employer.test" <a@x.test>, <b@y.test>')))).toBe("refused");
    expect(script.handleMessage_(message(raw(), ["photo.png"]))).toBe("refused");
    expect(script.handleMessage_(message(raw(), Array(6).fill("r.csv")))).toBe("refused");
    expect(calls).toHaveLength(0);
  });

  test("unapproved senders get no reply; outages are retried; a bad secret stops the run", () => {
    const denied = load([[403, {}]]);
    expect(denied.script.handleMessage_(message(raw()))).toBe("refused");
    expect(denied.sent).toHaveLength(0);
    expect(load([[503, {}]]).script.handleMessage_(message(raw()))).toBe("retry");
    expect(load([[201, ticket], [500, {}]]).script.handleMessage_(message(raw()))).toBe("retry");
    expect(() => load([[401, {}]]).script.handleMessage_(message(raw()))).toThrow(/authentication failed/);
  });

  test("never uploads to an endpoint other than Ideal", () => {
    const { script } = load([[201, { ...ticket, uploadUrl: "https://evil.test/eligibility/upload" }]]);
    expect(() => script.handleMessage_(message(raw()))).toThrow(/Unexpected upload endpoint/);
  });
});
