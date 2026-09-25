"use client";
import { use } from "react";
import { MemberWorkspace } from "@/components/members/MemberWorkspace";
import type { Id } from "@/convex/_generated/dataModel";

export default function MemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <MemberWorkspace
      key={id}
      memberId={id as Id<"memberProfiles">}
      portal="partner"
    />
  );
}
