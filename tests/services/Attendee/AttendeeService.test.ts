import * as AttendeeService from '../../../src/services/Attendee/AttendeeService';
import { getEvent } from '../../../src/services/Event/EventService';
import { AttendeeRepository } from '../../../src/storage/AttendeeRepository';

jest.mock('../../../src/services/Event/EventService');
jest.mock('../../../src/storage/AttendeeRepository');

describe("AttendeeService", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkValidAttendee', () => {
    const valid = { user_id: 'u1', event_id: 'e1' };

    it('throws when missing fields', async () => {
      await expect(AttendeeService.checkValidAttendee({ user_id: '', event_id: 'e' }))
        .rejects.toThrow("Missing required fields");
      await expect(AttendeeService.checkValidAttendee({ user_id: 'u', event_id: '' }))
        .rejects.toThrow("Missing required fields");
    });

    it('throws when event missing', async () => {
      (getEvent as jest.Mock).mockResolvedValueOnce(null);

      await expect(AttendeeService.checkValidAttendee(valid))
        .rejects.toThrow(`Event missing: e1`);
    });

    it('throws when event full', async () => {
      (getEvent as jest.Mock).mockResolvedValueOnce({ max_attendees: 2, registered: 2 });

      await expect(AttendeeService.checkValidAttendee(valid))
        .rejects.toThrow(`Event e1 is full!`);
    });

    it('throws when already registered', async () => {
      (getEvent as jest.Mock).mockResolvedValueOnce({ max_attendees: 100, registered: 0 });
      (AttendeeRepository.getRegisteredAttendee as jest.Mock)
        .mockResolvedValueOnce({ data: {} });

      await expect(AttendeeService.checkValidAttendee(valid))
        .rejects.toThrow(`User already registered for event`);
    });

    it('passes when valid', async () => {
      (getEvent as jest.Mock).mockResolvedValueOnce({ max_attendees: 100, registered: 0 });
      (AttendeeRepository.getRegisteredAttendee as jest.Mock)
        .mockResolvedValueOnce({ data: null });

      await expect(AttendeeService.checkValidAttendee(valid)).resolves.not.toThrow();
    });
  });

  describe('addAttendee', () => {
    const input = { user_id: 'u1', event_id: 'e1' };
    const output = { ...input, attendee_id: 'a1', status: 'registered' };

    it('inserts attendee', async () => {
      jest.spyOn(AttendeeService, "checkValidAttendee").mockResolvedValueOnce(undefined);

      (AttendeeRepository.addAttendee as jest.Mock)
        .mockResolvedValueOnce({ data: output, error: null });

      const result = await AttendeeService.addAttendee(input);
      expect(result).toEqual(output);
    });

    it('throws on insert error', async () => {
      jest.spyOn(AttendeeService, "checkValidAttendee").mockResolvedValueOnce(undefined);

      (AttendeeRepository.addAttendee as jest.Mock)
        .mockResolvedValueOnce({ data: null, error: { message: "DB fail" } });

      await expect(AttendeeService.addAttendee(input))
        .rejects.toThrow("Failed to create attendee: DB fail");
    });
  });

  describe('getAttendee', () => {
    it('returns attendee', async () => {
      (AttendeeRepository.getAttendee as jest.Mock)
        .mockResolvedValueOnce({ data: { a: 1 }, error: null });

      const result = await AttendeeService.getAttendee("e", "u");
      expect(result).toEqual({ a: 1 });
    });

    it('throws on error', async () => {
      (AttendeeRepository.getAttendee as jest.Mock)
        .mockResolvedValueOnce({ data: null, error: { message: "fail" } });

      await expect(AttendeeService.getAttendee("e","u"))
        .rejects.toThrow("Failed to check if user u is registered for event e");
    });
  });
});
