import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

/**
 * POST /api/send-gmail
 *
 * Sends email via Gmail SMTP (Google Workspace).
 * Used by Convex actions to send admin/internal emails without Resend.
 *
 * Authorization: Bearer {INTERNAL_API_SECRET}
 *
 * Request body: { to, subject, html, replyTo? }
 */
export async function POST(req: NextRequest) {
  // Internal secret guard
  const secret = process.env.INTERNAL_API_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailAppPassword) {
    return NextResponse.json(
      { error: "Gmail SMTP not configured (GMAIL_USER / GMAIL_APP_PASSWORD)" },
      { status: 500 }
    );
  }

  let body: { to: string; subject: string; html: string; replyTo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.to || !body.subject || !body.html) {
    return NextResponse.json(
      { error: "Missing required fields: to, subject, html" },
      { status: 400 }
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    const info = await transporter.sendMail({
      from: `Ideal Oral Health <${gmailUser}>`,
      to: body.to,
      subject: body.subject,
      html: body.html,
      replyTo: body.replyTo ?? "support@getidealoh.com",
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error("Gmail SMTP send failed:", err);
    return NextResponse.json(
      { error: `Gmail send failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
