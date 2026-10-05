import { v } from "convex/values";

export const roleTypeValidator = v.union(
  v.literal("staff"),
  v.literal("program_manager"),
  v.literal("fmo"),
  v.literal("agency"),
  v.literal("broker"),
  v.literal("rep"),
  v.literal("carrier"),
  v.literal("organization"),
);
