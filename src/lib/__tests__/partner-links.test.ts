import { describe, expect, test } from "vitest";
import { linksCsv, linksText, partnerLink } from "../partner-links";

const row = { name: "Allen Jackson", detail: "Harbor, Inc.", email: "allen@harbor.test", holderType: "broker", code: "100001", ending: "allenjackson01", active: true, signups: 3 };

describe("partner links", () => {
  test("links point at AssureVantage, by slug or by code", () => {
    expect(partnerLink("allenjackson01")).toBe("https://www.assurevantage.com/allenjackson01");
    expect(partnerLink("REP-ABC123")).toBe("https://www.assurevantage.com/REP-ABC123");
    expect(partnerLink("allenjackson01", "essentials")).toBe("https://www.assurevantage.com/allenjackson01?to=essentials");
  });

  test("the spreadsheet quotes commas and defuses formulas", () => {
    const csv = linksCsv([row, { ...row, name: "=HYPERLINK(1)", active: false }]);
    const [header, first, second] = csv.split("\r\n");
    expect(header.split(",")).toHaveLength(10);
    expect(first).toBe('Allen Jackson,"Harbor, Inc.",allen@harbor.test,Broker,Active,100001,https://www.assurevantage.com/allenjackson01,https://www.assurevantage.com/allenjackson01?to=oralcare,https://www.assurevantage.com/allenjackson01?to=essentials,3');
    expect(second.startsWith("'=HYPERLINK(1),")).toBe(true);
    expect(second).toContain(",Off,");
  });

  test("copy-all gives one line per holder", () => {
    expect(linksText([row])).toBe("Allen Jackson: https://www.assurevantage.com/allenjackson01");
  });
});
