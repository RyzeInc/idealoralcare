# Deployment Setup Guide

## Platform Overview

This is a health plan enrollment and member management platform built with modern cloud technologies:

- **Next.js** — Web application framework (hosted on Vercel or compatible cloud)
- **Convex** — Real-time database and backend functions
- **Clerk** — User authentication and session management
- **Stripe** — Payment processing and subscription management
- **TypeScript** — Type-safe development throughout

## Architecture

The platform is divided into three main areas:

1. **Public Site** (`/health`) — Marketing and plan information
2. **Enrollment Flow** (`/health/enroll`) — Member registration and payment
3. **Member Dashboard** (`/health/dashboard`) — Authenticated member area
4. **Admin Panel** (`/admin`) — Administrative management and reporting

## Required External Accounts

Before deployment, create accounts at these services:

| Service | Purpose | URL |
|---------|---------|-----|
| **Vercel** | Web hosting and deployment | https://vercel.com |
| **Convex** | Backend database and serverless functions | https://convex.dev |
| **Clerk** | User authentication | https://clerk.com |
| **Stripe** | Payment processing | https://stripe.com |

All services offer free trials to get started.

## Step 1: Clone & Environment Setup

### 1.1 Clone the Repository
```bash
git clone <your-repo-url>
cd idealoralcare
npm install
```

### 1.2 Create Environment Configuration
Copy the template and fill in your values:
```bash
cp .env.example .env.local
# Edit .env.local with your actual API keys (see Step 2-5 below)
```

**IMPORTANT:** Never commit `.env.local` to git. The `.gitignore` file already protects it.

## Step 2: Set Up Convex Backend

Convex is the backend database and serverless platform.

### 2.1 Create Convex Project
```bash
npm install -g convex  # If not already installed
npx convex deploy
```

This will:
- Prompt you to log in with GitHub (first time only)
- Create a new Convex project
- Deploy the database schema to Convex

**Save the deployment URL printed at the end.**

### 2.2 Get Convex Secrets

1. Visit https://dashboard.convex.dev
2. Select your project
3. Go to **Settings** → **Deployment**
4. Copy the **Deployment Name** (format: `prod:xxxxx`)
5. Copy the **URL** (format: `https://xxxxx.convex.cloud`)

### 2.3 Add to .env.local
```env
CONVEX_DEPLOYMENT=prod:xxxxx  # From step 2.2
NEXT_PUBLIC_CONVEX_URL=https://xxxxx.convex.cloud  # From step 2.2
```

## Step 3: Set Up Clerk Authentication

Clerk provides user sign-in, sign-up, and session management.

### 3.1 Create Clerk Application
1. Go to https://dashboard.clerk.com
2. Click **Create Application**
3. Name it "Ideal Health" (or similar)
4. Choose **Email** and **Google** as sign-in methods
5. Click **Create**

### 3.2 Get Clerk Keys
1. Go to **API Keys** in the left sidebar
2. Under **Quick Copy**, copy:
   - **Publishable Key** (starts with `pk_live_`)
   - **Secret Key** (starts with `sk_live_`)

### 3.3 Configure Redirect URIs

For development:
1. Go to **Settings** → **Paths**
2. Add redirect URIs:
   - `http://localhost:3000/*` (for local development)

For production, add after deployment:
- `https://yourdomain.com/*`

### 3.4 Add to .env.local
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx  # From step 3.2
CLERK_SECRET_KEY=sk_live_xxxxx  # From step 3.2
```

## Step 4: Set Up Stripe Payments

Stripe handles all payment processing and subscriptions.

### 4.1 Create Stripe Account
1. Go to https://stripe.com
2. Click **Start Now**
3. Complete account setup

### 4.2 Enable Live Mode & Get Keys

1. In Stripe Dashboard, toggle to **Live** mode (top-left corner)
2. Go to **Developers** → **API keys**
3. Copy:
   - **Secret key** (starts with `sk_live_`)
   - **Publishable key** (starts with `pk_live_`)

### 4.3 Create Webhook Endpoint

This tells Stripe to send payment events to your app:

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter endpoint URL: `https://yourdomain.com/api/stripe/webhook`
   - For local testing: Use `ngrok` or similar tunnel service
4. Select events to listen for:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.canceled`
5. Click **Create endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)

### 4.4 Add to .env.local
```env
STRIPE_SECRET_KEY=sk_live_xxxxx  # From step 4.2
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx  # From step 4.2
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # From step 4.3
```

## Step 5: Application Configuration

### 5.1 Set Application Domain & URLs
```env
NEXT_PUBLIC_APP_DOMAIN=getidealoh.com  # Your domain
NEXT_PUBLIC_APP_URL=https://getidealoh.com  # Full URL
NEXT_PUBLIC_APP_ENV=production  # or 'development'
```

### 5.2 Complete .env.local Example
Once complete, your `.env.local` should look like:
```env
# ─── Convex Backend ────────────────────────────────────────
CONVEX_DEPLOYMENT=prod:xxxxx
NEXT_PUBLIC_CONVEX_URL=https://xxxxx.convex.cloud

