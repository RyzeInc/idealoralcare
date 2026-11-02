// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { CartProvider, useCart } from "@/lib/health-plans/cart-context";
import { ReferralCapture } from "./ReferralCapture";

const mocks = vi.hoisted(() => ({ ref: "NEW-BROKER" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams({ ref: mocks.ref }) }));

function CartProbe() {
  const { cart } = useCart();
  return <output>{cart.referralCode}:{cart.referralCodeSource}</output>;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.cookie = "ideal_ref=;path=/;max-age=0";
});

describe("landing referral attribution", () => {
  test("each white-label cart has its own storage without changing Ideal's cart", async () => {
    const stored = (code: string) => JSON.stringify({ items: [], cadence: "monthly", paymentMethod: "card", compareItems: [], referralCode: code, referralCodeSource: "manual" });
    localStorage.setItem("ideal-health-cart", stored("IDEAL"));
    localStorage.setItem("ideal-health-cart:assurevantage", stored("ASSURE"));
    localStorage.setItem("ideal-health-cart:other-brand", stored("OTHER"));
    const view = render(<CartProvider storageNamespace="assurevantage"><CartProbe /></CartProvider>);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("ASSURE:manual"));
    view.unmount();
    render(<CartProvider storageNamespace="other-brand"><CartProbe /></CartProvider>);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("OTHER:manual"));
    expect(JSON.parse(localStorage.getItem("ideal-health-cart")!).referralCode).toBe("IDEAL");
  });
  test("the landing URL wins after an old cart has hydrated", async () => {
    localStorage.setItem("ideal-health-cart", JSON.stringify({ items: [], cadence: "monthly", paymentMethod: "card", compareItems: [], referralCode: "OLD-BROKER", referralCodeSource: "manual" }));
    render(<CartProvider><ReferralCapture /><CartProbe /></CartProvider>);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("NEW-BROKER:url"));
    expect(document.cookie).toContain("ideal_ref=NEW-BROKER");
    expect(JSON.parse(localStorage.getItem("ideal-health-cart")!).referralCode).toBe("NEW-BROKER");
  });

  test("attribution survives moving from a landing page to plans without a ref parameter", async () => {
    const view = render(<CartProvider><ReferralCapture /><CartProbe /></CartProvider>);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("NEW-BROKER:url"));
    view.rerender(<CartProvider><CartProbe /></CartProvider>);
    expect(screen.getByRole("status").textContent).toBe("NEW-BROKER:url");
  });
});
