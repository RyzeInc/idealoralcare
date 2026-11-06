// @vitest-environment node
import { expect, test } from "vitest";
import {
  secureCheckoutUrl,
  readCheckoutTransfer,
  transferProducts,
  shoppingUrl,
} from "../checkout-transfer";
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
test("checkout transfer targets the public branded checkout, carrying only shopping preferences", () => {
  const url = new URL(secureCheckoutUrl(cart));
  expect(url.origin).toBe("https://www.getidealoh.com");
  expect(url.pathname).toBe("/assurevantage/program-checkout");
  const raw = url.searchParams.get("cart")!;
  expect(JSON.parse(raw)).toEqual({
    ids: ["oral_id"],
    cadence: "annual",
    paymentMethod: "ach",
    referralCode: "100001",
    referralSource: "url",
  });
  expect(raw).not.toContain("pricing");
  expect(readCheckoutTransfer(raw)?.paymentMethod).toBe("ach");
  expect(new URL(shoppingUrl(cart)).origin).toBe(
    "https://www.assurevantage.com",
  );
});
test("selection is rebuilt from the current catalog, never from supplied prices", () => {
  const transfer = readCheckoutTransfer(
    JSON.stringify({
      ...JSON.parse(new URL(secureCheckoutUrl(cart)).searchParams.get("cart")!),
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
  const transfer = readCheckoutTransfer(
    new URL(secureCheckoutUrl(cart)).searchParams.get("cart"),
  )!;
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
test("returning to shopping can propagate an emptied cart", () => {
  const empty = { ...cart, items: [] };
  const transfer = readCheckoutTransfer(
    new URL(shoppingUrl(empty)).searchParams.get("cart"),
  )!;
  expect(transferProducts(transfer, [oral])?.products).toEqual([]);
});

test("public checkout and receipts stay on the secure account host while marketing stays on AssureVantage", async () => {
  const { marketingRedirectOrigin } = await import("../site-domains");
  for (const path of [
    "/assurevantage/program-checkout",
    "/assurevantage/program-success",
  ])
    expect(marketingRedirectOrigin("www.getidealoh.com", path)).toBeNull();
  expect(
    marketingRedirectOrigin("www.getidealoh.com", "/assurevantage/essentials"),
  ).toBe("https://www.assurevantage.com");
  expect(
    marketingRedirectOrigin("www.getidealoh.com", "/health/checkout"),
  ).toBeNull();
});
