// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import RootPage, { generateMetadata } from "@/app/page";
import { programLink } from "../program-brand";
import { NewIdealHeader, NewIdealFooter } from "@/components/newideal/NewIdealChrome";
import { useProgramBrand } from "@/components/newideal/ProgramLink";
import { domainEntryPath } from "../site-domains";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("ref=100401"), usePathname: () => request.pathname }));
vi.mock("next/image", () => ({ default: ({ priority, fill, ...props }: { priority?: boolean; fill?: boolean; src: string; alt: string }) => { void priority; void fill; return <img {...props} />; } }));
const request = vi.hoisted(() => ({ host: "www.assurevantage.com", pathname: "/" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: request.host }) }));
afterEach(cleanup);

test.each(["www.assurevantage.com", "assurevantage.com"])("new-brand chooser stays on %s", async host => {
  request.host = host;
  render(await RootPage());
  expect(screen.getByAltText("AssureVantage")).toBeTruthy();
  expect(screen.getByText("Welcome to AssureVantage")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Oral Savings Plans/ }).getAttribute("href")).toBe("/assurevantage/plans?ref=100401");
  expect(screen.getByRole("link", { name: /^Balance for Life/ }).getAttribute("href")).toBe("/assurevantage/balance-for-life?ref=100401");
  expect(screen.getByRole("link", { name: /Essentials Bundle/ }).getAttribute("href")).toBe("/assurevantage/essentials?ref=100401");
  expect((await generateMetadata()).title).toContain("AssureVantage");
});

test.each(["www.getidealoh.com", "getidealoh.com"])("%s retains the original Ideal identity and enrollment destinations", async host => {
  request.host = host;
  expect(domainEntryPath(host, "/")).toBeNull();
  expect(domainEntryPath(host, "/assurevantage")).toBeNull();
  render(await RootPage());
  expect(screen.getByText("Ideal Health")).toBeTruthy();
  expect(screen.getByText("Welcome to Get Ideal Health")).toBeTruthy();
  expect(screen.queryByAltText("AssureVantage")).toBeNull();
  expect(screen.getByRole("link", { name: /Oral Savings Plans/ }).getAttribute("href")).toBe("/health");
  expect(screen.getByRole("link", { name: /^Balance for Life/ }).getAttribute("href")).toBe("/newideal/balance-for-life");
  expect(screen.getByRole("link", { name: /Essentials Bundle/ }).getAttribute("href")).toBe("/newideal");
  expect((await generateMetadata()).title).toBe("Get Ideal Health — Choose Your Plan");
});

test.each([
  ["/newideal", "/assurevantage"],
  ["/newideal/essentials", "/assurevantage/essentials"],
  ["/newideal/balance-for-life", "/assurevantage/balance-for-life"],
  ["/newideal/plans?ref=100401", "/assurevantage/program-plans?ref=100401"],
  ["/newideal/checkout", "/assurevantage/program-checkout"],
  ["/newideal/success?program=bfl", "/assurevantage/program-success?program=bfl"],
])("primary program navigation maps %s while legacy navigation stays intact", (legacy, primary) => {
  expect(programLink(legacy, true)).toBe(primary);
  expect(programLink(legacy, false)).toBe(legacy);
});


test.each(["/newideal", "/newideal/essentials", "/newideal/balance-for-life"])("legacy program chrome and product names remain original on %s", pathname => {
  request.pathname = pathname;
  function ProductName() {
    return <p>{useProgramBrand().productName("Ideal Health Essentials")}</p>;
  }
  render(<><NewIdealHeader /><NewIdealFooter /><ProductName /></>);
  const logos = screen.getAllByAltText("Ideal Health");
  expect(logos.map(image => [image.getAttribute("width"), image.getAttribute("height")])).toEqual([["168", "168"], ["36", "36"]]);
  expect(screen.getByText("Ideal Health Essentials")).toBeTruthy();
  expect(screen.queryByAltText("AssureVantage")).toBeNull();
  expect(screen.getByRole("link", { name: "Essentials" }).getAttribute("href")).toBe("/newideal/essentials");
});
