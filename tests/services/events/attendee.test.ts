jest.mock('../../../src/config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  }
}));

import { supabase } from '../../../src/config/supabase';
import { addSupabaseAttendee, checkValidAttendee } from '../../../src/services/events/attendee';
import { Database } from '../../../src/schema/v2/database.types';

type AttendeeRow = Database['public']['Tables']['Attendee']['Row'];
type AttendeeInsert = Database['public']['Tables']['Attendee']['Insert'];

// Mock for: supabase.from('Table').select().eq().single()
function createSelectEqSingle(returnValue: any) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(returnValue)
      })
    })
  };
}

// Mock for: supabase.from('Table').select().eq().eq().single() (two eq calls)
function createSelectEqEqSingle(returnValue: any) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue(returnValue)
        })
      })
    })
  };
}

// Mock for: supabase.from('Table').select().eq() (for counting)
function createSelectEq(returnValue: any) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue(returnValue)
    })
  };
}

// Mock for: supabase.from('Table').insert().select().single()
function createInsertSelectSingle(returnValue: any) {
  return {
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(returnValue)
      })
    })
  };
}

describe('checkValidAttendee', () => {
  let mockFrom: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom = supabase.from as jest.Mock;
  });

  describe('validation errors', () => {
    it('should return error for missing required fields', async () => {
      const testCases = [
        { user_id: '', event_id: 'event-456' },
        { user_id: 'user-123', event_id: '' },
      ];

      for (const registrationData of testCases) {
        const result = await checkValidAttendee(registrationData);
        expect(result).toEqual({
          success: false,
          error: 'Missing required fields',
        });
      }
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should return error when event not found', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'nonexistent-event',
      };

      mockFrom.mockReturnValue(createSelectEqSingle({
        data: null,
        error: { message: 'No rows returned' }
      }));

      const result = await checkValidAttendee(registrationData);

      expect(result).toEqual({
        success: false,
        error: 'Event not found',
      });
      expect(mockFrom).toHaveBeenCalledWith('Event');
    });

    it('should return error when user already registered', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
      };

      const mockEvent = { event_id: 'event-456', max_attendees: 100 };
      const existingAttendee = { attendee_id: 'existing-123', user_id: 'user-123', event_id: 'event-456' };

      mockFrom
        .mockReturnValueOnce(createSelectEqSingle({ data: mockEvent, error: null }))
        .mockReturnValueOnce(createSelectEqEqSingle({ data: existingAttendee, error: null }));

      const result = await checkValidAttendee(registrationData);

      expect(result).toEqual({
        success: false,
        error: 'User already registered for this event',
      });
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    it('should return error when event is full', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
      };

      const mockEvent = { event_id: 'event-456', max_attendees: 2 };

      mockFrom
        .mockReturnValueOnce(createSelectEqSingle({ data: mockEvent, error: null }))
        .mockReturnValueOnce(createSelectEqEqSingle({ data: null, error: null }))
        .mockReturnValueOnce(createSelectEq({
          data: [],
          count: 2,
          error: null
        }));

      const result = await checkValidAttendee(registrationData);

      expect(result).toEqual({
        success: false,
        error: 'Event is full',
      });
      expect(mockFrom).toHaveBeenCalledTimes(3);
    });

    it('should return error when counting attendees fails', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
      };

      const mockEvent = { event_id: 'event-456', max_attendees: 100 };

      mockFrom
        .mockReturnValueOnce(createSelectEqSingle({ data: mockEvent, error: null }))
        .mockReturnValueOnce(createSelectEqEqSingle({ data: null, error: null }))
        .mockReturnValueOnce(createSelectEq({
          data: null,
          count: null,
          error: { message: 'Database error' }
        }));

      const result = await checkValidAttendee(registrationData);

      expect(result).toEqual({
        success: false,
        error: 'Error counting attendees: Database error',
      });
    });
  });

  it('should return success when all validations pass', async () => {
    const registrationData: AttendeeInsert = {
      user_id: 'user-123',
      event_id: 'event-456',
    };

    const mockEvent = { event_id: 'event-456', max_attendees: 100 };

    mockFrom
      .mockReturnValueOnce(createSelectEqSingle({ data: mockEvent, error: null }))
      .mockReturnValueOnce(createSelectEqEqSingle({ data: null, error: null }))
      .mockReturnValueOnce(createSelectEq({
        data: [],
        count: 50,
        error: null
      }));

    const result = await checkValidAttendee(registrationData);

    expect(result).toEqual({ success: true });
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });
});

