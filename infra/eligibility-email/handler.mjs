import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { simpleParser } from "mailparser";
import { createHmac } from "node:crypto";

const MAX_RAW_BYTES = 16 * 1024 * 1024;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function authenticatedReceipt(record) {
  const receipt = record?.ses?.receipt;
  return (
    record?.eventSource === "aws:ses" &&
    receipt?.dmarcVerdict?.status === "PASS" &&
    receipt?.spamVerdict?.status === "PASS" &&
    receipt?.virusVerdict?.status === "PASS"
  );
}
export function signedHeaders(body, secret, timestamp = Date.now().toString()) {
  return {
    "Content-Type": "application/json",
    "X-Intake-Timestamp": timestamp,
    "X-Intake-Signature": createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex"),
  };
}

// Factory lets the adapter be tested without live AWS, emails, or PHI.
export function createHandler({
  s3 = new S3Client({}),
  ses = new SESv2Client({}),
  fetcher = fetch,
  env = process.env,
  parse = simpleParser,
} = {}) {
  return async (event) => {
    if (
      !env.CONVEX_SITE_URL?.startsWith("https://") ||
      !env.INTAKE_BRIDGE_SECRET ||
      !env.RAW_EMAIL_BUCKET
    )
      throw new Error("Email bridge is not configured");
    const base = env.CONVEX_SITE_URL.replace(/\/$/, "");
    for (const record of event.Records ?? []) {
      if (record.eventSource !== "aws:ses")
        throw new Error("Unsupported event source");
      const messageId = record.ses?.mail?.messageId;
      if (!messageId || !/^[a-zA-Z0-9_-]{1,200}$/.test(messageId))
        throw new Error("Invalid SES message identifier");
      const object = { Bucket: env.RAW_EMAIL_BUCKET, Key: `raw/${messageId}` };
      const removeRaw = () => s3.send(new DeleteObjectCommand(object));
      if (!authenticatedReceipt(record)) {
        console.info("eligibility_email_rejected_authentication");
        await removeRaw();
        continue;
      }
      let raw;
      try {
        raw = await s3.send(new GetObjectCommand(object));
      } catch (error) {
        if (error?.name === "NoSuchKey") continue;
        throw error;
      }
      if (raw.ContentLength > MAX_RAW_BYTES) {
        await removeRaw();
        console.info("eligibility_email_rejected_size");
        continue;
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of raw.Body) {
        size += chunk.length;
        if (size > MAX_RAW_BYTES) break;
        chunks.push(chunk);
      }
      if (size > MAX_RAW_BYTES) {
        await removeRaw();
        console.info("eligibility_email_rejected_size");
        continue;
      }
      let parsed;
      try {
        parsed = await parse(Buffer.concat(chunks), {
          skipHtmlToText: true,
          skipTextToHtml: true,
        });
      } catch {
        await removeRaw();
        console.info("eligibility_email_rejected_format");
        continue;
      }
      const from = parsed.from?.value;
      if (!from || from.length !== 1 || !from[0].address) {
        await removeRaw();
        console.info("eligibility_email_rejected_sender");
        continue;
      }
      const sender = from[0].address.trim().toLowerCase();
      const recipients = record.ses.receipt.recipients; // SMTP envelope, never an untrusted To header
      const attachments = (parsed.attachments ?? []).filter((a) =>
        /\.(csv|xlsx|txt|json)$/i.test(a.filename ?? ""),
      );
      if (
        !Array.isArray(recipients) ||
        !attachments.length ||
        attachments.length > 5
      ) {
        await removeRaw();
        console.info("eligibility_email_rejected_attachments");
        continue;
      }
      const receipts = [];
      let refused = 0;
      for (const [index, attachment] of attachments.entries()) {
        if (
          !attachment.content.length ||
          attachment.content.length > MAX_FILE_BYTES
        ) {
          refused++;
          continue;
        }
        const body = JSON.stringify({
          sender,
          recipients,
          messageId: `${messageId}:${index}`,
          fileName: attachment.filename,
          fileBytes: attachment.content.length,
          dmarc: record.ses.receipt.dmarcVerdict.status,
          spam: record.ses.receipt.spamVerdict.status,
          virus: record.ses.receipt.virusVerdict.status,
        });
        const preparation = await fetcher(`${base}/eligibility/email/prepare`, {
          method: "POST",
          headers: signedHeaders(body, env.INTAKE_BRIDGE_SECRET),
          body,
          signal: AbortSignal.timeout(20000),
        });
        if ([400, 401, 403].includes(preparation.status)) {
          // Never reply to unapproved senders; avoid backscatter and address enumeration.
          if (preparation.status === 401)
            throw new Error("Email bridge authentication failed");
          refused++;
          continue;
        }
        if (!preparation.ok)
          throw new Error("Email intake is temporarily unavailable");
        const ticket = await preparation.json();
        if (new URL(ticket.uploadUrl).origin !== new URL(base).origin)
          throw new Error("Unexpected upload endpoint");
        const upload = await fetcher(ticket.uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Upload-Token": ticket.uploadToken,
          },
          body: attachment.content,
          signal: AbortSignal.timeout(30000),
        });
        if (upload.status === 400 || upload.status === 403) {
          refused++;
          continue;
        }
        if (!upload.ok)
          throw new Error("Attachment submission is temporarily unavailable");
        const result = await upload.json();
        receipts.push(result.receiptId);
      }
      if (receipts.length && env.RECEIPT_FROM) {
        try {
          await ses.send(
            new SendEmailCommand({
              FromEmailAddress: env.RECEIPT_FROM,
              Destination: { ToAddresses: [sender] },
              Content: {
                Simple: {
                  Subject: {
                    Data: "Ideal eligibility submission received",
                    Charset: "UTF-8",
                  },
                  Body: {
                    Text: {
                      Data: `Your submission was received for review. Member coverage has not been changed.\n\nReceipt(s):\n${receipts.join("\n")}\n\n${refused ? `${refused} attachment(s) were not accepted. Use the upload page or contact Ideal for help.\n\n` : ""}You can check submissions at https://getidealoh.com/employer/upload.\nDo not include member information in email subjects or replies.`,
                      Charset: "UTF-8",
                    },
                  },
                },
              },
            }),
          );
        } catch {
          console.warn("eligibility_receipt_delivery_failed");
        }
      }
      await removeRaw();
      console.info("eligibility_email_completed", {
        accepted: receipts.length,
        refused,
      });
    }
  };
}
export const handler = createHandler();
