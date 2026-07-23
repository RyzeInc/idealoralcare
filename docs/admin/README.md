# Admin Suite Documentation

Two things live here:

1. **[`guide/`](guide/00-overview.md)** — an explanation guide covering every page in `/admin/*`: what it's for, what you can click, and how it actually works underneath (which Convex functions run, what they validate, where the real limits are). Read this to understand a feature.
2. **[`sops/`](sops/README.md)** — a concrete Standard Operating Procedure library: step-by-step runbooks for the tasks admins actually perform, often spanning multiple pages. Follow this to *do* a task.

Both were written by reading the current source code directly (not by summarizing older docs), so they reflect what the app does today, including several places where a button exists but doesn't do what its label implies. Every one of those is called out inline with a ⚠️ and consolidated in **[guide/05-known-issues.md](guide/05-known-issues.md)**.

## Start here

- New to the admin suite? Read [guide/00-overview.md](guide/00-overview.md) first — it covers the permission model (which is not what the UI implies), the Site/Account/Group hierarchy, and the member lifecycle. Everything else assumes you've read it.
- Need to do something specific right now? Go straight to [sops/README.md](sops/README.md) and find the matching procedure.
- Wondering whether something you're looking at actually works? Check [guide/05-known-issues.md](guide/05-known-issues.md) before assuming a broken result is your mistake.

## How this relates to other docs in the repo

- `ADMIN_QUICK_START.md` (repo root) is the older, higher-level onboarding doc — still useful for first-time platform setup (Clerk account creation, initial site config). This guide is the deeper reference for day-to-day feature use.
- `/admin/help` (in-app) is a lightweight in-product glossary/cheat-sheet — this guide is the fuller version of the same material, plus the internal "how it works" detail the in-app page doesn't have room for.
- `docs/internal/` holds engineering specs (Invoice Calculator, List-Bill Invoices, Rep Code system, Finance Platform Evaluation) that this guide draws on and links to directly where relevant — read those if you need implementation-level detail beyond what an admin needs day-to-day.

## Structure

```
docs/admin/
  README.md                    ← you are here
  guide/
    00-overview.md              Permission model, hierarchy, member lifecycle, dashboard, nav map
    01-members-partners.md      Members, Distribution/"Brokers", Partner Applications, Rep Codes
    02-operations.md            Hierarchy, Eligibility Files, Vendor Files
    03-finance.md                Billing, List-Bill, List-Bill Invoices, Invoice Calculator, Commissions
    04-support-system.md        Customer Service, Admin Users, User Audit, Audit Log, Site Settings, Dev Tools
    05-known-issues.md          Every bug/stub found, severity-tagged
  sops/
    README.md                    Index of all SOPs
    SOP-*.md                     Individual procedures
```