describe('addSupabaseAttendee', () => {
  let mockFrom: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom = supabase.from as jest.Mock;
  });

  describe('successful registration', () => {
    it('should create attendee with full data', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: { shirtSize: 'M', meal: 'vegetarian' }
      };

      const mockEvent = { event_id: 'event-456', name: 'Test Event', max_attendees: 100 };
      const mockAttendee: AttendeeRow = {
        attendee_id: 'attendee-123',
        user_id: 'user-123',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: { shirtSize: 'M', meal: 'vegetarian' },
        registration_time: '2025-01-15T10:00:00.000Z',
        status: 'registered',
        is_payment_verified: true,
      };

      mockFrom
        .mockReturnValueOnce(createSelectEqSingle({ data: mockEvent, error: null }))
        .mockReturnValueOnce(createSelectEqEqSingle({ data: null, error: null }))
        .mockReturnValueOnce(createSelectEq({
          data: [],
          count: 50,
          error: null
        }))
        .mockReturnValueOnce(createInsertSelectSingle({ data: mockAttendee, error: null }));

      const result = await addSupabaseAttendee(registrationData);

      expect(result).toEqual(mockAttendee);
      expect(mockFrom).toHaveBeenCalledTimes(4);
    });

    it('should handle free events and minimal data', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
      };

      const mockEvent = { event_id: 'event-456', name: 'Free Event', max_attendees: 100 };
      const mockAttendee: AttendeeRow = {
        attendee_id: 'attendee-123',
        user_id: 'user-123',
        event_id: 'event-456',
        payment_id: null,
        event_form_answers: null,
        registration_time: '2025-01-15T10:00:00.000Z',
        status: 'registered',
        is_payment_verified: true,
      };

      mockFrom
        .mockReturnValueOnce(createSelectEqSingle({ data: mockEvent, error: null }))
        .mockReturnValueOnce(createSelectEqEqSingle({ data: null, error: null }))
        .mockReturnValueOnce(createSelectEq({
          data: [],
          count: 25,
          error: null
        }))
        .mockReturnValueOnce(createInsertSelectSingle({ data: mockAttendee, error: null }));

      const result = await addSupabaseAttendee(registrationData);

      expect(result.payment_id).toBeNull();
      expect(result.event_form_answers).toBeNull();
      expect(result.status).toBe('registered');
    });
  });

  describe('error handling', () => {
    it('should throw error for validation failures', async () => {
      const invalidData: AttendeeInsert = {
        user_id: '',
        event_id: 'event-456',
      };

      await expect(addSupabaseAttendee(invalidData)).rejects.toThrow('Missing required fields');
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should throw error when event not found', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'nonexistent-event',
      };

      mockFrom.mockReturnValue(createSelectEqSingle({
        data: null,
        error: { message: 'No rows returned' }
      }));

      await expect(addSupabaseAttendee(registrationData)).rejects.toThrow('Event not found');
    });

    it('should throw error when user already registered', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
      };

      const mockEvent = { event_id: 'event-456', max_attendees: 100 };
      const existingAttendee = { attendee_id: 'existing-123', user_id: 'user-123', event_id: 'event-456' };

      mockFrom
        .mockReturnValueOnce(createSelectEqSingle({ data: mockEvent, error: null }))
        .mockReturnValueOnce(createSelectEqEqSingle({ data: existingAttendee, error: null }));

      await expect(addSupabaseAttendee(registrationData)).rejects.toThrow('User already registered for this event');
    });

    it('should throw error when event is full', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
      };

      const mockEvent = { event_id: 'event-456', max_attendees: 2 };

      mockFrom
        .mockReturnValueOnce(createSelectEqSingle({ data: mockEvent, error: null }))
        .mockReturnValueOnce(createSelectEqEqSingle({ data: null, error: null }))
        .mockReturnValueOnce(createSelectEq({
          data: [],
          count: 2,
          error: null
        }));

      await expect(addSupabaseAttendee(registrationData)).rejects.toThrow('Event is full');
    });

    it('should throw error when insert fails', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
      };

      const mockEvent = { event_id: 'event-456', max_attendees: 100 };

      mockFrom
        .mockReturnValueOnce(createSelectEqSingle({ data: mockEvent, error: null }))
        .mockReturnValueOnce(createSelectEqEqSingle({ data: null, error: null }))
        .mockReturnValueOnce(createSelectEq({
          data: [],
          count: 50,
          error: null
        }))
        .mockReturnValueOnce(createInsertSelectSingle({
          data: null,
          error: { message: 'Foreign key constraint violation' }
        }));

      await expect(addSupabaseAttendee(registrationData)).rejects.toThrow('Failed to create attendee: Foreign key constraint violation');
    });
  });
});