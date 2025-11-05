import { Tables, TablesInsert } from "../../../src/schema/v2/database.types";
import * as AttendeeService from "../../../src/services/Attendee/AttendeeService";
import { addAttendee } from "../../../src/services/Attendee/AttendeeService";
import { getEvent } from "../../../src/services/Event/EventService";
import { AttendeeRepository } from "../../../src/storage/AttendeeRepository";
import { EventRepository } from "../../../src/storage/EventRepository";

jest.mock("../../../src/services/Event/EventService", () => ({
    getEvent: jest.fn()
}));
jest.mock("../../../src/storage/AttendeeRepository");

type AttendeeInsert = TablesInsert<"Attendee">;
type AttendeeRow = Tables<"Attendee">;

describe("AttendeeService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("checkValidAttendee", () => {
    const valid = { user_id: "u1", event_id: "e1" };

    it("throws when missing fields", async () => {
      await expect(
        AttendeeService.checkValidAttendee({ user_id: "", event_id: "e" })
      ).rejects.toThrow("Missing required fields");
      await expect(
        AttendeeService.checkValidAttendee({ user_id: "u", event_id: "" })
      ).rejects.toThrow("Missing required fields");
    });

    it("throws when event missing", async () => {
      (getEvent as jest.Mock).mockResolvedValueOnce(null);

      await expect(AttendeeService.checkValidAttendee(valid)).rejects.toThrow(
        `Event missing: e1`
      );
    });

    it("throws when event full", async () => {
      (getEvent as jest.Mock).mockResolvedValueOnce({ max_attendees: 2, registered: 2});

      await expect(AttendeeService.checkValidAttendee(valid)).rejects.toThrow(
        `Event e1 is full!`
      );
    });

    it("throws when already registered", async () => {
      (getEvent as jest.Mock).mockResolvedValueOnce({
        max_attendees: 100,
        registered: 1,
      });
      (
        AttendeeRepository.getRegisteredAttendee as jest.Mock
      ).mockResolvedValueOnce({ data: {} });

      await expect(AttendeeService.checkValidAttendee(valid)).rejects.toThrow(
        `User already registered for event`
      );
    });

    it("passes when valid", async () => {
      (getEvent as jest.Mock).mockResolvedValueOnce({
        max_attendees: 100,
        registered: 0,
      });
      (
        AttendeeRepository.getRegisteredAttendee as jest.Mock
      ).mockResolvedValueOnce({ data: null });

      await expect(
        AttendeeService.checkValidAttendee(valid)
      ).resolves.not.toThrow();
    });
  });

  describe("addAttendee", () => {
    beforeEach(() => {
      jest
        .spyOn(AttendeeService, "checkValidAttendee")
        .mockResolvedValue(undefined);
    });

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
      (AttendeeRepository.addAttendee as jest.Mock).mockResolvedValueOnce({ data: mockAttendee })
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
      (AttendeeRepository.addAttendee as jest.Mock).mockResolvedValueOnce({
        data: mockAttendee,
      });

      const result = await addAttendee(registrationData);

      expect(result).toEqual(mockAttendee);
    });

    it("throws on insert error", async () => {
      const registrationData: AttendeeInsert = {
        user_id: "user-123",
        event_id: "event-456",
        payment_id: "payment-789",
        event_form_answers: { shirtSize: "M", meal: "vegetarian" },
      };

      jest
        .spyOn(AttendeeService, "checkValidAttendee")
        .mockResolvedValueOnce(undefined);

      (AttendeeRepository.addAttendee as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: "DB fail" },
      });

      await expect(
        AttendeeService.addAttendee(registrationData)
      ).rejects.toThrow("Failed to create attendee: DB fail");
    });
  });

  describe("getAttendee", () => {
    it("returns attendee", async () => {
      (AttendeeRepository.getAttendee as jest.Mock).mockResolvedValueOnce({
        data: { a: 1 },
        error: null,
      });

      const result = await AttendeeService.getAttendee("e", "u");
      expect(result).toEqual({ a: 1 });
    });

    it("throws on error", async () => {
      (AttendeeRepository.getAttendee as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: "fail" },
      });

      await expect(AttendeeService.getAttendee("e", "u")).rejects.toThrow(
        "Failed to check if user u is registered for event e"
      );
    });
  });
});
