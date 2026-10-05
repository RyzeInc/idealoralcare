/**
 * Internal permission checks for actions, which cannot read the database
 * directly (see requireAccessAction in convex/lib/authGuards.ts).
 */

import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { resolveAccess } from "../lib/access/resolve";

export const accessById = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const access = await resolveAccess(ctx, args.clerkUserId);
    return { isStaff: access.isStaff, isOwner: access.isOwner, permissions: access.permissions };
  },
});
