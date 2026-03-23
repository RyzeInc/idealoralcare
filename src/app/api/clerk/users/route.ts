import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * GET /api/clerk/users
 * 
 * Fetches all users from Clerk
 * Requires admin authentication
 * 
 * Query params:
 * - search: Optional search term for email/name
 * - limit: Max results (default 50)
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
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!process.env.CLERK_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Clerk API not configured' },
        { status: 500 }
      );
    }

    // Call Clerk API to get users, forwarding search and limit
    const clerkUrl = new URL('https://api.clerk.com/v1/users');
    clerkUrl.searchParams.set('limit', String(Math.min(limit, 100)));
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

    const data = await clerkResponse.json();
    const users = data.data || [];

    // Transform to clean format
    const formattedUsers = users.map((user: any) => ({
      id: user.id,
      email: user.email_addresses?.[0]?.email_address || '',
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      imageUrl: user.image_url,
      createdAt: user.created_at,
    }));

    return NextResponse.json({
      users: formattedUsers,
      total: formattedUsers.length,
    });
  } catch (error) {
    console.error('[clerk-users] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
