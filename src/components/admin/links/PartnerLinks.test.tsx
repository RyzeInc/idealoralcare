// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({ rows: [] as unknown[], mutate: vi.fn() }));
vi.mock('convex/react', () => ({
  useQuery: () => mocks.rows,
  useMutation: () => mocks.mutate,
}));
vi.mock('@/components/admin/ui', async (orig) => ({
  ...(await orig<typeof import('@/components/admin/ui')>()),
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), fromError: vi.fn() }),
}));
import { PartnerLinks } from './PartnerLinks';

const row = (over: Record<string, unknown>) => ({
  id: 'c1', name: 'Allen Jackson', detail: 'Harbor Agency', email: 'allen@harbor.test', holderType: 'broker',
  code: '100001', ending: 'allenjackson01', landing: null, active: true, activeMembers: 2, endedMembers: 1, linkVisits: 22, lastUsedAt: null, createdAt: 0, ...over,
});

afterEach(() => { cleanup(); mocks.mutate.mockReset(); });

describe('PartnerLinks', () => {
  test('lists active AssureVantage links and hides turned-off ones until asked', async () => {
    mocks.rows = [row({}), row({ id: 'c2', name: 'Old Rep', ending: 'oldrep', code: '100002', active: false })];
    render(<PartnerLinks />);
    expect(screen.getByText('https://www.assurevantage.com/allenjackson01')).toBeInTheDocument();
    expect(screen.queryByText('Old Rep')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/Show turned off \(1\)/));
    expect(screen.getByText('Old Rep')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turn back on' })).toBeInTheDocument();
  });

  test('adding sends only the fields that apply to the chosen type', async () => {
    mocks.rows = [];
    mocks.mutate.mockResolvedValue({ id: 'c9', code: '100101', ending: 'lakesidechamber' });
    render(<PartnerLinks />);
    await userEvent.click(screen.getByRole('button', { name: /Add a broker or partner/ }));
    await userEvent.selectOptions(screen.getByLabelText('What are they?'), 'organization');
    await userEvent.type(screen.getByLabelText('Organization name'), 'Lakeside Chamber');
    await userEvent.type(screen.getByLabelText('Email'), 'pat@lakeside.test');
    expect(screen.queryByLabelText(/Part of/)).not.toBeInTheDocument();
    expect(screen.getByText('https://www.assurevantage.com/lakesidechamber')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Add and copy link/ }));
    expect(mocks.mutate).toHaveBeenCalledWith({
      holderType: 'organization', name: 'Lakeside Chamber', contactName: undefined, email: 'pat@lakeside.test',
      phone: undefined, organizationId: undefined, ending: undefined, code: undefined, landing: undefined,
    });
  });

  test('turning a link off asks first', async () => {
    mocks.rows = [row({})];
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<PartnerLinks />);
    await userEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    expect(mocks.mutate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    expect(mocks.mutate).toHaveBeenCalledWith({ id: 'c1', active: false });
    confirm.mockRestore();
  });
});
