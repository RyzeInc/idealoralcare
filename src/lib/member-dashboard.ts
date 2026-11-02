export type MemberDashboardTab = "overview" | "provider-search" | "oral-scan" | "teledentistry";

export function memberDashboardTab(value: string | string[] | undefined): MemberDashboardTab {
  return value === "provider-search" || value === "oral-scan" || value === "teledentistry" ? value : "overview";
}
