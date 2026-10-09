import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const getMemberCardDataPublic = internalQuery({
  args: { customerId: v.string() },
  handler: async (_ctx, _args) => {
    return null as null | {
      memberName: string;
    };
  },
});

export const getCustomerBundlePublic = internalQuery({
  args: { customerId: v.string() },
  handler: async (_ctx, _args) => {
    return null;
  },
});
