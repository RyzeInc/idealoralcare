import { emailTemplates } from "@/email-templates/membershipEmails";

// Sample data mirrors the DialCare example — swap in real values when testing
const SAMPLE_DATA = {
  memberName: "Sample Member",
  memberEmail: "sample@example.com",
  memberAddress: "123 Any Street\nCity, State 00000",
  memberId: "IOH-EMP-001",
  groupName: "Ideal Oral Savings Plan",
  groupCode: "IDEALDO",
  term: "ANNUAL",
  effectiveDate: new Date().toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }),
  employerPhone: "(800) 555-1234",
  classification: "Employee",
  modeOfPayment: "Payroll Deduction",
  periodicCharge: "$9.95",
  processingFee: "$0.00",
};

export default function EmployerMembershipAgreementPreviewPage() {
  const template = emailTemplates.employerMembershipAgreement(SAMPLE_DATA);

  return (
    <div>
      {/* Debug toolbar */}
      <div
        style={{
          background: "#1e1e1e",
          color: "#fff",
          padding: "10px 16px",
          fontFamily: "monospace",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <span style={{ fontWeight: "bold", color: "#facc15" }}>
          🔧 DEBUG PREVIEW
        </span>
        <span style={{ color: "#94a3b8" }}>
          Template:{" "}
          <strong style={{ color: "#fff" }}>employer-membership-agreement</strong>
        </span>
        <span style={{ color: "#94a3b8" }}>
          Subject:{" "}
          <strong style={{ color: "#fff" }}>{template.subject}</strong>
        </span>
      </div>

      {/* Email HTML preview */}
      <iframe
        srcDoc={template.html}
        title="Employer Membership Agreement Email Preview"
        style={{
          width: "100%",
          height: "calc(100vh - 44px)",
          border: "none",
          display: "block",
        }}
      />
    </div>
  );
}
