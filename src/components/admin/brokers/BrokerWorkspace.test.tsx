// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import type { Id } from '@/convex/_generated/dataModel';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  mutate: vi.fn(),
  push: vi.fn(),
  tab: 'overview',
}));
vi.mock('convex/react', () => ({
  useQuery: mocks.query,
  useMutation: () => mocks.mutate,
  useAction: () => mocks.mutate,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/brokers/p1',
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams({ tab: mocks.tab }),
}));
vi.mock('@/components/admin/ui', async (orig) => ({
  ...(await orig<typeof import('@/components/admin/ui')>()),
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), fromError: vi.fn() }),
}));
import { BrokerWorkspace } from './BrokerWorkspace';

const fixture = () => ({
  partner: {
    _id: 'p1', _creationTime: 0, name: 'Coastal Benefits', type: 'agency', contactName: 'Jane Smith',
    contactEmail: 'jane@coastal.dev', status: 'active', overrideRate: 5, agencyCode: '1000',
    effectiveDate: '2026-01-15', createdAt: 0, updatedAt: 0,
  },
  upline: { id: 'fmo1', name: 'Apex FMO', type: 'fmo', status: 'active' },
  leaders: [
    { _id: 'l1', _creationTime: 0, partnerId: 'p1', name: 'Jane Smith', email: 'jane@coastal.dev', isPrimary: true, clerkUserId: 'u1', inviteStatus: 'claimed', reportScope: 'agency', createdAt: 0, updatedAt: 0, hasOpenInvite: false },
    { _id: 'l2', _creationTime: 0, partnerId: 'p1', name: 'Rob Rep', email: 'rob@coastal.dev', isPrimary: false, inviteStatus: 'pending', inviteExpiry: Date.now() + 86_400_000, createdAt: 0, updatedAt: 0, hasOpenInvite: true },
  ],
  downline: [{ id: 'sub1', name: 'Harbor Agency', type: 'agency', status: 'active', direct: true }],
  codes: [{ id: 'c1', code: '100001', slug: 'janesmith01', brokerId: 'l1', status: 'active', usageCount: 3, createdAt: 0 }],
  activity: [{ id: 'a1', action: 'partner.created', summary: 'Created Coastal Benefits and primary contact', actorName: 'Dylan', createdAt: 0 }],
  applications: [],
  activeMemberCount: 4,
  members: [],
  hasMoreMembers: false,
});

const renderAt = (tab: string, data: unknown = fixture()) => {
  mocks.tab = tab;
  mocks.query.mockImplementation(() => data);
  return render(<BrokerWorkspace partnerId={'p1' as Id<'distributionPartners'>} />);
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('BrokerWorkspace', () => {
  test('overview shows the profile and outstanding onboarding work', () => {
    renderAt('overview');
    expect(screen.getByRole('heading', { name: 'Coastal Benefits' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Apex FMO' })).toHaveAttribute('href', '/admin/brokers/fmo1');
    const checklist = screen.getByRole('region', { name: 'Onboarding checklist' });
    // Rob has no rep code yet.
    expect(within(checklist).getByText('1 team member without a code')).toBeInTheDocument();
  });

  test('team tab shows each account state and what their role can read', () => {
    renderAt('team');
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Invite pending')).toBeInTheDocument();
    expect(screen.getByLabelText('Access role for Jane Smith')).toHaveValue('agency');
    expect(screen.getByText('All of Coastal Benefits')).toBeInTheDocument();
  });

  test('changing an access role saves it immediately', async () => {
    renderAt('team');
    mocks.mutate.mockResolvedValue(undefined);
    await userEvent.selectOptions(screen.getByLabelText('Access role for Rob Rep'), 'none');
    expect(mocks.mutate).toHaveBeenCalledWith({ leaderId: 'l2', portalAccess: false });
  });

  test('codes tab offers to issue the missing rep code', () => {
    renderAt('codes');
    expect(screen.getByRole('button', { name: /Issue 1 missing rep code/ })).toBeInTheDocument();
    expect(screen.getByText('Without a code: Rob Rep')).toBeInTheDocument();
  });

  test('an unknown broker says so', () => {
    renderAt('overview', null);
    expect(screen.getByRole('heading', { name: 'Broker not found' })).toBeInTheDocument();
  });
});
