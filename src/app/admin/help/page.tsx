'use client';

import { Breadcrumbs } from '@/components/admin/ui';
import {
  BookOpen,
  Users,
  Building2,
  FileUp,
  CreditCard,
  Shield,
  AlertCircle,
  ListChecks,
} from 'lucide-react';

/**
 * ADMIN HELP & GLOSSARY PAGE
 *
 * One-stop reference for admins who didn't build the system.
 * Explains vocabulary, hierarchy, member lifecycle, common workflows,
 * and where to go for what.
 */

export default function AdminHelpPage() {
  return (
    <div className="space-y-8 max-w-5xl">
      <Breadcrumbs items={[{ label: 'Help & Glossary' }]} />

      <header>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen size={28} /> Help &amp; Glossary
        </h1>
        <p className="text-slate-600 mt-1">
          Reference for admin vocabulary, the data model, and common workflows.
        </p>
      </header>

      {/* Hierarchy */}
      <Section icon={<Building2 size={20} />} title="Distribution Hierarchy">
        <p>
          The platform organizes business relationships into a three-level tree.
          You will see these terms throughout the admin UI.
        </p>
        <DefList
          items={[
            {
              term: 'Site (a.k.a. Carrier)',
              def: 'The top-level brand or insurance carrier (e.g., "Ideal Health"). Usually only one. Lives at the top of the hierarchy.',
            },
            {
              term: 'Account (a.k.a. Broker / Distribution Partner)',
              def: 'The producer or broker that manages a book of business under a Site. Used for commission tracking and group ownership.',
            },
            {
              term: 'Group (a.k.a. Organization / Employer)',
              def: 'A specific employer, association, or affinity group whose members enroll. Each Group has a unique Group Code used in eligibility files and enrollment links.',
            },
            {
              term: 'Rep Code',
              def: 'A trackable code attached to a sales rep or marketing source. Used for attribution and commissions independent of the Account hierarchy.',
            },
          ]}
        />
        <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs overflow-x-auto">
{`Site (Carrier)
 └─ Account (Broker)
     └─ Group (Employer)
         └─ Members`}
        </pre>
      </Section>

      {/* Member lifecycle */}
      <Section icon={<Users size={20} />} title="Member Lifecycle">
        <p>
          Every member moves through a status pipeline. The current status drives
          billing, eligibility files, and what self-service the member sees.
        </p>
        <DefList
          items={[
            { term: 'lead', def: 'Captured contact (e.g., from inquiry form). Has not started enrollment.' },
            { term: 'eligible', def: 'Loaded from an eligibility file but has not completed self-enrollment.' },
            { term: 'invited', def: 'Sent a re-enroll / activation link. Awaiting action.' },
            { term: 'enrolling', def: 'Actively in the checkout / signup flow.' },
            { term: 'active', def: 'Paid and currently entitled to benefits. Counts in billing.' },
            { term: 'past_due', def: 'Payment failed. Stripe retrying. Still entitled until grace period ends.' },
            { term: 'inactive', def: 'No active subscription. May be dormant or between plans.' },
            { term: 'terminated', def: 'Removed from the program (voluntary or involuntary). Excluded from billing.' },
            { term: 'declined', def: 'Eligibility was rejected (e.g., duplicate, invalid data, age/area restriction).' },
          ]}
        />
      </Section>

      {/* Roles */}
      <Section icon={<Shield size={20} />} title="Admin Roles & Departments">
        <DefList
          items={[
            { term: 'Owner', def: 'Full access including Dev Tools and admin user management. There must always be at least one owner.' },
            { term: 'Editor', def: 'Day-to-day operator. Can manage members, hierarchy, eligibility, billing — but not other admins or Dev Tools.' },
            { term: 'Department: admin', def: 'Internal Ideal Health staff (default).' },
            { term: 'Department: program_manager', def: 'Program managers running specific carriers / employers.' },
            { term: 'Department: fmo', def: 'Field Marketing Org or wholesale partner.' },
            { term: 'Department: broker', def: 'Broker-side admin user with limited scope.' },
          ]}
        />
      </Section>

      {/* Workflows */}
      <Section icon={<ListChecks size={20} />} title="Common Workflows">
        <Workflow
          title="Onboard a new employer group"
          steps={[
            'Go to Distribution → confirm the Account (broker) exists, or create it.',
            'Go to Brokers & Organizations → create a Group under that Account. Assign a unique Group Code.',
            'Optional: assign a Rep Code for attribution.',
            'Send the group their branded enrollment URL OR upload an eligibility file (next workflow).',
          ]}
        />
        <Workflow
          title="Bulk-enroll members from an eligibility file"
          steps={[
            'Go to Eligibility Files. Download the CSV template.',
            'Fill in required columns: firstName, lastName, email, dateOfBirth, groupCode.',
            'Upload — preview parsed rows. Fix validation errors before committing.',
            'Commit the file. Members are created with status "eligible".',
            'Optional: trigger Provisioning to send invite links so members can complete enrollment.',
          ]}
        />
        <Workflow
          title="Investigate a member issue"
          steps={[
            'Members → search by name, email, or member ID.',
            'Open the member to see status, plan, billing history, and notes.',
            'For login/identity issues, use User Audit to see Clerk + Convex + Toothlens linkage.',
            'For payment issues, use Customer Service to view Stripe billing history and issue refunds/cancellations.',
          ]}
        />
        <Workflow
          title="Generate vendor files for downstream networks"
          steps={[
            'Go to Vendor Files.',
            'Select the vendor (e.g., DialCare, Dental Discount Network).',
            'Generate file → review summary → download.',
            'Mark as delivered after sending to the vendor SFTP / portal.',
          ]}
        />
      </Section>

      {/* Pages map */}
      <Section icon={<FileUp size={20} />} title="What Each Admin Page Does">
        <DefList
          items={[
            { term: 'Dashboard (/admin)', def: 'Real-time KPIs, alerts, and shortcuts to common tasks.' },
            { term: 'Members', def: 'The member roster. Search, edit, terminate, add notes, generate ID cards, send re-enroll links.' },
            { term: 'Brokers & Organizations (Hierarchy)', def: 'Create and edit Sites, Accounts, and Groups.' },
            { term: 'Distribution', def: 'Broker-facing distribution partner management and invites.' },
            { term: 'Rep Codes', def: 'Manage attribution codes for sales reps and marketing sources.' },
            { term: 'Eligibility Files', def: 'Bulk-upload member CSVs. Provisions accounts. Generates downstream vendor files.' },
            { term: 'Billing', def: 'Period-by-period revenue and member counts. Used for E123 imports.' },
            { term: 'List-Bill', def: 'Manage list-billed groups (employer pays one invoice for many members).' },
            { term: 'Commissions', def: 'Broker payout tracking and payroll exports.' },
            { term: 'Customer Service', def: 'Per-member Stripe billing actions (refunds, cancellations).' },
            { term: 'Vendor Files', def: 'Generate downstream eligibility files (DialCare, DDN, etc.).' },
            { term: 'User Audit', def: 'Cross-system user lookup across Clerk, Convex, Toothlens.' },
            { term: 'Admin Users', def: 'Manage who has admin access and at what role.' },
            { term: 'Settings', def: 'Site-level branding and configuration.' },
            { term: 'Dev Tools', def: 'Owner-only utilities for migrations, seeding, diagnostics.' },
          ]}
        />
      </Section>

      {/* Billing concepts */}
      <Section icon={<CreditCard size={20} />} title="Billing Concepts">
        <DefList
          items={[
            { term: 'Self-Pay', def: 'Member pays their own subscription via Stripe. Default for individual signups.' },
            { term: 'List-Bill', def: 'Employer or sponsor pays one consolidated invoice covering many members. No member-side Stripe charges.' },
            { term: 'Bundle', def: 'A subscription wrapping one or more product entitlements (e.g., Dental Discount + Toothlens AI).' },
            { term: 'Past Due', def: 'Stripe payment failed. Stripe retries automatically. Member retains entitlement during the grace window.' },
            { term: 'E123', def: 'External billing import format used by finance.' },
          ]}
        />
      </Section>

      {/* Tips */}
      <Section icon={<AlertCircle size={20} />} title="Tips & Gotchas">
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
          <li>Group Codes must be unique across the entire system, not just within an Account.</li>
          <li>Eligibility uploads are <strong>idempotent by email + date of birth</strong> — re-uploading the same row updates rather than duplicates.</li>
          <li>Terminating a member does not refund Stripe charges — use Customer Service for refunds.</li>
          <li>Dev Tools is owner-only and is hidden from editor-role admins.</li>
          <li>The "Initialize First Admin" button only works if there are zero admins. After that, existing owners must invite new admins.</li>
        </ul>
      </Section>

      <footer className="text-xs text-slate-500 border-t pt-4">
        Need more detail? See <code className="bg-slate-100 px-1 rounded">ADMIN_QUICK_START.md</code> in the repo
        for the full operator runbook.
      </footer>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
      <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
        {icon} {title}
      </h2>
      <div className="text-sm text-slate-700 space-y-3">{children}</div>
    </section>
  );
}

function DefList({ items }: { items: { term: string; def: string }[] }) {
  return (
    <dl className="grid sm:grid-cols-[200px_1fr] gap-x-4 gap-y-2">
      {items.map((it) => (
        <div key={it.term} className="contents">
          <dt className="font-semibold text-slate-900">{it.term}</dt>
          <dd className="text-slate-700">{it.def}</dd>
        </div>
      ))}
    </dl>
  );
}

function Workflow({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="border-l-2 border-blue-200 pl-4 space-y-1">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-700">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}
