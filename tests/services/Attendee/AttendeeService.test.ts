jest.mock("../../../src/services/Event/EventService", () => ({
  getEvent: jest.fn(),
}));

import { Tables, TablesInsert } from "../../../src/schema/v2/database.types";
import {
  createAttendee,
  addAttendee,
  getAttendee,
} from "../../../src/services/Attendee/AttendeeService";
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
        event_id: 'event-456',
        name: 'Product Conference',
        date: '2025-01-01',
        blurb: 'sdsd',
        description: 'sdsd',
        registration_opens: '2025-07-20T21:30:00+00:00',
        registration_closes: '2025-07-22T22:30:00+00:00',
        start_time: '2025-07-24T21:30:00+00:00',
        end_time: '2025-07-24T22:30:00+00:00',
        location: 'UBC Sauder Building',
        thumbnail:
            'https://dthvbanipvldaiabgvuc.supabase.co/storage/v1/object/public/event-media/events/75f6ef8e-12d7-48f3-a0a8-96443ae5d1f7/media/umm-nocturnaltrashposts-and-then-uhh.jpeg',
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
        external_page: 'https://google.com',
        waitlist_form: 'https://waitlist.form',
        mailing_list: ""
  }

  describe("addAttendee", () => {
    it("should create attendee with full data", async () => {
      const registrationData: AttendeeInsert = {
        user_id: "user-123",
        event_id: "event-456",
        payment_id: "payment-789",
        event_form_answers: { shirtSize: "M", meal: "vegetarian" },
      };

      const mockAttendee: AttendeeRow = {
        attendee_id: "attendee-123",
        user_id: "user-123",
        event_id: "event-456",
        payment_id: "payment-789",
        event_form_answers: { shirtSize: "M", meal: "vegetarian" },
        created_at: "2025-01-15T10:00:00.000Z",
        last_updated: "2025-01-15T10:00:00.000Z",
        status: "REGISTERED",
        is_payment_verified: true,
      };
      (AttendeeRepository.addAttendee as jest.Mock).mockResolvedValueOnce({
        data: mockAttendee,
      });
      (
        AttendeeRepository.getRegisteredAttendee as jest.Mock
      ).mockResolvedValueOnce({ data: null });
      const result = await addAttendee(mockEvent, registrationData);

      expect(result).toEqual(mockAttendee);
    });

    it("should handle free events and minimal data", async () => {
      const registrationData: AttendeeInsert = {
        user_id: "user-123",
        event_id: "event-456",
      };

      const mockAttendee: AttendeeRow = {
        attendee_id: "attendee-123",
        user_id: "user-123",
        event_id: "event-456",
        payment_id: null,
        event_form_answers: null,
        created_at: "2025-01-15T10:00:00.000Z",
        last_updated: "2025-01-15T10:00:00.000Z",
        status: "REGISTERED",
        is_payment_verified: true,
      };
      (AttendeeRepository.addAttendee as jest.Mock).mockResolvedValueOnce({
        data: mockAttendee,
      });
      (
        AttendeeRepository.getRegisteredAttendee as jest.Mock
      ).mockResolvedValueOnce({ data: null });
      const result = await addAttendee(mockEvent, registrationData);

      expect(result.payment_id).toBeNull();
      expect(result.event_form_answers).toBeNull();
      expect(result.status).toBe("REGISTERED");
    });

    it("throws on insert error", async () => {
      const registrationData: AttendeeInsert = {
        user_id: "user-123",
        event_id: "event-456",
        payment_id: "payment-789",
        event_form_answers: { shirtSize: "M", meal: "vegetarian" },
      };

      (
        AttendeeRepository.getRegisteredAttendee as jest.Mock
      ).mockResolvedValueOnce({ data: null });
      (AttendeeRepository.addAttendee as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: "DB fail" },
      });

      await expect(addAttendee(mockEvent, registrationData)).rejects.toThrow(
        "Failed to create attendee: DB fail"
      );
    });
  });

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

  describe("createAttendee", () => {
    it("should throw error for missing required fields", async () => {
      const testCases = [
        { user_id: "", event_id: "event-456" },
        { user_id: "user-123", event_id: "" },
      ];

      for (const registrationData of testCases) {
        await expect(createAttendee(mockEvent, registrationData)).rejects.toThrow(
          "Missing required fields"
        );
      }
    });

    it("should throw error when event is full", async () => {
      const registrationData = {
        user_id: "user-123",
        event_id: "event-456",
      };

      await expect(createAttendee({...mockEvent, max_attendees: 1, registered: 1 }, registrationData)).rejects.toThrow(
        "Event event-456 is full"
      );
    });

    it("should throw if already registered", async() => {
      const registrationData = {
        user_id: "user-123",
        event_id: "event-456",
      };

      (AttendeeRepository.getRegisteredAttendee as jest.Mock).mockResolvedValueOnce({ data: registrationData });

      await expect(createAttendee(mockEvent, registrationData)).rejects.toThrow("User already registered for event");
    });


    it("should not throw when all validations pass", async () => {
      const registrationData = {
        user_id: "user-123",
        event_id: "event-456",
      };

      (AttendeeRepository.getRegisteredAttendee as jest.Mock).mockResolvedValueOnce({ data: null });

      expect(await createAttendee(mockEvent, registrationData)).toEqual({
        ...registrationData,
        status: "PROCESSING",
      });
    });

  });


});
