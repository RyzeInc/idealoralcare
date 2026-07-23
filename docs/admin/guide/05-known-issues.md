# Known Issues — Admin Suite

This is a consolidated, severity-tagged list of every bug, non-functional UI element, stub, and dead-code path found while researching the [Admin Suite Guide](00-overview.md) (repo state as of 2026-07). It exists so the guide and [SOP library](../sops/README.md) can tell admins what to actually rely on, and so engineering has a single punch list instead of these findings being scattered across five research passes.

Nothing below was fixed as part of writing this documentation — it's a snapshot of what the code does today.

---

## 🔴 Security / access-control

| # | Issue | Where | Detail |
|---|---|---|---|
| S1 | **`/bootstrap` lets any signed-in user self-promote to Owner**, even when owners already exist | `src/app/bootstrap/page.tsx` → `grantFreeAccess.bootstrapFirstAdmin` | Unlike `/admin/users`'s "Initialize First Admin" (correctly gated to zero-admin state), this path only checks whether *the calling user* is already an admin — not whether the platform already has owners. It also grants a free 365-day subscription as a side effect. Any authenticated Clerk user who finds this URL can make themselves an owner at any time. |
| S2 | **Owner vs. Editor is not enforced anywhere in the backend** except one client-side check | `convex/lib/authGuards.ts` (`requireAdmin`) | There is no `requireOwner` helper in the codebase. Every "owner-only" claim in UI copy (Admin Users' Role Guide, billing/settings restrictions) is aspirational. The only real enforcement is the Dev Tools page's client-side `role === 'owner'` check. |
| S3 | **No "keep at least one owner/admin" safeguard** | `convex/admin/adminUsers.ts` (`updateRole`, `remove`) | Any admin can demote the last owner, or delete every admin row, potentially re-exposing the "Initialize First Admin" flow to the next visitor. |
| S4 | **Active Distribution Partners satisfy `requireAdmin` too** | `convex/lib/authGuards.ts` | Any broker/agency with an active portal login can call internal-admin mutations, not just internal staff. Restriction to "these pages are for internal staff" is a UI/navigation convention only, not a code-level wall. |
| S5 | Several read queries have **no server-side auth check at all**, relying entirely on the `/admin` layout gate | `members.getMemberDetail`; all of `distributionPartners.ts`'s queries; all of `repCodes.ts`'s queries; `repOnboarding.listForAdmin`/`getById`; `userAudit.getUserStatuses`/`getUserDetail`; `siteSettings.get`; `billing.getGroupMembersWithBillingStatus`/`getAccountBillingSummary`/`getSiteBillingSummary`/`getUpcomingBillingDates`; `commissions.getBrokerCommissions`; `devTools.seedCatalog`/`linkAdminAsMember` | Anyone who can reach the Convex deployment directly (not just through the Next.js UI) could call these without being an admin. Low risk in normal usage, but inconsistent with the rest of the codebase's own stated convention of gating at the function level. |
| S6 | `GET /api/clerk/users` only checks "is this person signed in," not "is this person an admin" | `src/app/api/clerk/users/route.ts` | Used by Admin Users' "Add Existing User" search and by User Audit. Any signed-in Clerk user could call it directly and enumerate the Clerk user directory (names/emails/IDs). |

## 🟠 Functionally broken (UI exists, doesn't do what it implies)

| # | Issue | Where | Detail |
|---|---|---|---|
| B1 | **Audit Log page renders blank for every real entry** | `src/app/admin/audit-log/page.tsx` + `convex/admin/unifiedData.ts:getRecentAuditTrail` | The read query maps `adminAuditLog` rows to field names (`adminId`, `resourceType`, `changes`, `reason`) that don't exist on the real schema (`actorClerkUserId`, `targetType`, `summary`, `metadata`). Writes are correct; this read path isn't. Every row shows blank "When/Actor/Target/Summary." The Action and Actor filter controls also don't do anything (only Limit re-queries). A correctly-shaped query, `adminAudit.listRecent`, already exists and isn't being used here. |
| B2 | **Members page "Download ID Card" is broken** | `src/app/admin/members/page.tsx` | Calls a function name (`admin/memberCards:generateMemberIdCardPdf`) that doesn't exist anywhere in `convex/admin/memberCards.ts`. Will error on click. |
| B3 | **Commissions page math is unreliable** | `convex/admin/commissions.ts:getBrokerCommissions` | Reads a field (`amountCents`) that doesn't exist on `commissionPayables` (real field: `amount`) — payout figures don't reflect real payable amounts. The rate/payout formula also mixes percentage-as-decimal vs. percentage-as-whole-number conventions inconsistently with the schema's own documentation, and the frontend displays a percentage rate formatted as a dollar amount. The page itself carries a permanent "Coming Soon" banner — treat all numbers on it as placeholder. |
| B4 | **Commissions page's month picker and Export CSV button do nothing** | `src/app/admin/commissions/page.tsx` | Neither has a working handler. |
| B5 | **Eligibility Files' "File Action" selector (Full Replace/Additions Only/Terminations/Delta) is cosmetic** | `convex/admin/eligibility.ts` | Stored and displayed, but the actual ingestion logic (`internalBatchCreateMembers`) never reads it — behavior is identical regardless of which option is chosen. |
| B6 | **Vendor Files' "Full" vs. "Delta" file type is cosmetic** | `convex/admin/vendorFiles.ts` | Both options query the same active-member set; only the output filename differs. No diff-since-last-export logic exists anywhere. |
| B7 | **Vendor Files' vendor status cards are hardcoded stubs** | `convex/admin/vendorFiles.ts:getVendorConfigurations` | Always returns a fixed "1 day ago / ready," never reflects real generation/delivery history. |
| B8 | **Vendor Files' "View History" toggle is a stub** | `convex/admin/vendorFiles.ts:getVendorFileHistory` | Explicitly commented as a placeholder; always returns an empty history regardless of real deliveries recorded in `vendorDeliveries`. |
| B9 | **Billing page's "Billing Month" picker doesn't filter data** | `convex/admin/billing.ts:getAllGroupBillingSummaries` | No period argument exists on the query — the table always shows live, current-moment counts no matter what month is selected. |
| B10 | **Site Settings' dashboard alert links point to tabs that don't exist** | `src/app/admin/page.tsx` links to `/admin/settings?tab=contacts` / `?tab=inquiries`; `src/app/admin/settings/page.tsx` has no tab handling | Clicking the Dashboard's Unread Contacts / New Inquiries alerts lands on the plain settings form with no contacts/inquiries content visible anywhere. |
| B11 | **List-Bill Invoices: Dispute and Replacement flows have no UI** | `convex/admin/listBillInvoices.ts` (`disputeInvoice`, `resolveDispute`, `generateReplacementInvoice`) | Fully implemented backend, "Disputed" even has a status color in the frontend, but no button anywhere calls any of the three. |
| B12 | **Invoice Calculator's own PDF route folder is empty** | `src/app/api/admin/invoice-calculator/group-pdf/` (no `route.ts` inside) | Dead scaffolding. The "Generate Invoice" wizard's PDF button actually opens the List-Bill Invoices PDF route instead. |

## 🟡 Structural / architectural gaps (working as coded, but incomplete or duplicated)

| # | Issue | Where | Detail |
|---|---|---|---|
| G1 | **Two parallel list-bill billing engines with 3 disagreeing rate sources** | `convex/admin/billing.ts` (legacy, `listBillPayments`, flat $15 default) vs. `convex/admin/listBillInvoices.ts` (current, tiered $14.99/$24.99) | The same group can show a different total on Billing/List-Bill than on List-Bill Invoices for the same period. See `docs/internal/FINANCE_PLATFORM_EVALUATION.md` §3.0 for full detail and recommended sequencing. Treat List-Bill Invoices as the source of truth for "what the employer owes." |
| G2 | **List-Bill page (`/admin/list-bill`) has no sidebar entry** | `src/components/admin/AdminSidebar.tsx` | Only reachable by typing the URL. Easy for a new admin to never discover. |
| G3 | **No audit-log entries for Distribution Partner or Rep Code CRUD** | `convex/admin/distributionPartners.ts`, `convex/admin/repCodes.ts` | Unlike Members/Rep-Onboarding actions, creating/updating/deleting a broker or rep code writes nothing to `adminAuditLog`. |
| G4 | **No employee/employer cost-share model, no per-member payment-remittance reconciliation with reason codes, no location/department invoice subtotals** | List-Bill Invoices | Documented in detail in `docs/internal/FINANCE_PLATFORM_EVALUATION.md` — needed to match some carriers' preferred statement format. Not started. |

## ⚪ Dead / unused code (don't be misled by it while reading the source)

| # | What | Where | Note |
|---|---|---|---|
| D1 | `src/components/admin/BrokersAdmin.tsx` | Unused | The live "Brokers" page (`/admin/brokers`) actually renders `DistributionAdmin.tsx`. This file isn't imported anywhere. |
| D2 | `convex/admin/walletPasses.ts` | Unused | Apple/Google/Samsung wallet-pass generation is fully implemented server-side but not called from any page. |
| D3 | `convex/admin/hardDeleteMember`'s UI reachability | N/A — not a bug, a routing note | `hardDeleteMember` is only reachable from **User Audit**, not from the Members page (which only soft-deletes via `removeMember`). Intentional, but easy to go looking for it in the wrong place. |
| D4 | `convex/admin/eligibility.ts:deleteEligibilityFile` | No UI button | Also has a known-incomplete implementation — never actually deletes the uploaded storage blob (explicit `// TODO` in the code). |
| D5 | `convex/admin/eligibility.ts:createMembersFromEligibilityFile` | Explicitly marked LEGACY | Not used by the current upload UI. |
| D6 | `convex/admin/vendorFiles.ts:generateVendorFile`, `recordVendorFileGeneration` | Not called from the current page | Superseded by vendor-specific generator actions and the `sftpDelivery` orchestrator, respectively. |
| D7 | `convex/admin/seedNewIdeal.ts`, `repAttributionBackfill.ts` | Not wired into any UI | CLI-only (`seedNewIdeal`) or fully orphaned/unreferenced anywhere (`repAttributionBackfill`). |
| D8 | `convex/admin/coreValues.ts`, `convex/admin/ventures.ts` | Not wired into any UI | Full CRUD modules with no admin page or public page using them — likely leftover from a removed or not-yet-built feature. |
| D9 | Most of `convex/admin/grantFreeAccess.ts`'s exports | CLI-only | Aside from `grantMeFullAccess` (Dashboard's "Grant Free Access" button) and `bootstrapFirstAdmin` (the `/bootstrap` path, see S1), the rest (`cliGrantAdmin`, `createFreeBundle`, `grantFreePlanAccess`, `grantFullFreeAccess`, `listFreeBundles`) are CLI/one-time-use only. |
| D10 | `convex/admin/unifiedData.ts` query exports | Partially unused | Only `getRecentAuditTrailQuery` (Audit Log, see B1) is actually called from a page; `getHierarchyQuery`, `getAllMembersEnrichedQuery`, `getBillingDataQuery`, `getDashboardMetricsQuery` exist but the pages that could use them call other, older equivalents directly instead. |

---

## Suggested priority if triaging this list

1. **S1** (`/bootstrap` open self-promotion) — real, currently-exploitable access-control gap.
2. **B1** (Audit Log broken) — undermines the entire compliance/audit story; the fix is a mapper/query swap, not a rebuild.
3. **S2/S3** (owner/editor not enforced, no last-owner safeguard) — decide whether to actually build role enforcement or update the UI copy to stop claiming it exists.
4. **B3/B4** (Commissions math + dead buttons) — either fix or clearly relabel as "not implemented" rather than showing numbers that look real.
5. Everything else is lower urgency — cosmetic-selector gaps (B5/B6/B9), stubs (B7/B8/B12), and structural debt (G1–G4) that's already well-documented in `docs/internal/`.
