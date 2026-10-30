jest.mock("../../../src/services/Event/EventService", () => ({
  getEvent: jest.fn(),
}));

import { Tables, TablesInsert } from "../../../src/schema/v2/database.types";
import {
  getAttendee,
  registerIfSeatAvailable,
  submitApplication,
} from "../../../src/services/Attendee/AttendeeService";
import { ApiError } from "../../../src/services/ApiError";
import { getEvent } from "../../../src/services/Event/EventService";
import { AttendeeRepository } from "../../../src/storage/AttendeeRepository";

type AttendeeInsert = TablesInsert<"Attendee">;
type AttendeeRow = Tables<"Attendee">;

describe("AttendeeService", () => {
  let mockGetEvent: jest.Mock;
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEvent = getEvent as jest.Mock;
  });

  const mockEvent = {
    event_id: "event-456",
    name: "Product Conference",
    date: "2025-01-01",
    blurb: "sdsd",
    description: "sdsd",
    registration_opens: "2025-07-20T21:30:00+00:00",
    registration_closes: "2025-07-22T22:30:00+00:00",
    start_time: "2025-07-24T21:30:00+00:00",
    end_time: "2025-07-24T22:30:00+00:00",
    location: "UBC Sauder Building",
    member_price: 1,
    non_member_price: 2,
    member_price_id: "",
    non_member_price_id: "",
    max_attendees: 100,
    event_form_questions: {},
    media: [],
    is_disabled: false,
    registered: 1,
    needs_review: false,
    external_page: "https://google.com",
    waitlist_form: "https://waitlist.form",
    mailing_list: "",
  };

  describe("getAttendee", () => {
    it("returns attendee", async () => {
      (AttendeeRepository.getAttendee as jest.Mock).mockResolvedValueOnce({
        data: { a: 1 },
        error: null,
      });

      const result = await getAttendee("e", "u");
      expect(result).toEqual({ a: 1 });
    });

    it("throws on error", async () => {
      (AttendeeRepository.getAttendee as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: "fail" },
      });

      await expect(getAttendee("e", "u")).rejects.toThrow(
        "Failed to check if user u is registered for event e"
      );
    });
  });

  describe("submitApplication", () => {
    const answers = { name: "Simoon Song", email: "simoon@example.com" };

    it("returns the saved attendee", async () => {
      const saved = { attendee_id: "att-1", status: "APPLIED" };
      (AttendeeRepository.submitApplication as jest.Mock).mockResolvedValueOnce({ data: saved, error: null });

      await expect(submitApplication("event-456", "user-123", answers)).resolves.toEqual(saved);
      expect(AttendeeRepository.submitApplication).toHaveBeenCalledWith("event-456", "user-123", answers);
    });

    it.each([
      ["NOT_OPEN", 403],
      ["CLOSED", 403],
      ["ALREADY_APPLIED", 409],
      ["EVENT_FULL", 409],
      ["NOT_FOUND", 404],
    ])("turns the database's %s into an API error", async (code, status) => {
      (AttendeeRepository.submitApplication as jest.Mock).mockResolvedValueOnce({ data: null, error: { message: code } });

      const error = await submitApplication("event-456", "user-123", answers).catch((e) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ code, status });
    });

    it("treats anything else as a server error", async () => {
      (AttendeeRepository.submitApplication as jest.Mock).mockResolvedValueOnce({ data: null, error: { message: "connection reset" } });

      const error = await submitApplication("event-456", "user-123", answers).catch((e) => e);
      expect(error).not.toBeInstanceOf(ApiError);
      expect(error.message).toContain("connection reset");
    });
  });

  describe("registerIfSeatAvailable", () => {
    it("reports whether a seat was free", async () => {
      (AttendeeRepository.registerIfSeatAvailable as jest.Mock)
        .mockResolvedValueOnce({ data: true, error: null })
        .mockResolvedValueOnce({ data: false, error: null });

      await expect(registerIfSeatAvailable("att-1", "pi_1")).resolves.toBe(true);
      await expect(registerIfSeatAvailable("att-2")).resolves.toBe(false);
      expect(AttendeeRepository.registerIfSeatAvailable).toHaveBeenCalledWith("att-1", "pi_1");
    });

    it("throws when the database call fails", async () => {
      (AttendeeRepository.registerIfSeatAvailable as jest.Mock).mockResolvedValueOnce({ data: null, error: { message: "boom" } });

      await expect(registerIfSeatAvailable("att-1")).rejects.toThrow("boom");
    });
  });
});
