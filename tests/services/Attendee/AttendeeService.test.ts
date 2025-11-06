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
      (getEvent as jest.Mock).mockResolvedValueOnce({
        event_id: "event-456",
        max_attendees: 100,
        registered: 0,
      });
      (AttendeeRepository.addAttendee as jest.Mock).mockResolvedValueOnce({
        data: mockAttendee,
      });
      (
        AttendeeRepository.getRegisteredAttendee as jest.Mock
      ).mockResolvedValueOnce({ data: null });
      const result = await addAttendee(registrationData);

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
      (getEvent as jest.Mock).mockResolvedValueOnce({
        event_id: "event-456",
        max_attendees: 100,
        registered: 0,
      });
      (AttendeeRepository.addAttendee as jest.Mock).mockResolvedValueOnce({
        data: mockAttendee,
      });
      (
        AttendeeRepository.getRegisteredAttendee as jest.Mock
      ).mockResolvedValueOnce({ data: null });
      const result = await addAttendee(registrationData);

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

      (getEvent as jest.Mock).mockResolvedValueOnce({
        event_id: "event-456",
        max_attendees: 100,
        registered: 0,
      });
      (
        AttendeeRepository.getRegisteredAttendee as jest.Mock
      ).mockResolvedValueOnce({ data: null });
      (AttendeeRepository.addAttendee as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: "DB fail" },
      });

      await expect(addAttendee(registrationData)).rejects.toThrow(
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

  // update attendee

  // delete attendee

  describe("createAttendee", () => {
    it("should throw error for missing required fields", async () => {
      const testCases = [
        { user_id: "", event_id: "event-456" },
        { user_id: "user-123", event_id: "" },
      ];

      for (const registrationData of testCases) {
        await expect(createAttendee(registrationData)).rejects.toThrow(
          "Missing required fields"
        );
      }
    });

    it("should throw error when event not found", async () => {
      const registrationData = {
        user_id: "user-123",
        event_id: "nonexistent-event",
      };

      mockGetEvent.mockResolvedValueOnce(null);

      await expect(createAttendee(registrationData)).rejects.toThrow(
        "Event missing"
      );
      expect(mockGetEvent).toHaveBeenCalledWith(registrationData.event_id);
    });

    it("should throw error when event is full", async () => {
      const registrationData = {
        user_id: "user-123",
        event_id: "event-456",
      };
      const mockEvent = {
        event_id: "event-456",
        max_attendees: 2,
        registered: 2,
      };

      mockGetEvent.mockResolvedValueOnce(mockEvent);

      await expect(createAttendee(registrationData)).rejects.toThrow(
        "Event event-456 is full"
      );
    });

    it("should throw if already registered", async() => {
      const registrationData = {
        user_id: "user-123",
        event_id: "event-456",
      };
      const mockEvent = {
        event_id: "event-456",
        max_attendees: 100,
        registered: 10,
      };

      mockGetEvent.mockResolvedValueOnce(mockEvent);
      (AttendeeRepository.getRegisteredAttendee as jest.Mock).mockResolvedValueOnce({ data: registrationData });

      await expect(createAttendee(registrationData)).rejects.toThrow("User already registered for event");
    });


    it("should not throw when all validations pass", async () => {
      const registrationData = {
        user_id: "user-123",
        event_id: "event-456",
      };
      const mockEvent = {
        event_id: "event-456",
        max_attendees: 100,
        registered: 10,
      };

      mockGetEvent.mockResolvedValueOnce(mockEvent);
      (AttendeeRepository.getRegisteredAttendee as jest.Mock).mockResolvedValueOnce({ data: null });

      expect(await createAttendee(registrationData)).toEqual({
        ...registrationData,
        status: "PROCESSING",
      });
    });

  });


});
