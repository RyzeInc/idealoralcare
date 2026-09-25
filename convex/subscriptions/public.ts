import { query } from "../_generated/server";
import { v } from "convex/values";

export const getMemberCardDataPublic = query({
  args: { customerId: v.string() },
  handler: async (_ctx, _args) => {
    return null as null | {
      memberName: string;
    };
  },
});

export const getCustomerBundlePublic = query({
  args: { customerId: v.string() },
  handler: async (_ctx, _args) => {
    return null;
  },
});
