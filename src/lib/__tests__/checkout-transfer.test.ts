// @vitest-environment node
import { expect, test } from "vitest";
import { readCheckoutTransfer, transferProducts } from "../checkout-transfer";
import type { CartState, CatalogProduct } from "../health-plans/types";
const product = (id: string, slug = id, category = "dental") =>
  ({
    _id: id,
    slug,
    category,
    isVisible: true,
    pricing: {
      monthlyCardCents: 1499,
      monthlyACHCents: 1399,
      annualCardCents: 16499,
      annualACHCents: 15499,
    },
  }) as CatalogProduct;
const oral = product("oral_id", "oral-individual");
const cart: CartState = {
  items: [{ productId: oral._id, product: oral, addedAt: 0 }],
  cadence: "annual",
  paymentMethod: "ach",
  compareItems: [],
  referralCode: "100001",
  referralCodeSource: "url",
};
// The `cart` parameter previously issued links carried to the getidealoh.com checkout.
const cartParam = (c: CartState) =>
  JSON.stringify({
    ids: c.items.map((i) => i.productId),
    cadence: c.cadence,
    paymentMethod: c.paymentMethod,
    referralCode: c.referralCode || "",
    referralSource: c.referralCodeSource === "url" ? "url" : "manual",
  });
test("previously issued checkout links restore only shopping preferences", () => {
  const transfer = readCheckoutTransfer(cartParam(cart));
  expect(transfer).toEqual({
    ids: ["oral_id"],
    cadence: "annual",
    paymentMethod: "ach",
    referralCode: "100001",
    referralSource: "url",
  });
});
test("selection is rebuilt from the current catalog, never from supplied prices", () => {
  const transfer = readCheckoutTransfer(
    JSON.stringify({
      ...JSON.parse(cartParam(cart)),
      pricing: { monthlyCardCents: 1 },
    }),
  )!;
  expect(transferProducts(transfer, [oral])?.products[0]).toBe(oral);
});
test.each([
  null,
  "{}",
  "bad",
  JSON.stringify({
    ids: ["same", "same"],
    cadence: "monthly",
    paymentMethod: "card",
    referralCode: "",
  }),
])("rejects malformed input %s", (raw) =>
  expect(readCheckoutTransfer(raw)).toBeNull(),
);
test("unavailable and site-excluded products cannot be restored", () => {
  const transfer = readCheckoutTransfer(cartParam(cart))!;
  expect(transferProducts(transfer, [])).toBeNull();
  expect(
    transferProducts(transfer, [{ ...oral, isVisible: false }]),
  ).toBeNull();
  expect(transferProducts(transfer, [oral], ["other_id"])).toBeNull();
});
test("membership orders force monthly billing and reject Essentials plus standalone BFL", () => {
  const ess = product("ess_id", "essentials-employee", "telehealth"),
    bfl = product("bfl_id", "bfl-individual", "wellness");
  const transfer = {
    ids: ["ess_id", "oral_id"],
    cadence: "annual" as const,
    paymentMethod: "card" as const,
    referralCode: "",
    referralSource: "manual" as const,
  };
  expect(transferProducts(transfer, [ess, oral])?.cadence).toBe("monthly");
  expect(
    transferProducts({ ...transfer, ids: ["ess_id", "bfl_id"] }, [ess, bfl]),
  ).toBeNull();
});
test("an emptied cart restores as empty", () => {
  const empty = { ...cart, items: [] };
  const transfer = readCheckoutTransfer(cartParam(empty))!;
  expect(transferProducts(transfer, [oral])?.products).toEqual([]);
});

test("AssureVantage checkout and receipts never stay on getidealoh.com", async () => {
  const { marketingRedirectOrigin } = await import("../site-domains");
  for (const path of [
    "/assurevantage/program-checkout",
    "/assurevantage/program-success",
  ])
    expect(marketingRedirectOrigin("www.getidealoh.com", path)).toBe(
      "https://www.assurevantage.com",
    );
  expect(
    marketingRedirectOrigin("www.getidealoh.com", "/assurevantage/essentials"),
  ).toBe("https://www.assurevantage.com");
  expect(
    marketingRedirectOrigin("www.getidealoh.com", "/health/checkout"),
  ).toBeNull();
});
