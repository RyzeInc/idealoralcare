// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProgramPage, ServicePage, AssureHome } from "./MarketingPages";
import { OfferingSummary } from "./OfferingSummary";
import { AssureFooter } from "./AssureFooter";
const state = vi.hoisted(() => ({ marketing: {} as Record<string, boolean> }));
vi.mock("@/components/providers/SiteThemeProvider", () => ({
  useSiteThemeOptional: () => ({
    site: { marketing: state.marketing },
    isLoading: false,
  }),
}));
vi.mock("./AssureLink", () => ({
  AssureLink: (props: React.ComponentProps<"a">) => <a {...props} />,
}));
vi.mock("next/image", () => ({
  default: ({
    fill,
    priority,
    ...props
  }: React.ComponentProps<"img"> & { fill?: boolean; priority?: boolean }) => {
    void fill;
    void priority;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt || ""} />;
  },
}));
afterEach(() => {
  cleanup();
  state.marketing = {};
});
test("Essentials service promotions can be hidden independently", () => {
  state.marketing = { telehealth: false, labServices: false };
  render(<ProgramPage program="essentials" />);
  expect(
    screen.queryByRole("heading", { name: "Virtual care", exact: true }),
  ).toBeNull();
  expect(
    screen.queryByRole("heading", { name: "Lab services", exact: true }),
  ).toBeNull();
  expect(
    screen.getByRole("heading", { name: "Prescription savings", exact: true }),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", {
      name: "Everyday care, thoughtfully brought together.",
    }),
  ).toBeTruthy();
});
test("Balance for Life inner promotions can be hidden without disabling the offering", () => {
  state.marketing = { bflAiCompanion: false, bflLiveSupport: false };
  render(<ServicePage serviceKey="balance-for-life" />);
  expect(
    screen.queryByText(
      "Zenn, an AI wellness companion within the Balance for Life app",
    ),
  ).toBeNull();
  expect(
    screen.queryByText("Live support by phone, available around the clock"),
  ).toBeNull();
  expect(
    screen.getByText(
      "Wellbeing resources, coaching and referrals under the program’s terms",
    ),
  ).toBeTruthy();
  expect(
    screen.getByText(
      /Zenn is an AI wellness companion, not a licensed therapist/,
    ),
  ).toBeTruthy();
});
test("service switches clean up the footer and preserve membership and legal destinations", () => {
  state.marketing = {
    telehealth: false,
    labServices: false,
    rxSavings: false,
    faq: false,
    blog: false,
  };
  render(<AssureFooter />);
  expect(screen.queryByRole("link", { name: "Lab services" })).toBeNull();
  expect(
    screen.queryByRole("link", { name: "Prescription savings" }),
  ).toBeNull();
  expect(screen.queryByRole("link", { name: "Guides & resources" })).toBeNull();
  expect(
    screen.getByRole("link", { name: "Memberships & pricing" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Terms & disclosures" }),
  ).toBeTruthy();
});
test("hiding service promotions keeps all three membership choices", () => {
  state.marketing = {
    telehealth: false,
    labServices: false,
    rxSavings: false,
    essentialsWellbeing: false,
    oralScan: false,
    teledentistry: false,
    dentalDiscount: false,
  };
  render(<AssureHome />);
  for (const name of ["Essentials", "Balance for Life", "Oral Care"])
    expect(screen.getByRole("heading", { name, exact: true })).toBeTruthy();
});

test("summaries stop advertising disabled inner services while keeping the offering available", () => {
  state.marketing = { telehealth: false, labServices: false, rxSavings: false };
  render(<OfferingSummary program="essentials" />);
  expect(
    screen.getByText("Mental wellbeing support in one membership."),
  ).toBeTruthy();
  expect(screen.queryByText(/virtual medical care/i)).toBeNull();
});
