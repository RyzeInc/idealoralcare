/**
 * Editing a contact after the fact (the detail page's Edit form). The form
 * sends every field on each save, with "" for anything left blank.
 */

import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const tok = (id: string) => ({ tokenIdentifier: `https://test.clerk.dev|${id}` });

async function setup() {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("adminUsers", {
      clerkUserId: "staff_editor", email: "e@t.dev", name: "Editor", role: "editor", createdAt: Date.now(),
    });
  });
  const staff = t.withIdentity(tok("staff_editor"));
  const contactId = await staff.mutation(api.crm.contacts.createContact, {
    firstName: "Sophia", lastName: "Gutierrez", email: "sgutierrez@example.com",
  });
  return { t, staff, contactId };
}

const blankForm = {
  firstName: "Sophia", lastName: "Gutierrez", jobTitle: "", companyName: "",
  email: "sgutierrez@example.com", secondaryEmail: "", mobilePhone: "", officePhone: "",
  officePhoneExt: "", linkedinUrl: "", city: "", state: "", postalCode: "",
};

describe("updateContact from the edit form", () => {
  test("adds a phone number to an imported contact and indexes it", async () => {
    const { t, staff, contactId } = await setup();
    await staff.mutation(api.crm.contacts.updateContact, {
      contactId,
      fields: { ...blankForm, mobilePhone: " (561) 799-5558 ", city: "Jupiter", state: "FL", postalCode: "33458" },
    });
    const row = await t.run(async (ctx) => ctx.db.get(contactId));
    expect(row?.mobilePhone).toBe("(561) 799-5558");
    expect(row?.mobilePhoneE164).toBe("+15617995558");
    expect(row?.city).toBe("Jupiter");
    expect(row?.postalCode).toBe("33458");
    // Blank inputs never land as empty strings.
    expect(row?.officePhone).toBeUndefined();
    expect(row?.jobTitle).toBeUndefined();
  });

  test("clearing a field removes it", async () => {
    const { t, staff, contactId } = await setup();
    await staff.mutation(api.crm.contacts.updateContact, {
      contactId, fields: { ...blankForm, mobilePhone: "5617995558" },
    });
    await staff.mutation(api.crm.contacts.updateContact, {
      contactId, fields: { ...blankForm, mobilePhone: "" },
    });
    const row = await t.run(async (ctx) => ctx.db.get(contactId));
    expect(row?.mobilePhone).toBeUndefined();
    expect(row?.mobilePhoneE164).toBeUndefined();
  });

  test("rejects a malformed email and a nameless contact", async () => {
    const { staff, contactId } = await setup();
    await expect(
      staff.mutation(api.crm.contacts.updateContact, { contactId, fields: { ...blankForm, email: "not-an-email" } }),
    ).rejects.toThrow(/not a valid email/);
    await expect(
      staff.mutation(api.crm.contacts.updateContact, { contactId, fields: { ...blankForm, firstName: " ", lastName: "" } }),
    ).rejects.toThrow(/first or last name/);
  });
});
