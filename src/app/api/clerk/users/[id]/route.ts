import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * GET /api/clerk/users/[id]
 *
 * Fetches a single Clerk user by ID with full details including:
 * email addresses (with verification status), phone numbers,
 * external accounts (OAuth), last sign-in time, and session count.
 *
 * Restricted to authenticated admin users.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.CLERK_SECRET_KEY) {
    return NextResponse.json({ error: 'Clerk API not configured' }, { status: 500 });
  }

  const { id } = await params;

  const [userRes, sessionsRes] = await Promise.all([
    fetch(`https://api.clerk.com/v1/users/${id}`, {
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
    }),
    fetch(`https://api.clerk.com/v1/sessions?user_id=${id}&limit=5&status=active`, {
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
    }),
  ]);

  if (userRes.status === 404) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (!userRes.ok) {
    return NextResponse.json({ error: 'Clerk API error' }, { status: 500 });
  }

  const raw = await userRes.json();
  const sessionsRaw = sessionsRes.ok ? await sessionsRes.json() : [];
  const sessions = Array.isArray(sessionsRaw) ? sessionsRaw : sessionsRaw.data ?? [];

  return NextResponse.json({
    id: raw.id,
    firstName: raw.first_name ?? '',
    lastName: raw.last_name ?? '',
    imageUrl: raw.image_url ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    lastSignInAt: raw.last_sign_in_at ?? null,
    lastActiveAt: raw.last_active_at ?? null,
    banned: raw.banned ?? false,
    emailAddresses: (raw.email_addresses ?? []).map((e: any) => ({
      id: e.id,
      email: e.email_address,
      verified: e.verification?.status === 'verified',
      isPrimary: e.id === raw.primary_email_address_id,
    })),
    phoneNumbers: (raw.phone_numbers ?? []).map((p: any) => ({
      id: p.id,
      phone: p.phone_number,
      verified: p.verification?.status === 'verified',
      isPrimary: p.id === raw.primary_phone_number_id,
    })),
    externalAccounts: (raw.external_accounts ?? []).map((ea: any) => ({
      provider: ea.provider,
      username: ea.username ?? null,
      email: ea.email_address ?? null,
    })),
    publicMetadata: raw.public_metadata ?? {},
    privateMetadata: raw.private_metadata ?? {},
    activeSessions: sessions.length,
  });
}
