# Phase-3 Table Rename Migration Plan (STAGED — DO NOT RUN YET)

> **Status:** Drafted, **NOT executed**. Awaiting explicit user approval.
>
> This migration renames four Convex tables and rewrites every reference
> across the codebase. Convex does not support live table renames — the
> only safe path is a 4-step copy/cutover that you orchestrate from the
> deployed environment with downtime (or a feature-flag cutover for
> reads/writes). Read this document end-to-end before running anything.

## Scope of renames

| Old table              | New table         | Rationale                                                                 |
|------------------------|-------------------|---------------------------------------------------------------------------|
| `groups`               | `organizations`   | UI surfaces "Organization"; "group" was vendor-spec terminology only.     |
| `distributionPartners` | `brokers`         | UI uses "Broker"; matches sales/legal nomenclature.                        |
| `partnerLeaders`       | `representatives` | Person who manages a broker relationship is consistently a "representative". |
| `sites`                | `carriers`        | Single-row table representing the carrier (Ideal Oral Health).            |

`accounts` is intentionally NOT renamed in Phase 3 — open question per the plan
about whether `accounts` and `distributionPartners` should collapse. Resolve
that first; until then, `accounts` keeps its current name.

## High-level migration steps

1. **Pre-flight (no production impact)**
   - Branch the repo. All work happens on `feat/phase3-rename`.
   - Audit code references (this file's appendix has the grep commands).
   - Add new tables to `convex/schema.ts` *alongside* the old ones (parallel
     definitions, identical columns + indexes).
   - Deploy schema. Both old + new tables exist; new ones are empty.

2. **Backfill (read-only window OK)**
   - Run an internal mutation per pair that streams every row from the old
     table into the new table, preserving `_id` mapping in a side table
     `_renameMap_<oldName>` keyed by old `_id` → new `_id`.
   - At end of each backfill, log row counts to `adminAuditLog`.

3. **Cutover (writes paused)**
   - Pause admin write traffic (or take a brief maintenance window).
   - Run delta backfill (any rows added during step 2).
   - Flip the codebase: rewrite every `db.query("groups")` →
     `db.query("organizations")`, every `v.id("groups")` →
     `v.id("organizations")`, etc. Use the appendix grep+sed list.
   - Update all foreign-key fields on referencing tables (e.g.
     `memberProfiles.groupId` → `memberProfiles.organizationId`). This is
     the biggest blast-radius change — 100+ files.
   - Regenerate Convex types: `npx convex codegen`.
   - Run typecheck + tests.
   - Deploy.

4. **Cleanup (post-cutover, separate PR)**
   - After 1+ week of stable production, drop the old tables from the
     schema and run `internalMutation`s to delete their rows.
   - Remove `_renameMap_*` tables.

## Why this is risky

- Convex `_id`s are table-scoped. After the rename, every existing
  `Id<"groups">` value in any other document is now invalid against the
  new `organizations` table. The migration MUST patch every foreign key
  on every referencing document. Missed references will not surface as
  type errors — they'll surface as `db.get(id)` returning `null`.
- 100+ files reference the old table names directly or via generated
  types. A single missed call site silently breaks at runtime.
- The Convex dashboard will show the old empty tables until step 4.

## Appendix: Reference audit

Run this inventory **before** scheduling the migration. Any number > 0
must have a corresponding rewrite in step 3.

```bash
# Direct table-name references in queries
grep -RIn 'db\.query("groups")\|db\.query("distributionPartners")\|db\.query("partnerLeaders")\|db\.query("sites")' convex/ src/

# Type-level references
grep -RIn 'v\.id("groups")\|v\.id("distributionPartners")\|v\.id("partnerLeaders")\|v\.id("sites")' convex/

# Foreign-key field names on other tables
grep -RIn 'groupId\b\|distributionPartnerId\b\|partnerLeaderId\b\|siteId\b' convex/ src/

# Variable / display names that should also flip (not all of these
# require a code change — many are just user-facing strings)
grep -RIn '\bGroup\b\|\bgroup\b' convex/ src/ --include='*.ts' --include='*.tsx'
```

## When you're ready to run

Tell the agent: **"Execute Phase-3 rename migration"**. The agent should:

1. Re-run the audit greps and confirm row counts.
2. Add the new tables to `convex/schema.ts` (parallel definitions).
3. Generate the backfill `internalMutation`s in `convex/admin/devTools.ts`.
4. Wait for explicit "backfill complete, proceed to cutover" before
   touching any reference rewrites.

Estimated rewrite surface area (code only, not data):

- ~40 `convex/admin/*.ts` files
- ~30 `src/app/admin/**/*.tsx` files
- 8+ test files
- `convex/schema.ts` (additive then subtractive)
- Auto-regenerated `convex/_generated/*` (machine output)
