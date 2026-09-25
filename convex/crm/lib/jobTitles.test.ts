import { describe, test, expect } from "vitest";
import { classifyJobTitle } from "./jobTitles";

describe("classifyJobTitle", () => {
  test("empty/missing title classifies as undefined, not 'other'/'unknown'", () => {
    expect(classifyJobTitle(undefined)).toEqual({ jobFunction: undefined, seniority: undefined });
    expect(classifyJobTitle("")).toEqual({ jobFunction: undefined, seniority: undefined });
    expect(classifyJobTitle("   ")).toEqual({ jobFunction: undefined, seniority: undefined });
  });

  test("VP People Ops -> hr / vp (Jon's own example of title-wording variance)", () => {
    expect(classifyJobTitle("VP People Ops")).toEqual({ jobFunction: "hr", seniority: "vp" });
  });

  test("Dir., Human Resources -> hr / director (same bucket, different wording)", () => {
    expect(classifyJobTitle("Dir., Human Resources")).toEqual({ jobFunction: "hr", seniority: "director" });
  });

  test("CEO -> executive / c_suite", () => {
    expect(classifyJobTitle("CEO")).toEqual({ jobFunction: "executive", seniority: "c_suite" });
  });

  test("Insurance Broker -> broker_producer / unknown", () => {
    expect(classifyJobTitle("Insurance Broker")).toEqual({ jobFunction: "broker_producer", seniority: "unknown" });
  });

  test("Agency Principal -> broker_principal / c_suite", () => {
    expect(classifyJobTitle("Agency Principal")).toEqual({ jobFunction: "broker_principal", seniority: "c_suite" });
  });

  test("Benefits Coordinator -> benefits / individual_contributor", () => {
    expect(classifyJobTitle("Benefits Coordinator")).toEqual({ jobFunction: "benefits", seniority: "individual_contributor" });
  });

  test("Office Manager -> office_manager / manager", () => {
    expect(classifyJobTitle("Office Manager")).toEqual({ jobFunction: "office_manager", seniority: "manager" });
  });

  test("unrecognized title falls back to other / unknown, never throws", () => {
    expect(classifyJobTitle("Dental Hygienist")).toEqual({ jobFunction: "other", seniority: "unknown" });
  });

  test("Controller -> finance / unknown", () => {
    expect(classifyJobTitle("Controller")).toEqual({ jobFunction: "finance", seniority: "unknown" });
  });

  test("Owner -> owner / unknown", () => {
    expect(classifyJobTitle("Owner")).toEqual({ jobFunction: "owner", seniority: "unknown" });
  });
});
