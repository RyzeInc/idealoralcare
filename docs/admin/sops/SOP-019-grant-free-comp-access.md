# SOP-019: Grant Free / Comp Access

**Purpose:** Give someone a plan at $0 — whether to test member-facing features as yourself or to comp a real member — and understand which of those paths has a working button today versus which requires engineering.

**Who can do this:** Any admin (Owner or Editor).

**When you'd do this:** You need to walk through member-facing flows as yourself, or an employer/VIP member should have coverage without being charged.

**Before you begin:** Read the first troubleshooting note before you click anything — the one-click "Grant Free Access" button on the Dashboard grants access to **your own admin account only**, not to another member. Comping an actual member is a different path (below).

**Related guide:** [Dashboard](../guide/00-overview.md#2-dashboard-admin), [Eligibility Files](../guide/02-operations.md#eligibility-files-admineligibility)

## Steps — give yourself full access (for testing)

1. Go to the **Dashboard** (`/admin`).
2. Under Quick Actions, click **Grant Free Access**.
3. This gives your own admin account a 365-day comp subscription to every plan, so you can walk through member-facing flows as yourself.

## Steps — comp real members (employer-paid $0)

The supported way to give members free coverage is the employer-paid $0 bundle created during eligibility provisioning:

4. Load the members via an eligibility file for their Group ([SOP-003](SOP-003-bulk-enroll-eligibility-file.md)).
5. On that file's row, click **Grant Access**, select the members, and send the invite. This creates their login and links a $0 employer-paid plan — comp access, done the supported way.

## Steps — comp one specific individual outside eligibility

6. There is no admin UI button for arbitrarily comping a single member who didn't come through an eligibility file. The underlying tools (`grantFreePlanAccess`, `createFreeBundle`) exist but are CLI-only — they require a specific customer ID, product ID, and bundle ID. If you truly need this for one person, ask engineering to run it.

## Verification

- **Giving yourself access:** load a member-facing page as yourself — you now have entitlements to every plan.
- **Comping a member:** the member shows an active entitlement with a $0 amount (check their record in [Members](../guide/01-members-partners.md#members-adminmembers) or [User Lookup](../guide/04-support-system.md#user-lookup-adminuser-audit)).

## If something goes wrong

- **You clicked the Dashboard "Grant Free Access" expecting to comp a member** — it only comps you. Use the employer-paid $0 bundle path (steps 4–5) for a real member.
- **You need to comp a walk-in member not tied to an employer group** — that path is CLI-only today; loop in engineering.
- **Someone found `/bootstrap` and it granted them access** — that is a separate, known-risky page that also self-promotes the visitor to Owner; flag it to engineering (see [guide/05-known-issues.md](../guide/05-known-issues.md), item S1). It is not a comp tool.

## Related SOPs

- [SOP-003](SOP-003-bulk-enroll-eligibility-file.md) — the supported way to comp members at scale (employer-paid $0 bundles).
- [SOP-010](SOP-010-refund-or-cancel-subscription.md) — if instead you meant to refund or cancel a paid member.
