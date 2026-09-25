# SOP-018: Create and Manage Rep Codes

**Purpose:** Create and manage the tracking codes that credit a sale to a specific salesperson and their agency for commission — including giving an agency its 4-digit prefix, generating share links, and revoking or deleting codes.

**Who can do this:** Any admin (Owner or Editor).

**When you'd do this:** A new rep needs a code, an agency needs its numbering set up, or you need to retire a code.

**Before you begin:** A Rep Code is a short code (and matching web link) that, when a member uses it at sign-up, credits that sale to the rep. It is separate from the Account hierarchy — see the [glossary](README.md#the-words-youll-see).

**Related guide:** [Rep Codes](../guide/01-members-partners.md#rep-codes-adminrep-codes)

## Steps — give an agency its 4-digit code (once per agency)

1. Go to **Rep Codes** (`/admin/rep-codes`).
2. Click **Add Rep Code** and choose the agency in the Agency/FMO dropdown.
3. Click **Assign 4-Digit Code** next to it, and confirm. Every rep code under this agency will start with these four digits. (Safe to click again later — it just returns the existing code.)

## Steps — create a code for a rep

4. Click **Add Rep Code**.
5. Pick the agent: search existing users, or paste their Clerk User ID if they haven't signed up yet.
6. Pick the agency (optional):
   - If the agency has a 4-digit code (from step 3): First/Last Name fields appear with a **live preview** of the auto-generated code and web link — review it, then **Create Rep Code**.
   - If not: type a code manually, or click **Generate** for a random one.
7. Give the rep their code and share link: `https://getidealoh.com/health/plans?ref=THEIRCODE`.

## Steps — housekeeping

8. **Backfill Slugs** (top button) bulk-creates missing web-link slugs for existing active codes; safe to run at any time.
9. **Revoke / Reactivate** (row action) flips a code on or off; existing credited sales are unaffected either way.
10. **Delete** (row action) is permanent with no undo — past sales keep their record, but the code's commission linkage is gone.

## Verification

- Search the new code — Agent, Agency, and Status look right, and **Uses** starts at 0.
- The stat tiles (Total Codes / Active / Total Uses / Revoked) update to match.

## If something goes wrong

- **It won't let you reuse a code or slug** — codes and links must be unique (case-insensitive), and some words are reserved (`admin`, `api`, `login`, `checkout`, `enroll`, and others). Pick another.
- **You set a link slug and now want to clear it** — you can't; the app can change a slug but not remove one. This is a known gap, not a mistake on your part. Leave it, or change it to something else.
- **The Commission % shows blank** — it may genuinely be unset, or a rate-lookup miss across the several matching paths. Check [Commissions](../guide/03-finance.md#commissions-admincommissions) directly before assuming (note that Commissions figures are currently flagged unreliable).
- **You need a history of who created or deleted a code** — Rep Code actions aren't written to the audit log. Record it manually if it matters.

## Related SOPs

- [SOP-004](SOP-004-onboard-broker-agency-and-reps.md) — the full broker/agency and rep onboarding this fits into.
