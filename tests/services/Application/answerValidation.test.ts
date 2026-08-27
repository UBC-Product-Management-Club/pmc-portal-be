import {
  FormQuestion,
  validateAnswers,
} from "../../../src/services/Application/answerValidation";

const question = (overrides: Partial<FormQuestion>): FormQuestion => ({
  key: "why_pm",
  label: "Why PM?",
  type: "LONG_TEXT",
  options: null,
  required: true,
  max_words: null,
  ...overrides,
});

describe("validateAnswers", () => {
  it("accepts a valid answer set", () => {
    const questions = [
      question({ key: "first_name", label: "First Name", type: "SHORT_TEXT" }),
      question({
        key: "year",
        label: "Year",
        type: "SELECT",
        options: ["Year 1", "Year 2"],
      }),
      question({
        key: "how_found",
        label: "How did you find us?",
        type: "MULTI_SELECT",
        options: ["Instagram", "Word of Mouth"],
      }),
      question({ key: "resume", label: "Resume", type: "FILE" }),
    ];

    const errors = validateAnswers(questions, {
      first_name: "Ege",
      year: "Year 2",
      how_found: ["Instagram", "Word of Mouth"],
      resume: "recruiting/cycle-1/user-1/resume.pdf",
    });

    expect(errors).toEqual([]);
  });

  describe("required fields", () => {
    it("flags a missing required answer", () => {
      const errors = validateAnswers([question({})], {});
      expect(errors).toEqual([
        { key: "why_pm", message: "Why PM? is required" },
      ]);
    });

    it("treats empty string, whitespace and empty array as missing", () => {
      expect(validateAnswers([question({})], { why_pm: "" })).toHaveLength(1);
      expect(validateAnswers([question({})], { why_pm: "   " })).toHaveLength(1);
      expect(
        validateAnswers(
          [question({ type: "MULTI_SELECT", options: ["a"] })],
          { why_pm: [] }
        )
      ).toHaveLength(1);
    });

    it("allows an optional answer to be omitted or blank", () => {
      const optional = [question({ required: false })];
      expect(validateAnswers(optional, {})).toEqual([]);
      expect(validateAnswers(optional, { why_pm: "" })).toEqual([]);
    });
  });

  describe("SELECT", () => {
    it("rejects a value outside the options", () => {
      const errors = validateAnswers(
        [question({ key: "year", label: "Year", type: "SELECT", options: ["Year 1"] })],
        { year: "Year 9" }
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("must be one of");
    });
  });

  describe("MULTI_SELECT", () => {
    it("rejects a non-array value", () => {
      const errors = validateAnswers(
        [question({ key: "how", label: "How", type: "MULTI_SELECT", options: ["a"] })],
        { how: "a" }
      );
      expect(errors).toEqual([
        { key: "how", message: "How must be a list of selections" },
      ]);
    });

    it("rejects entries outside the options", () => {
      const errors = validateAnswers(
        [question({ key: "how", label: "How", type: "MULTI_SELECT", options: ["a"] })],
        { how: ["a", "b"] }
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("b");
    });
  });

  describe("max_words", () => {
    it("rejects an answer over the limit", () => {
      const errors = validateAnswers([question({ max_words: 3 })], {
        why_pm: "one two three four",
      });
      expect(errors).toEqual([
        { key: "why_pm", message: "Why PM? must be at most 3 words" },
      ]);
    });

    it("accepts an answer at the limit, ignoring extra whitespace", () => {
      const errors = validateAnswers([question({ max_words: 3 })], {
        why_pm: "  one   two \n three  ",
      });
      expect(errors).toEqual([]);
    });
  });

  describe("URL", () => {
    it("rejects a malformed url", () => {
      const errors = validateAnswers(
        [question({ key: "linkedin", label: "LinkedIn", type: "URL" })],
        { linkedin: "not a url" }
      );
      expect(errors).toEqual([
        { key: "linkedin", message: "LinkedIn must be a valid URL" },
      ]);
    });

    it("accepts a well-formed url", () => {
      const errors = validateAnswers(
        [question({ key: "linkedin", label: "LinkedIn", type: "URL" })],
        { linkedin: "https://linkedin.com/in/someone" }
      );
      expect(errors).toEqual([]);
    });
  });

  it("rejects answers to questions that are not on the form", () => {
    const errors = validateAnswers([question({ required: false })], {
      salary_expectation: "a lot",
    });
    expect(errors).toEqual([
      {
        key: "salary_expectation",
        message: "salary_expectation is not a question on this form",
      },
    ]);
  });

  it("reports every problem at once rather than stopping at the first", () => {
    const questions = [
      question({ key: "a", label: "A" }),
      question({ key: "b", label: "B", type: "SELECT", options: ["x"] }),
    ];

    const errors = validateAnswers(questions, { b: "y", c: "stray" });

    expect(errors.map((error) => error.key).sort()).toEqual(["a", "b", "c"]);
  });

  it("rejects a non-string value for a text question", () => {
    const errors = validateAnswers([question({})], { why_pm: 42 });
    expect(errors).toEqual([
      { key: "why_pm", message: "Why PM? must be text" },
    ]);
  });
});
