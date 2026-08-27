import { QuestionSchema } from "../../src/schema/v2/Application";

describe("QuestionSchema", () => {
  const question = {
    key: "why_pm",
    label: "Why PM?",
    type: "LONG_TEXT",
    required: true,
    max_words: 150,
    display_order: 1,
  };

  it("accepts a well-formed question", () => {
    expect(QuestionSchema.safeParse(question).success).toBe(true);
  });

  it("requires a non-empty key, since answers are keyed by it", () => {
    expect(QuestionSchema.safeParse({ ...question, key: "" }).success).toBe(false);
  });

  it("rejects an unknown question type", () => {
    expect(QuestionSchema.safeParse({ ...question, type: "ESSAY" }).success).toBe(
      false
    );
  });

  it("requires options on SELECT and MULTI_SELECT", () => {
    expect(
      QuestionSchema.safeParse({ ...question, type: "SELECT" }).success
    ).toBe(false);
    expect(
      QuestionSchema.safeParse({ ...question, type: "SELECT", options: [] }).success
    ).toBe(false);
    expect(
      QuestionSchema.safeParse({ ...question, type: "SELECT", options: ["A"] })
        .success
    ).toBe(true);
  });

  it("does not require options on free-text types", () => {
    expect(
      QuestionSchema.safeParse({ ...question, type: "SHORT_TEXT" }).success
    ).toBe(true);
  });
});
