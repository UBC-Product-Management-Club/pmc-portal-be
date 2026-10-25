import { pacific, spreadsheetSafe } from "../../src/ops/cells";
import { parseArgs } from "../../src/ops/cli";
import { columnLetter } from "../../src/ops/sheet";

describe("spreadsheetSafe", () => {
  it.each(["=SUM(A1)", "+1", "-1", "@me", "\tx", "\rx"])("keeps %p as text with a leading apostrophe", (value) => {
    expect(spreadsheetSafe(value)).toBe(`'${value}`);
  });

  it("leaves everything else alone", () => {
    expect(spreadsheetSafe("I like products")).toBe("I like products");
    expect(spreadsheetSafe(null)).toBe("");
    expect(spreadsheetSafe(3)).toBe("3");
  });
});

describe("pacific", () => {
  it("shows times in Pacific, across daylight saving", () => {
    expect(pacific("2026-11-04T20:00:00Z")).toBe("2026-11-04 12:00 PT");
    expect(pacific("2026-10-25T20:00:00Z")).toBe("2026-10-25 13:00 PT");
    expect(pacific(null)).toBe("");
  });
});

describe("columnLetter", () => {
  it("counts like a spreadsheet", () => {
    expect([0, 25, 26, 27, 51, 52].map(columnLetter)).toEqual(["A", "Z", "AA", "AB", "AZ", "BA"]);
  });
});

describe("parseArgs", () => {
  it("reads the command, values and switches", () => {
    expect(parseArgs(["decide", "--event", "e-1", "--by", "Simoon", "--apply"])).toEqual({
      command: "decide",
      flags: { event: "e-1", by: "Simoon", apply: true },
    });
  });

  it("refuses a stray argument", () => {
    expect(() => parseArgs(["sync", "e-1"])).toThrow("Unexpected argument e-1");
  });
});
