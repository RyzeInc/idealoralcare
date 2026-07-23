# SOP-012: Add, Remove, or Change an Admin User's Role

**Purpose:** Grant or revoke admin-portal access, including the very first admin on a fresh deployment.

**Who can do this:** Any existing admin (Owner or Editor) — **read this whole SOP before acting**, since there is currently no backend safeguard stopping an Editor from removing the last Owner, or from promoting anyone (including themselves) to Owner. Be as careful as if this page enforced Owner-only, even though it doesn't.

**Related guide:** [Admin Users](../guide/04-support-system.md#admin-users-adminusers), [00-overview.md §1](../guide/00-overview.md#1-the-permission-model-read-this-first)

## Steps — first admin on a fresh deployment

1. Go to `/admin/users`. If zero admins exist, you'll see **Initialize First Admin**.
2. Sign up/in at `/health/sign-in` first if you haven't already, and get your Clerk User ID from the Clerk dashboard (Users → your account → User ID, format `user_xxxxx`).
3. Click **Initialize First Admin**, paste your Clerk User ID, fill in name/email, submit. This only works while the admin table is completely empty — it's the safe path.
4. **⚠️ Do not use `/bootstrap` for this.** It's a separate, less-safe page that doesn't check whether admins already exist — see the warning in [guide/00-overview.md §1](../guide/00-overview.md#first-admin-bootstrapping-two-different-paths-one-of-them-risky). Always use step 3 above.

## Steps — invite a new admin (has never signed up before)

5. Go to `/admin/users` → **Invite Admin**.
6. Fill in Full Name, Email, Role (Owner/Editor — see the caveat below about what this actually restricts), and Department tags.
7. Click **Send Invitation**. Clerk emails them a sign-up link; the invite is valid for 30 days.
8. If the toast reports the email failed to send but the invite was created, use **Resend** from the Pending Invitations table once the underlying issue (e.g., email deliverability) is resolved.

## Steps — add someone who already has a Clerk account

9. **Add Existing User** → search the live directory by name/email → click the result → they're added immediately, with the role/departments you selected, no invite/email step involved.

## Steps — change a role or remove access

10. To change a role: use the inline dropdown next to their name in the Current Admin Users table. **This applies immediately with no confirmation** — double-check you've selected the right person and role before choosing it.
11. To remove access: click **Remove** → confirm the dialog. This is an immediate, permanent delete of their admin-access record (it does not delete their Clerk account or member profile — only their admin permissions).

## Verification

- The admin should appear in the Current Admin Users table with the correct role/department tags.
- Ask them to sign in and confirm they land on `/admin` rather than being redirected to `/health`.

## Before you remove or demote anyone — read this

- **There is no "last owner" or "last admin" protection.** If you remove or demote the only Owner, no error will stop you — you could lock the team out of Dev Tools, or (if you remove every admin) re-expose "Initialize First Admin" to whoever visits next. Before removing/demoting someone, confirm at least one other trustworthy Owner will remain.
- **Owner vs. Editor is mostly a label today.** Don't assume setting someone to "Editor" restricts them from refunds, cancellations, site settings, or managing other admins — none of that is actually enforced backend-side except the Dev Tools page. If you need a real access boundary, that's a product gap to raise with engineering, not something this page can currently guarantee.

## If something goes wrong

- **You accidentally removed the last admin** — you'll need to use `/bootstrap` or a CLI-based bootstrap to regain access, since "Initialize First Admin" also requires zero admins to already be true (which it now is) — but be aware `/bootstrap` itself is the known-risky path (see above); loop in engineering if this happens for real rather than treating it as routine.
- **A new admin says they never got their invite email** — check Pending Invitations for their entry and click **Resend**; if it's not there at all, the invite may have failed outright — just re-invite them.
- **"Add Existing User" search doesn't find someone** — confirm they've actually signed up at `/health/sign-in` first; this search only surfaces existing Clerk accounts, it can't invite someone who's never signed up (use Invite Admin for that instead).

## Related SOPs

None — this is typically a standalone administrative action, though it's often the first step before delegating any other SOP in this library to a new teammate.
