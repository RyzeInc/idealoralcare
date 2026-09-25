import { describe, expect, test } from 'vitest';
import { accessRoleFields, accessRoleOf, accountStateOf, buildChecklist, type ChecklistInput } from './shared';

const base = (): ChecklistInput => ({
  partner: { status: 'active', type: 'agency', overrideRate: 5, agencyCode: '1000' },
  leaders: [{ _id: 'l1', isPrimary: true, clerkUserId: 'user_1', inviteStatus: 'claimed' }],
  codes: [{ brokerId: 'l1', status: 'active' }],
  applications: [],
  activeMemberCount: 0,
});

const step = (input: ChecklistInput, key: string) => buildChecklist(input).find((s) => s.key === key)!;

describe('access roles', () => {
  test('legacy team members with no stored fields are producers', () => {
    expect(accessRoleOf({})).toBe('own');
  });
  test('turning access off wins over any report scope', () => {
    expect(accessRoleOf({ portalAccess: false, reportScope: 'downline' })).toBe('none');
    expect(accessRoleFields('none')).toEqual({ portalAccess: false });
    expect(accessRoleFields('agency')).toEqual({ portalAccess: true, reportScope: 'agency' });
  });
  test('account state distinguishes an expired invite from a pending one', () => {
    expect(accountStateOf({ inviteStatus: 'pending', inviteExpiry: 100 }, 200)).toBe('expired');
    expect(accountStateOf({ inviteStatus: 'pending', inviteExpiry: 300 }, 200)).toBe('pending');
    expect(accountStateOf({ clerkUserId: 'u', portalAccess: false }, 200)).toBe('disabled');
  });
});

describe('buildChecklist', () => {
  test('a fully set-up broker completes every required step', () => {
    expect(buildChecklist(base()).filter((s) => !s.optional).every((s) => s.done)).toBe(true);
  });

  test('a revoked code does not count as issued', () => {
    const input = base();
    input.codes = [{ brokerId: 'l1', status: 'revoked' }];
    expect(step(input, 'repCodes').done).toBe(false);
  });

  test('contacts kept off the portal are not counted as waiting on an invite', () => {
    const input = base();
    input.leaders.push({ _id: 'l2', isPrimary: false, portalAccess: false });
    expect(step(input, 'invite').detail).toBe('1 of 1 invited');
  });

  test('an override rate is optional only for an independent agency', () => {
    const input = base();
    input.partner.overrideRate = undefined;
    expect(step(input, 'compensation').optional).toBe(true);
    input.partner.parentId = 'upline';
    expect(step(input, 'compensation').optional).toBe(false);
  });
});
