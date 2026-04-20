import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * GET /api/clerk/users
 * 
 * Fetches users from Clerk
 * Requires authentication
 * 
 * Query params:
 * - search: Optional search term for email/name
 * - limit: Max results (default 50, max 100)
 * - offset: Pagination offset (default 0)
 * - created_after: Unix ms — only users created after this date
 * - created_before: Unix ms — only users created before this date
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get search params
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const createdAfter = searchParams.get('created_after');
    const createdBefore = searchParams.get('created_before');

    if (!process.env.CLERK_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Clerk API not configured' },
        { status: 500 }
      );
    }

    // Call Clerk API to get users, forwarding search and limit
    const clerkUrl = new URL('https://api.clerk.com/v1/users');
    clerkUrl.searchParams.set('limit', String(limit));
    clerkUrl.searchParams.set('offset', String(offset));
    clerkUrl.searchParams.set('order_by', '-created_at');
    if (search) {
      clerkUrl.searchParams.set('query', search);
    }

    const clerkResponse = await fetch(clerkUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!clerkResponse.ok) {
      console.error('[clerk-users] Clerk API error:', clerkResponse.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch users from Clerk' },
        { status: 500 }
      );
    }

    const totalCount = parseInt(clerkResponse.headers.get('x-total-count') || '0');
    const data = await clerkResponse.json();
    // Clerk /v1/users returns a flat array, not { data: [] }
    const users = Array.isArray(data) ? data : data.data || [];

    // Transform to clean format
    let formattedUsers = users.map((user: any) => ({
      id: user.id,
      email: user.email_addresses?.[0]?.email_address || '',
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      imageUrl: user.image_url,
      createdAt: user.created_at,
    }));

    // Apply date range filter client-side (Clerk API doesn't natively support date filtering)
    if (createdAfter) {
      const afterMs = parseInt(createdAfter);
      formattedUsers = formattedUsers.filter((u: any) => u.createdAt >= afterMs);
    }
    if (createdBefore) {
      const beforeMs = parseInt(createdBefore);
      formattedUsers = formattedUsers.filter((u: any) => u.createdAt <= beforeMs);
    }

    return NextResponse.json({
      users: formattedUsers,
      total: totalCount || formattedUsers.length,
      offset,
      limit,
    });
  } catch (error) {
    console.error('[clerk-users] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
