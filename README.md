# Ideal Health Oral Care Platform

Health plan enrollment, member management, and administration platform.

## Quick Start

1. Copy `.env.example` to `.env.local` and fill in your API keys
2. `npm install`
3. `npx convex deploy`
4. `npm run dev`

See [DEPLOYMENT_SETUP.md](DEPLOYMENT_SETUP.md) for full setup guide.
See [ADMIN_QUICK_START.md](ADMIN_QUICK_START.md) for admin configuration.

## Employer eligibility intake

Browser uploads, automated HTTPS uploads, and email attachments feed a staff review queue at `/admin/eligibility/intake`. See [setup and operations](docs/eligibility-intake.md) for employer access, API usage, the Gmail email intake, and launch checks.

For training and organization onboarding, use the [illustrated companion guides](docs/eligibility-companion/README.md): separate Program Manager and organization PDFs, offline HTML versions, a fillable onboarding card, and the blank roster template.
