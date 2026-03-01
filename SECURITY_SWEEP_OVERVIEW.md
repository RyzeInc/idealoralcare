# Security Sweep — Master Plan

**Date**: February 28, 2026  
**Status**: Ready for Execution  
**Risk Level**: CRITICAL — Multiple zero-auth vulnerabilities in production

---

## Executive Summary

A comprehensive security audit revealed **critical vulnerabilities** across every layer of the Ideal Health Oral Care platform. The most severe: **every Convex backend function is callable without authentication**, the **admin portal is accessible to any logged-in user** (not just admins), and there is **no Next.js middleware** protecting any routes.

This remediation is split into **3 independent agent workstreams** that can execute in parallel with zero file conflicts.

---

## Vulnerability Severity Matrix

| # | Vulnerability | Severity | Impact |
|---|---|---|---|
| 1 | No `middleware.ts` — zero route protection | **CRITICAL** | All routes accessible to everyone |
| 2 | Admin portal checks login only, not admin role | **CRITICAL** | Any member can access admin UI |
| 3 | All Convex functions lack `ctx.auth` checks | **CRITICAL** | Anyone can read/write all data via API |
| 4 | Unscoped queries expose all member PII | **CRITICAL** | Full data breach risk |
| 5 | IDOR in subscription queries (caller supplies `customerId`) | **HIGH** | Cross-user data access |
| 6 | `customer.subscription.deleted` webhook only logs, doesn't cancel | **HIGH** | Cancelled users keep access forever |
| 7 | `convex/auth.ts` is a hardcoded stub (always returns `false`) | **HIGH** | Misleading — appears secured but isn't |
| 8 | Dashboard has no subscription gating | **HIGH** | Unpaid users access member dashboard |
| 9 | No security headers (CSP, HSTS, X-Frame-Options) | **MEDIUM** | XSS / clickjacking risk |
| 10 | HTML injection in email templates | **MEDIUM** | Phishing via injected markup |
| 11 | CSV formula injection in vendor files | **MEDIUM** | Excel macro execution risk |
| 12 | Stripe env vars fallback to empty string instead of failing | **LOW** | Silent misconfiguration |

---

## Agent Architecture

### File Ownership (Zero Overlap)

| Agent | Scope | Files Touched |
|---|---|---|
| **Agent 1** | Next.js Route Protection & Headers | `src/middleware.ts` (new), `src/app/admin/layout.tsx`, `src/app/health/dashboard/layout.tsx`, `next.config.ts` |
| **Agent 2** | Convex Backend Auth & Access Control | `convex/lib/authGuards.ts` (new), `convex/auth.ts`, all 16 files in `convex/admin/*`, `convex/subscriptions/*`, `convex/catalog/mutations.ts`, `convex/enrollment/members.ts`, `convex/contacts.ts`, `convex/inquiries.ts`, `convex/newsletter.ts` |
| **Agent 3** | Stripe Lifecycle, API Hardening & Input Sanitization | `src/app/api/stripe/webhook/route.ts`, `src/app/api/stripe/checkout/route.ts` + creates sanitization utilities in `convex/lib/sanitize.ts` |

> **Important**: Agent 2 owns ALL `convex/admin/*` files for auth guard additions. Agent 3 creates a standalone sanitization utility in `convex/lib/sanitize.ts` that Agent 2's files can import later. No direct file conflicts.

### Dependency Graph

```
Agent 1 (Frontend)  ──┐
                       ├── All independent, run in parallel
Agent 2 (Convex)   ──┤
                       │
Agent 3 (Stripe/API) ─┘

Post-completion integration:
  Agent 2's files import Agent 3's convex/lib/sanitize.ts (optional follow-up)
```

---

## Plan Documents

| Document | Description |
|---|---|
| `SECURITY_AGENT1_PLAN.md` | Next.js middleware, admin role checks, dashboard gating, security headers |
| `SECURITY_AGENT2_PLAN.md` | Convex auth guards, lock down all backend functions, fix IDOR, fix auth.ts |
| `SECURITY_AGENT3_PLAN.md` | Stripe subscription.deleted handler, API hardening, input sanitization utils |

---

## Verification Checklist (Post-Implementation)

### Agent 1 Verification
- [ ] Visit `/admin` while logged out → redirects to Clerk sign-in
- [ ] Visit `/admin` as a regular member → redirects to `/health` (not admin)
- [ ] Visit `/health/dashboard` while logged out → redirects to `/health`
- [ ] Visit `/health/dashboard` without active subscription → redirects to plans page
- [ ] Run `curl -I https://domain.com` → verify CSP, HSTS, X-Frame-Options headers present
- [ ] Verify `*.app.github.dev` removed from `allowedOrigins` in production build

### Agent 2 Verification
- [ ] In Convex dashboard, call `admin.members.getAllMembers` without auth → returns "Unauthorized"
- [ ] Call `admin.adminUsers.add` without auth → returns "Unauthorized"
- [ ] Call `admin.adminUsers.add` as a non-admin user → returns "Unauthorized"
- [ ] Call `subscriptions.queries.getCustomerBundle` → derives `customerId` from auth, not args
- [ ] Call `subscriptions.mutations.activateEntitlement` as regular user → returns "Unauthorized"
- [ ] Call `catalog.mutations.seedInitialData` without admin auth → returns "Unauthorized"
- [ ] Call `contacts.getContactSubmissions` without admin auth → returns "Unauthorized"
- [ ] Verify `convex/auth.ts` `isUserAdmin` actually queries `adminUsers` table

### Agent 3 Verification
- [ ] Cancel a Stripe subscription → within minutes, Convex bundle status = "cancelled" and entitlements = "revoked"
- [ ] Stripe `customer.subscription.deleted` webhook fires → `cancelBundle` mutation called
- [ ] Start app without `STRIPE_SECRET_KEY` → immediate error, not silent empty string
- [ ] Create a member with `firstName = "<script>alert(1)</script>"` → email HTML has escaped entities
- [ ] Generate vendor CSV with member name `=CMD("calc")` → value prefixed with `'` in output
- [ ] `invoice.payment_failed` webhook → bundle suspended, entitlements suspended

---

## Risk Assessment After Remediation

| Area | Before | After |
|---|---|---|
| Route Protection | None | Clerk middleware + layout guards |
| Admin Authorization | Auth-only (any user) | Admin role verified via `adminUsers` table |
| Convex API Security | Zero auth on all functions | `requireAuth` / `requireAdmin` on every sensitive function |
| Data Scoping | All records exposed | User-scoped queries, admin-only for bulk access |
| Subscription Lifecycle | Cancellation not handled | Full cancel → revoke pipeline |
| Security Headers | None | Full suite (CSP, HSTS, X-Frame, etc.) |
| Input Sanitization | Raw interpolation | HTML entity escaping, CSV formula protection |
