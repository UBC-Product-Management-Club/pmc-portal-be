jest.mock('../../../src/config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  }
}));

import { supabase } from '../../../src/config/supabase';
import { addSupabaseAttendee } from '../../../src/services/events/attendee';

describe('addSupabaseAttendee', () => {
  let mockFrom: jest.Mock;
  let mockSelect: jest.Mock;
  let mockEq: jest.Mock;
  let mockSingle: jest.Mock;
  let mockInsert: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create all mock functions
    mockFrom = supabase.from as jest.Mock;
    mockSelect = jest.fn();
    mockEq = jest.fn();
    mockSingle = jest.fn();
    mockInsert = jest.fn();

    // Default mock chain setup
    const mockChain = {
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      insert: mockInsert,
    };

    // Make each method return the chain for further chaining
    mockSelect.mockReturnValue(mockChain);
    mockEq.mockReturnValue(mockChain);
    mockInsert.mockReturnValue(mockChain);
    mockSingle.mockReturnValue(mockChain);

    // from() returns the chain
    mockFrom.mockReturnValue(mockChain);
  });

  describe('successful registration', () => {
    it('should create attendee successfully', async () => {
      const registrationData = {
        userId: '123',
        eventId: 'event-456',
        paymentId: 'payment-789',
        eventFormAnswers: { shirtSize: 'M', meal: 'vegetarian' }
      };

      const mockEvent = { id: 'event-456', name: 'Test Event' };
      const mockAttendee = {
        id: 'attendee-123',
        user_id: '123',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: { shirtSize: 'M', meal: 'vegetarian' },
        registration_time: expect.any(String),
        status: 'registered'
      };

      // Mock the sequence of calls
      mockFrom
        .mockReturnValueOnce({ // First call: Check if event exists
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockEvent,
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({ // Second call: Check existing attendee
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null, // No existing attendee
                  error: null
                })
              })
            })
          })
        })
        .mockReturnValueOnce({ // Third call: Insert new attendee
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockAttendee,
                error: null
              })
            })
          })
        });

      const result = await addSupabaseAttendee(registrationData);

      expect(result).toEqual(mockAttendee);
      expect(mockFrom).toHaveBeenCalledTimes(3);
      expect(mockFrom).toHaveBeenNthCalledWith(1, 'Event');
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'Attendee');
      expect(mockFrom).toHaveBeenNthCalledWith(3, 'Attendee');
    });

    it('should handle free events (null paymentId)', async () => {
      const registrationData = {
        userId: '123',
        eventId: 'event-456',
        paymentId: '', // Empty string should become null
        eventFormAnswers: { shirtSize: 'L' }
      };

      const mockEvent = { id: 'event-456', name: 'Free Event' };
      const mockAttendee = {
        id: 'attendee-123',
        user_id: '123',
        event_id: 'event-456',
        payment_id: null,
        event_form_answers: { shirtSize: 'L' },
        registration_time: expect.any(String),
        status: 'registered'
      };

      // Mock successful flow
      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockEvent, error: null })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockAttendee, error: null })
            })
          })
        });

      const result = await addSupabaseAttendee(registrationData);

      expect(result.payment_id).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw error when missing required fields', async () => {
      const registrationData = {
        userId: '',
        eventId: 'event-456',
        paymentId: 'payment-789',
        eventFormAnswers: {}
      };

      await expect(addSupabaseAttendee(registrationData)).rejects.toThrow('Missing required fields');
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should throw error when event not found', async () => {
      const registrationData = {
        userId: '123',
        eventId: 'nonexistent-event',
        paymentId: 'payment-789',
        eventFormAnswers: {}
      };

      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'No rows returned' }
            })
          })
        })
      });

      await expect(addSupabaseAttendee(registrationData)).rejects.toThrow('Event not found');
    });

    it('should throw error when user already registered', async () => {
      const registrationData = {
        userId: '123',
        eventId: 'event-456',
        paymentId: 'payment-789',
        eventFormAnswers: {}
      };

      const mockEvent = { id: 'event-456', name: 'Test Event' };
      const existingAttendee = { id: 'existing-123', user_id: '123', event_id: 'event-456' };

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockEvent, error: null })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: existingAttendee, error: null })
              })
            })
          })
        });

      await expect(addSupabaseAttendee(registrationData)).rejects.toThrow('User already registered for this event');
    });

    it('should throw error when insert fails', async () => {
      const registrationData = {
        userId: '123',
        eventId: 'event-456',
        paymentId: 'payment-789',
        eventFormAnswers: {}
      };

      const mockEvent = { id: 'event-456', name: 'Test Event' };

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockEvent, error: null })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Foreign key constraint violation' }
              })
            })
          })
        });

      await expect(addSupabaseAttendee(registrationData)).rejects.toThrow('Failed to create attendee');
    });
  });

  describe('call sequence verification', () => {
    it('should call supabase methods in correct order', async () => {
      const registrationData = {
        userId: '123',
        eventId: 'event-456',
        paymentId: 'payment-789',
        eventFormAnswers: {}
      };

      // Mock successful responses
      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'event-456' }, error: null })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'attendee-123' }, error: null })
            })
          })
        });

      await addSupabaseAttendee(registrationData);

      // Verify the sequence of calls
      expect(mockFrom).toHaveBeenCalledTimes(3);
      expect(mockFrom).toHaveBeenNthCalledWith(1, 'Event');     // Check event exists
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'Attendee');  // Check existing attendee
      expect(mockFrom).toHaveBeenNthCalledWith(3, 'Attendee');  // Insert new attendee
    });
  });
});