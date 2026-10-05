# Access & roles

Who can sign in, what they are, and what they can do. Managed at **Admin → System → Access & Roles** (`/admin/access`), which needs the *Manage access* permission (owners have it).

## The model

- **Person** — one per email address. Becomes linked to a Clerk account when they accept an invitation.
- **Role** — what the person is, and what it is tied to. One person can hold several:

  | Role | Tied to | Reaches |
  | --- | --- | --- |
  | Staff | — | Admin console |
  | Program Manager, FMO, Agency | Their partner | Partner portal (their partner and its downline) |
  | Broker, Rep | The agency they work under, and their person record there (book, rep codes) | Partner portal (their own book) |
  | Organization | An employer group | Eligibility uploads for that group |
  | Carrier | Carrier name | Sign-in only — carrier tools are not built yet |

  A broker who is also a rep and heads a Program Manager has three roles. In the partner portal they choose which one they are viewing as (sidebar, or **My access** at `/access`).

- **Access pack** — a named set of permissions carried by a role. A role's links decide *whose* data it reaches; its packs decide *what* it can do there. A role can carry several packs.

## Built-in packs

Deliberately narrow. Each grants the least a job needs; add a second pack or edit a pack for more.

| Pack | For | Grants |
| --- | --- | --- |
| Owner | Staff | The whole admin console, including managing access and developer tools. Only owners can grant it. |
| Staff — legacy full console | Staff | What editors had before packs, minus managing access, dev tools and CRM management. Given to existing editors on import. |
| CRM manager | Staff | Bulk CRM changes, deletes, imports, campaign sends. |
| Sales | Staff | CRM; view partners and rep codes. |
| Customer support | Staff | View members; customer service and member email. |
| Eligibility operations | Staff | Process eligibility files and employer intake; view members, groups and vendor files. |
| Partner operations | Staff | Manage partners, reps and rep codes; view groups. |
| Finance | Staff | Billing, list-bill invoices, vendor statements; view commissions, members and groups. |
| Content editor | Staff | Site content, resources library, shop. No member or financial data. |
| Read-only reviewer | Staff | View-only across members, partners, operations, finance and the audit log. |
| Partner — legacy portal | Partner roles | Every partner portal page. Given to existing partners on import. |
| Partner leadership | PM, FMO, Agency | Own book, downline, employer groups, resources. |
| Broker / rep — own book | Broker, Rep, Agency | Own book and resources. |
| Resources only | Partner roles | Resources library only. |
| Organization — eligibility uploads | Organization | Upload rosters for their own group. Staff still review every file. |
| Carrier — sign-in only | Carrier | Nothing yet. |

Built-in packs can be edited and later reset. Custom packs can be created, copied and archived. **Preview & demo** shows exactly what a mix of roles and packs opens, using the same rules the server enforces; **Compare** puts every pack against every permission.

## Rules that keep access from widening

- Permissions are checked by every server function, not just hidden in menus. Each admin module requires a specific permission (view for reads, manage for changes).
- Admin-console permissions only work on a staff role; partner-portal permissions only on partner roles; uploads only on organization roles. No custom pack can give a broker the admin console.
- Nobody can grant admin permissions they do not hold, or the Owner pack unless they are an owner. Only owners can change an owner's access. Nobody can change their own access. At least one active owner always remains.
- Suspending a person (or a role) closes it everywhere at once, including the older tables each portal reads (`adminUsers`, `partnerLeaders`, employer upload grants).
- Invitation links are single-use, expire in 14 days, are stored only as a SHA-256 hash, and work only for an account whose **verified** email matches (checked against Clerk's API when `CLERK_SECRET_KEY` is set on Convex).

## Rolling it out

1. Deploy. Nothing changes for anyone yet except: editors can no longer manage admin users, use dev tools, or (outside the executive department) manage the CRM. Only owners can grant or remove owner access.
2. Open **Access & Roles → Import existing** and import. Everyone gets a person, roles and packs matching what they already had.
3. Review **People**. Replace "Staff — legacy full console" with narrower packs, and "Partner — legacy portal" where a partner should see less.
4. Invite new people from **People → Invite person**.

The older **Admin users** page (`/admin/users`) still works and stays in step; it is linked from Access & Roles.

## Code

- `convex/lib/access/catalog.ts` — roles, permissions, built-in packs, which pages each permission opens.
- `convex/lib/access/resolve.ts` — effective permissions; people without a profile keep their pre-pack access.
- `convex/lib/access/provision.ts` — keeps `adminUsers`, `partnerLeaders` and upload grants in step with roles.
- `convex/lib/authGuards.ts` — `requireAccess(ctx, "members.view")`, `requireAccessAction`.
- `convex/access/*` — people, invitations, packs, import, my access. Tests in `convex/access/access.test.ts`.