# ─── Clerk Authentication ──────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
CLERK_SECRET_KEY=sk_live_xxxxx

# ─── Stripe Payments ──────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx

# ─── Application ──────────────────────────────────────────
NEXT_PUBLIC_APP_DOMAIN=getidealoh.com
NEXT_PUBLIC_APP_URL=https://getidealoh.com
NEXT_PUBLIC_APP_ENV=production
```

## Step 6: Test Locally

Before deploying, verify everything works:

```bash
npm run build    # Build the app
npm run dev      # Start development server
```

Then visit:
- http://localhost:3000/health — Landing page
- http://localhost:3000/health/plans — Plan selection
- http://localhost:3000/health/enroll — Enrollment flow

**Test interaction:**
1. Go through enrollment flow
2. Complete a test payment with Stripe test card `4242 4242 4242 4242`
3. Verify member appears in `/admin/members`
4. Check that email was sent (if configured)

## Step 7: Deploy to Vercel

Vercel is the recommended hosting platform (made by the creators of Next.js).

### 7.1 Push Code to GitHub
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 7.2 Connect to Vercel
1. Go to https://vercel.com
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Choose your project settings (defaults are fine)
5. Click **Deploy**

### 7.3 Add Environment Variables in Vercel
1. In Vercel project dashboard, go to **Settings** → **Environment Variables**
2. Add all variables from your `.env.local`:
   - `CONVEX_DEPLOYMENT`
   - `NEXT_PUBLIC_CONVEX_URL`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_APP_DOMAIN`
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_APP_ENV=production`

3. Re-deploy for changes to take effect (Vercel will prompt you)

### 7.4 Configure Custom Domain
1. In Vercel, go to **Settings** → **Domains**
2. Add your domain (e.g., `getidealoh.com`)
3. Follow DNS setup instructions

## Step 8: Post-Deployment Checklist

After successful deployment:

- [ ] **Landing Page** — Visit `https://yourdomain.com/health` and verify page loads
- [ ] **Enrollment Flow** — Complete a test enrollment:
  - Sign up with email
  - Select a plan
  - Complete mock payment
- [ ] **Member Dashboard** — Sign in and verify member dashboard works
- [ ] **Admin Access** — Set up first admin:
  - Go to `/admin/users`
  - Get your Clerk User ID from Clerk dashboard
  - Create yourself as super-admin
  - Verify admin panel works
- [ ] **Stripe Webhook** — Verify webhook endpoint:
  - In Stripe dashboard, manually trigger a test event
  - Check that it reaches your app
- [ ] **Clerk Configuration** — Update Clerk redirect URIs:
  - Add `https://yourdomain.com/*` to allowed redirect URIs
- [ ] **Error Pages** — Test error handling:
  - Try accessing `/health/invalid-page` (should show 404)
  - Try accessing `/admin` without auth (should redirect to sign-in)

## Architecture: What's Included

### Public Features (Live)
- ✅ Landing page with plan information
- ✅ Plan comparison and selection
- ✅ Member enrollment flow
- ✅ Payment processing (Stripe)
- ✅ Member dashboard with plan details
- ✅ Provider search
- ✅ Admin panel for site management
- ✅ Member and account management
- ✅ Billing reports

### Coming Soon (Hidden from Users)
- 🚀 AI Oral Scanning (Toothlens integration)
- 🚀 Commission tracking and payroll exports
- 🚀 Automated vendor file delivery (SFTP)
- 🚀 Bulk member upload (CSV eligibility files)
- 🚀 Automated email notifications
- 🚀 Member ID card printing

## Troubleshooting

### "Cannot find module 'convex'"
**Solution:** Run `npm install` after cloning the repo.

### "CLERK_SECRET_KEY not found"
**Solution:** Make sure `.env.local` is in the root directory and all keys are filled in (not blank).

### "Payment always fails"
**Solution:** In development, use Stripe test cards. In production, verify webhook secret is correct.

### "Build fails with TypeScript errors"
**Solution:** Run `npm run build` locally to see full errors. Most are missing environment variables.

### "Admin panel shows 404"
**Solution:** You must set yourself as admin first via `/admin/users` page.

## Support & Contact

- **Email:** support@getidealoh.com
- **Documentation:** See `ADMIN_QUICK_START.md` for admin guide
- **GitHub Issues:** Report technical issues in repository

## Security Reminders

1. **Never commit `.env.local`** — Use `.gitignore` (already configured)
2. **Use HTTPS only** — All production traffic must be encrypted
3. **Rotate secrets periodically** — Best practice is quarterly rotation
4. **Monitor webhook deliveries** — Check Stripe dashboard for failed events
5. **Verify Clerk sessions** — Monitor for unusual sign-in patterns

## Next Steps

1. Complete environment setup (Steps 1-5)
2. Test locally (Step 6)
3. Deploy to Vercel (Step 7)
4. Run post-deployment checklist (Step 8)
5. See `ADMIN_QUICK_START.md` for configuring the admin panel
