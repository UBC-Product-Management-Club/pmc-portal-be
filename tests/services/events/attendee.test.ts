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
        user_id: '123',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: { shirtSize: 'M', meal: 'vegetarian' }
      };

      const mockEvent = { event_id: 'event-456', name: 'Test Event' };
      const mockAttendee = {
        attendee_id: 'attendee-123',
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
        user_id: '123',
        event_id: 'event-456',
        payment_id: null, // Null payment for free events
        event_form_answers: { shirtSize: 'L' }
      };

      const mockEvent = { event_id: 'event-456', name: 'Free Event' };
      const mockAttendee = {
        attendee_id: 'attendee-123',
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
    it('should throw error when missing required fields (user_id)', async () => {
      const registrationData = {
        user_id: '',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: {}
      };

      await expect(addSupabaseAttendee(registrationData)).rejects.toThrow('Missing required fields');
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should throw error when missing required fields (event_id)', async () => {
      const registrationData = {
        user_id: '123',
        event_id: '',
        payment_id: 'payment-789',
        event_form_answers: {}
      };

      await expect(addSupabaseAttendee(registrationData)).rejects.toThrow('Missing required fields');
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should throw error when event not found', async () => {
      const registrationData = {
        user_id: '123',
        event_id: 'nonexistent-event',
        payment_id: 'payment-789',
        event_form_answers: {}
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

      await expect(addSupabaseAttendee(registrationData)).rejects.toThrow('Event not found: No rows returned');
    });

    it('should throw error when event data is null', async () => {
      const registrationData = {
        user_id: '123',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: {}
      };

      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      });

      await expect(addSupabaseAttendee(registrationData)).rejects.toThrow('Event not found: undefined');
    });

    it('should throw error when user already registered', async () => {
      const registrationData = {
        user_id: '123',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: {}
      };

      const mockEvent = { event_id: 'event-456', name: 'Test Event' };
      const existingAttendee = { attendee_id: 'existing-123', user_id: '123', event_id: 'event-456' };

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
        user_id: '123',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: {}
      };

      const mockEvent = { event_id: 'event-456', name: 'Test Event' };

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

      await expect(addSupabaseAttendee(registrationData)).rejects.toThrow('Failed to create attendee: Foreign key constraint violation');
    });
  });

  describe('call sequence verification', () => {
    it('should call supabase methods in correct order', async () => {
      const registrationData = {
        user_id: '123',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: {}
      };

      // Mock successful responses
      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { event_id: 'event-456' }, error: null })
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
              single: jest.fn().mockResolvedValue({ data: { attendee_id: 'attendee-123' }, error: null })
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

    it('should correctly check event existence with event_id', async () => {
      const registrationData = {
        user_id: '123',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: {}
      };

      const mockSelectFn = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { event_id: 'event-456' }, error: null })
        })
      });

      mockFrom
        .mockReturnValueOnce({
          select: mockSelectFn
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
              single: jest.fn().mockResolvedValue({ data: { attendee_id: 'attendee-123' }, error: null })
            })
          })
        });

      await addSupabaseAttendee(registrationData);

      expect(mockSelectFn).toHaveBeenCalled();
      expect(mockSelectFn().eq).toHaveBeenCalledWith('event_id', 'event-456');
    });
  });

  describe('data transformation', () => {
    it('should set registration_time as ISO string', async () => {
      const registrationData = {
        user_id: '123',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: { question: 'answer' }
      };

      const mockEvent = { event_id: 'event-456', name: 'Test Event' };
      const mockAttendee = {
        attendee_id: 'attendee-123',
        user_id: '123',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: { question: 'answer' },
        registration_time: '2025-01-15T10:00:00.000Z',
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

      expect(result.registration_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(result.status).toBe('registered');
    });
  });
});