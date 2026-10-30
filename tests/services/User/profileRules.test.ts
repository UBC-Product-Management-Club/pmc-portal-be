import { checkProfileUpdate } from "../../../src/services/User/profileRules";

const rejects = (body: unknown) => {
  try {
    checkProfileUpdate(body);
  } catch (error: any) {
    expect(error).toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    return error.fields;
  }
  throw new Error("expected a 400");
};

describe("checkProfileUpdate", () => {
  it("accepts every editable field, trimmed", () => {
    expect(
      checkProfileUpdate({
        first_name: " Simoon ",
        last_name: "Song",
        pronouns: "she/her",
        year: "5+",
        faculty: "Science",
        major: "Computer Science",
        why_pm: " Product ",
      })
    ).toEqual({
      first_name: "Simoon",
      last_name: "Song",
      pronouns: "she/her",
      year: "5+",
      faculty: "Science",
      major: "Computer Science",
      why_pm: "Product",
    });
  });

  it("saves a why_pm-only change without checking the other fields", () => {
    expect(checkProfileUpdate({ why_pm: "I like products" })).toEqual({ why_pm: "I like products" });
  });

  it.each([["email"], ["university"], ["is_payment_verified"], ["user_id"]])("refuses %s", (field) => {
    expect(rejects({ [field]: "x" })).toEqual({ [field]: "This can't be changed here." });
  });

  it("rejects a mixed request whole, so nothing is saved", () => {
    expect(rejects({ major: "Computer Science", university: "Simon Fraser University" })).toEqual({
      university: "This can't be changed here.",
    });
  });

  it.each([
    ["a blank first name", { first_name: "   " }],
    ["a year outside 1 to 5+", { year: "6" }],
    ["the number 3 as a year", { year: 3 }],
    ["a null first name", { first_name: null }],
    ["an array why_pm", { why_pm: ["x"] }],
    ["boolean pronouns", { pronouns: true }],
    ["a blank why_pm", { why_pm: " " }],
  ])("rejects %s", (_label, body) => {
    rejects(body);
  });

  it("rejects a 301-character why_pm with the character rule", () => {
    expect(rejects({ why_pm: "x".repeat(301) })).toEqual({ why_pm: "Must be 1–300 characters" });
  });

  it.each([[1], [300]])("accepts a why_pm of %i characters", (length) => {
    expect(checkProfileUpdate({ why_pm: "x".repeat(length) }).why_pm).toHaveLength(length);
  });

  it.each([[{}], [null], [[]], ["text"]])("rejects a body with no editable fields: %p", (body) => {
    rejects(body);
  });
});
