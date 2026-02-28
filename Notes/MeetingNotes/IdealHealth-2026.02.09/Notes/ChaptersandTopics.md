Chapters & Topics:

Attendance and Meeting Purpose
The call began by confirming participants and roles, noting that Dylan leads development and Kyle is Julian's son, and by stating the meeting's purpose: to show what the software must deliver to meet a March 1 effective date.

Scope and Product Expectations
Julian framed the scope as delivering a minimal product focused on core enrollment and member features rather than full agency commission/downline functionality, and asked for confirmation that this approach made sense to the group.
* The meeting goal is to identify a minimal product that supports enrollment, member management, and key functionality for a March 1 effective date.

Landing Page and Product Info Walkthrough
Mike and Andrew demonstrated the consumer landing page, agent-specific URLs for producer tracking, product info tabs with option for PDFs, and discussed whether site content could vary by broker or group.
* The enrollment flow supports both broker-assisted and self-enrollment, with agent-specific landing URLs to track producers.
* Product info pages can include PDFs and brochures but marketing must supply the files for integration.

Enrollment Form Logic and Broker vs Consumer Entry
The team walked through the enrollment buttons, demographic and dependent logic, broker-assisted versus consumer self-entry options, and mechanisms to text or email forms for member signature.
* Enrollment forms include demographic logic for dependents and generate a nine-digit system member ID automatically.
* Payment processing requires credit-card authorization and signature capture; texting a secure link to phones is the fastest e-sign delivery method.
* The platform accepts individual enrollments and CSV eligibility file feeds for group/list-bill uploads.

E-sign Options and Demo of Texting Flow
Dylan requested an e-sign demo; the presenters showed cell-texted secure links (fast, preferred) and discussed email delays and the option for on-screen signing with a USB signature pad in face-to-face cases.

Billing, Vendor Costs, and Commissions Process
The group reviewed how vendor fees (monthly minimums and change fees) are charged, described cheaper list-bill pricing, and outlined how CSV uploads are attached to agent/group codes and how commissions/payables are computed and pulled.

File Feeds, Member ID, and Member Deliverables
The team confirmed CSV (comma-separated) eligibility file format for group uploads, that the system auto-generates nine-digit member IDs, and that member deliverables include emailed ID cards, benefit guides, and a proposed portal for electronic ID cards and benefit details in the Truvo app.
* Commissions can be set per agent/group code and paid via a payable run after enrollment cycles.

Eligibility files and vendor transmissions
The group reviewed the requirement to create and manage eligibility files that vendors (PBMs, ARC, health-share systems) consume, and emphasized monthly transmissions including changes and terminations. They noted the need to align file formats and secure transfer methods to each vendor’s process.
* The team must produce and manage vendor-specific eligibility files and monthly updates for vendors and health-share systems.

Vendor file format details and pitfalls
Technical considerations were discussed, including pulling fields from existing census uploads, CSV formatting expectations, and date formatting differences (e.g., YYYY-MM-DD) that can break imports. The team agreed these are solvable but require care.

Transmission security and coding feasibility
The team confirmed vendors use secure file transfer (S/FTP) with per-vendor credentials and acknowledged that implementation may require expertise beyond the immediate developers. Responsibility to align with vendor processes was emphasized.
* Secure file transmission is done via S/FTP with per-vendor credentials, and the process must align to each vendor’s requirements.
* Vendors primarily accept CSVs but require strict column ordering and date formatting; overseas builds may use YYYY-MM-DD ordering that must be handled.

E123 platform limitations and delivery failures
Participants characterized E123 as outdated and unintuitive, with frequent code pushes that break functionality; the conversation highlighted inconsistent delivery of member cards and email failures requiring manual workarounds.
* E123’s UI and code deployments are brittle, causing inconsistent delivery of member cards and emails and slowing product launches.
* Email templates and HTML delivery need standardization to avoid spam/delivery failures and to provide a resend function.

Commissions and reporting challenges
The team reviewed commission logic: commissions are typically set at onboarding, can be adjusted per sale but rarely are, and the system pays agencies while leaving downline splits to them; extracting payable history for agencies is currently labor-intensive.
* Reporting for payables is currently difficult to extract and requires hours of manual work; improved metrics and easy exports are required.
* Commission rates are set at broker onboarding and rarely change; the platform pays agencies and expects agencies to manage downstream splits.

Product configurability, email templates, and UI demo
Dylan presented a shopping-cart and plan-management prototype concept, stressing editable plans, billing options, user dashboards, and templated HTML email workflows; he recommended dashboard access to view digital cards and a “resend” button to reduce manual follow-up.

Incremental implementation approach
The meeting closed this segment with a suggestion to pursue incremental deliverables and prioritization for the items discussed, indicating the team preferred phased, practical improvements.

Checkout proposal and redirect approach
Julian outlined a targeted approach to solve checkout and payment infrastructure by creating a redirect from the existing site to a new checkout that captures payment, shows plan summaries, and links back to support options for hosts.
* Julian proposed replacing the scheduler redirect with a checkout redirect to handle individual payments and plan summaries.

Data delivery and eligibility handling
The group discussed delivering transaction records as CSV for vendor eligibility, the expectation that most enrollments will be individual signups, and questions about whether group enrollments require credit-card capture.
* Transaction and enrollment data can be delivered back to the client as CSV files for vendor eligibility and reconciliation.

Group billing, invoices, and E123 responsibilities
Participants reviewed that group bundle billing and list-bill invoicing are currently handled by E123, Andrew explained current invoice generation and payment flows, and the team discussed potential redundancy and whether to build a full agency management system later.

Roadmap, short-term workarounds, and next steps
The team agreed to a crawl–walk–run plan prioritizing individual enrollment for a March launch, accepted temporary manual workarounds for vendor files or transfers, and set follow-up meetings for Julian to coordinate with Dylan, Kyle, and Andrew.
* The group billing and invoice generation will remain on E123 for now while individuals are migrated to Julian's platform.
* The team agreed to prioritize individual enrollment first and target a March launch for that capability.
* Short-term manual workarounds and flat/secure file transfers will be used to move off E123 if necessary.