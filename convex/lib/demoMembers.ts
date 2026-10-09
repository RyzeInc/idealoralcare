/**
 * DEMO MEMBERS
 *
 * A demo member (memberProfiles.isDemo) is a real login with a working
 * dashboard, for showing the product. It must never reach a vendor roster,
 * an invoice, a vendor statement, a commission, or an insights number — the
 * filters below are applied at each of those entry points rather than once
 * centrally, because each one loads members its own way.
 */
import type { Doc } from "../_generated/dataModel";

export function isDemoMember(member: Pick<Doc<"memberProfiles">, "isDemo"> | null | undefined): boolean {
  return member?.isDemo === true;
}

export function withoutDemoMembers<T extends Pick<Doc<"memberProfiles">, "isDemo">>(members: T[]): T[] {
  return members.filter((m) => !isDemoMember(m));
}
