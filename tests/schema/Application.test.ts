import {
  ApplicationDraftSchema,
  ApplicationSubmitSchema,
  QuestionSchema,
} from "../../src/schema/v2/Application";

const validSubmission = {
  role_id: "role-1",
  choice_rank: "FIRST",
  answers: { why_pm: "Because I like building things.", how_found: ["Instagram"] },
};

describe("ApplicationSubmitSchema", () => {
  it("accepts a well-formed submission", () => {
    expect(ApplicationSubmitSchema.safeParse(validSubmission).success).toBe(true);
  });

  it("accepts the optional resume and referral fields", () => {
    const result = ApplicationSubmitSchema.safeParse({
      ...validSubmission,
      resume_url: "recruiting/cycle-1/user-1/resume.pdf",
      referred_by: "exec@ubcpmc.com",
    });
    expect(result.success).toBe(true);
  });

  it.each(["FIRST", "SECOND", "THIRD_PLUS", "ONLY"])(
    "accepts choice_rank %s",
    (choice_rank) => {
      expect(
        ApplicationSubmitSchema.safeParse({ ...validSubmission, choice_rank }).success
      ).toBe(true);
    }
  );

  it("rejects an unknown choice_rank", () => {
    expect(
      ApplicationSubmitSchema.safeParse({ ...validSubmission, choice_rank: "FOURTH" })
        .success
    ).toBe(false);
  });

  it("requires choice_rank and answers on submit", () => {
    const { choice_rank, ...noRank } = validSubmission;
    expect(ApplicationSubmitSchema.safeParse(noRank).success).toBe(false);

    const { answers, ...noAnswers } = validSubmission;
    expect(ApplicationSubmitSchema.safeParse(noAnswers).success).toBe(false);
  });

  it("rejects a missing or empty role_id", () => {
    expect(
      ApplicationSubmitSchema.safeParse({ ...validSubmission, role_id: "" }).success
    ).toBe(false);
    const { role_id, ...withoutId } = validSubmission;
    expect(ApplicationSubmitSchema.safeParse(withoutId).success).toBe(false);
  });

  it("rejects answers that are not a keyed object", () => {
    for (const answers of [null, ["a"], "a"]) {
      expect(
        ApplicationSubmitSchema.safeParse({ ...validSubmission, answers }).success
      ).toBe(false);
    }
  });

  it("rejects unknown top-level fields", () => {
    expect(
      ApplicationSubmitSchema.safeParse({ ...validSubmission, is_submitted: true })
        .success
    ).toBe(false);
  });
});

describe("ApplicationDraftSchema", () => {
  it("accepts a role_id on its own -- a draft may be empty", () => {
    expect(ApplicationDraftSchema.safeParse({ role_id: "role-1" }).success).toBe(true);
  });

  it("accepts a partially filled draft", () => {
    const result = ApplicationDraftSchema.safeParse({
      role_id: "role-1",
      answers: { why_pm: "half an answer" },
    });
    expect(result.success).toBe(true);
  });

  it("still requires a role_id", () => {
    expect(ApplicationDraftSchema.safeParse({ answers: {} }).success).toBe(false);
  });

  it("rejects a bad choice_rank even in a draft", () => {
    expect(
      ApplicationDraftSchema.safeParse({ role_id: "role-1", choice_rank: "NOPE" })
        .success
    ).toBe(false);
  });
});

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
