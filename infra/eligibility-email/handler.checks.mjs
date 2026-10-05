import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createHandler,
  authenticatedReceipt,
  signedHeaders,
} from "./handler.mjs";
import { GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const event = (dmarc = "PASS") => ({
  Records: [
    {
      eventSource: "aws:ses",
      ses: {
        mail: { messageId: "message-123" },
        receipt: {
          recipients: ["org-a@intake.ideal.test"],
          dmarcVerdict: { status: dmarc },
          spamVerdict: { status: "PASS" },
          virusVerdict: { status: "PASS" },
        },
      },
    },
  ],
});
const env = {
  CONVEX_SITE_URL: "https://test.convex.site",
  INTAKE_BRIDGE_SECRET: "secret",
  RAW_EMAIL_BUCKET: "raw",
  RECEIPT_FROM: "receipts@intake.ideal.test",
};
function mockS3() {
  const operations = [];
  return {
    operations,
    send: async (command) => {
      operations.push(command);
      if (command instanceof GetObjectCommand)
        return {
          ContentLength: 4,
          Body: (async function* () {
            yield Buffer.from("mail");
          })(),
        };
      return {};
    },
  };
}
const parsed = {
  from: { value: [{ address: "hr@employer.test" }] },
  attachments: [
    { filename: "roster.csv", content: Buffer.from("First Name\nJane") },
  ],
};

test("receiving-provider results are required; failed DMARC is rejected before reading a message", async () => {
  const s3 = mockS3();
  let fetched = false;
  await createHandler({
    s3,
    env,
    fetcher: async () => {
      fetched = true;
    },
    parse: async () => parsed,
  })(event("FAIL"));
  assert.equal(fetched, false);
  assert.ok(s3.operations[0] instanceof DeleteObjectCommand);
  assert.equal(
    authenticatedReceipt({ eventSource: "spoof", ses: event().Records[0].ses }),
    false,
  );
});
test("accepted attachments are signed, forwarded with envelope recipients, and receipted without roster content", async () => {
  const s3 = mockS3();
  const calls = [];
  const receipts = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1
      ? new Response(
          JSON.stringify({
            uploadUrl: `${env.CONVEX_SITE_URL}/eligibility/upload`,
            uploadToken: "token",
          }),
          { status: 201 },
        )
      : new Response(JSON.stringify({ receiptId: "receipt-123" }), {
          status: 201,
        });
  };
  await createHandler({
    s3,
    env,
    fetcher,
    parse: async () => parsed,
    ses: {
      send: async (command) => {
        receipts.push(command.input);
      },
    },
  })(event());
  const metadata = JSON.parse(calls[0].options.body);
  assert.deepEqual(metadata.recipients, ["org-a@intake.ideal.test"]);
  assert.equal(
    calls[0].options.headers["X-Intake-Signature"],
    signedHeaders(
      calls[0].options.body,
      env.INTAKE_BRIDGE_SECRET,
      calls[0].options.headers["X-Intake-Timestamp"],
    )["X-Intake-Signature"],
  );
  assert.ok(s3.operations.at(-1) instanceof DeleteObjectCommand);
  assert.ok(receipts[0].Content.Simple.Body.Text.Data.includes("receipt-123"));
  assert.equal(JSON.stringify(receipts).includes("Jane"), false);
});
test("unapproved senders receive no email response", async () => {
  let sent = false;
  const s3 = mockS3();
  await createHandler({
    s3,
    env,
    parse: async () => parsed,
    fetcher: async () => new Response("{}", { status: 403 }),
    ses: {
      send: async () => {
        sent = true;
      },
    },
  })(event());
  assert.equal(sent, false);
  assert.ok(s3.operations.at(-1) instanceof DeleteObjectCommand);
});
test("transient intake failures preserve raw mail for AWS retries", async () => {
  const s3 = mockS3();
  await assert.rejects(
    createHandler({
      s3,
      env,
      parse: async () => parsed,
      fetcher: async () => new Response("{}", { status: 503 }),
    })(event()),
    /temporarily unavailable/,
  );
  assert.equal(
    s3.operations.some((c) => c instanceof DeleteObjectCommand),
    false,
  );
});
