import { ESSENTIALS_BFL_MEMBER_CODE } from "./constants";

export function normalizeBflMemberCode(value: string | null | undefined): string | undefined {
  const code = value?.trim();
  if (!code) return undefined;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 _-]{0,31}$/.test(code)) throw new Error("BFL Member Code must be 1–32 letters, numbers, spaces, underscores or hyphens");
  return code;
}

/** Never infer a vendor access code from an employer name or provider group code. */
export function resolveBflMemberCode(group?: { bflMemberCode?: string } | null): string {
  return group?.bflMemberCode?.trim() || ESSENTIALS_BFL_MEMBER_CODE;
}
