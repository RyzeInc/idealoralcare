export type VendorFileValidation = {
  code: "VENDOR_FILE_VALIDATION";
  message: string;
  errorCount: number;
  organizations: Array<{
    groupId: string;
    name: string;
    errorCount: number;
    issues: string[];
  }>;
};

/** Convex may serialize application error data when an action calls another action. */
export function readVendorFileValidation(error: unknown): VendorFileValidation | null {
  let data: unknown = (error as { data?: unknown } | null)?.data;
  for (let i = 0; i < 3 && typeof data === "string"; i++) {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const report = data as VendorFileValidation;
  return report.code === "VENDOR_FILE_VALIDATION" &&
    typeof report.message === "string" && typeof report.errorCount === "number" &&
    Array.isArray(report.organizations) && report.organizations.every(org =>
      org && typeof org === "object" && typeof org.groupId === "string" && typeof org.name === "string" &&
      typeof org.errorCount === "number" && Array.isArray(org.issues) &&
      org.issues.every(issue => typeof issue === "string"))
    ? report : null;
}
