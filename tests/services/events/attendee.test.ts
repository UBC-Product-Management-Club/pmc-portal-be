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
type ValidationResult = 
    | { success: true }
    | { success: false; error: string};

describe('checkValidAttendee', () => {
  let mockFrom: jest.Mock;
  let mockSelect: jest.Mock;
  let mockEq: jest.Mock;
  let mockSingle: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create all mock functions
    mockFrom = supabase.from as jest.Mock;
    mockSelect = jest.fn();
    mockEq = jest.fn();
    mockSingle = jest.fn();

    // Default mock chain setup
    const mockChain = {
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    };

    // Make each method return the chain for further chaining
    mockSelect.mockReturnValue(mockChain);
    mockEq.mockReturnValue(mockChain);
    mockSingle.mockReturnValue(mockChain);

    // from() returns the chain
    mockFrom.mockReturnValue(mockChain);
  });

  describe('validation errors', () => {
    it('should return error for missing user_id', async () => {
      const registrationData: AttendeeInsert = {
        user_id: '',
        event_id: 'event-456',
      };

      const result = await checkValidAttendee(registrationData);

      expect(result).toEqual({
        success: false,
        error: 'Missing required fields',
      });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should return error for missing event_id', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: '',
      };

      const result = await checkValidAttendee(registrationData);

      expect(result).toEqual({
        success: false,
        error: 'Missing required fields',
      });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should return error when event not found', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'nonexistent-event',
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

      const result = await checkValidAttendee(registrationData);

      expect(result).toEqual({
        success: false,
        error: 'Event not found',
      });
      expect(mockFrom).toHaveBeenCalledWith('Event');
    });

    it('should return error when event data is null', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
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

      const result = await checkValidAttendee(registrationData);

      expect(result).toEqual({
        success: false,
        error: 'Event not found',
      });
    });

    it('should return error when user already registered', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
      };

      const mockEvent = { event_id: 'event-456', max_attendees: 100 };
      const existingAttendee = { attendee_id: 'existing-123', user_id: 'user-123', event_id: 'event-456' };

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
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              count: 2,
              error: null
            })
          })
        });

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
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              count: null,
              error: { message: 'Database error' }
            })
          })
        });

      const result = await checkValidAttendee(registrationData);

      expect(result).toEqual({
        success: false,
        error: 'Error counting attendees: Database error',
      });
    });
  });

  describe('successful validation', () => {
    it('should return success when all validations pass', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
      };

      const mockEvent = { event_id: 'event-456', max_attendees: 100 };

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
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              count: 50,
              error: null
            })
          })
        });

      const result = await checkValidAttendee(registrationData);

      expect(result).toEqual({
        success: true,
      });
      expect(mockFrom).toHaveBeenCalledTimes(3);
    });
  });

  describe('call sequence verification', () => {
    it('should call supabase methods in correct order', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
      };

      const mockEvent = { event_id: 'event-456', max_attendees: 100 };

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
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              count: 50,
              error: null
            })
          })
        });

      await checkValidAttendee(registrationData);

      expect(mockFrom).toHaveBeenCalledTimes(3);
      expect(mockFrom).toHaveBeenNthCalledWith(1, 'Event');
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'Attendee');
      expect(mockFrom).toHaveBeenNthCalledWith(3, 'Attendee');
    });
  });
});

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

      // Mock the sequence of calls for validation
      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockEvent,
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: null
                })
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              count: 50,
              error: null
            })
          })
        })
        .mockReturnValueOnce({
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
      expect(mockFrom).toHaveBeenCalledTimes(4);
      expect(mockFrom).toHaveBeenNthCalledWith(1, 'Event');
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'Attendee');
      expect(mockFrom).toHaveBeenNthCalledWith(3, 'Attendee');
      expect(mockFrom).toHaveBeenNthCalledWith(4, 'Attendee');
    });

    it('should handle free events (null paymentId)', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
        payment_id: null,
        event_form_answers: { shirtSize: 'L' }
      };

      const mockEvent = { event_id: 'event-456', name: 'Free Event', max_attendees: 100 };
      const mockAttendee: AttendeeRow = {
        attendee_id: 'attendee-123',
        user_id: 'user-123',
        event_id: 'event-456',
        payment_id: null,
        event_form_answers: { shirtSize: 'L' },
        registration_time: '2025-01-15T10:00:00.000Z',
        status: 'registered',
        is_payment_verified: true,
        
      };

      // Mock successful validation flow
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
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              count: 25,
              error: null
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
      expect(result.event_form_answers).toEqual({ shirtSize: 'L' });
    });

    it('should handle minimal required fields', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
      };

      const mockEvent = { event_id: 'event-456', name: 'Minimal Event', max_attendees: 50 };
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

      // Mock successful validation flow
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
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              count: 10,
              error: null
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

      expect(result.user_id).toBe('user-123');
      expect(result.event_id).toBe('event-456');
      expect(result.status).toBe('registered');
    });
  });

  describe('error handling', () => {
    it('should throw error when validation fails - missing user_id', async () => {
      const registrationData: AttendeeInsert = {
        user_id: '',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: {}
      };

      await expect(addSupabaseAttendee(registrationData)).rejects.toThrow('Missing required fields');
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should throw error when validation fails - missing event_id', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: '',
        payment_id: 'payment-789',
        event_form_answers: {}
      };

      await expect(addSupabaseAttendee(registrationData)).rejects.toThrow('Missing required fields');
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should throw error when event not found', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
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

      await expect(addSupabaseAttendee(registrationData)).rejects.toThrow('Event not found');
    });

    it('should throw error when user already registered', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: {}
      };

      const mockEvent = { event_id: 'event-456', name: 'Test Event', max_attendees: 100 };
      const existingAttendee = { attendee_id: 'existing-123', user_id: 'user-123', event_id: 'event-456' };

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

    it('should throw error when event is full', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: {}
      };

      const mockEvent = { event_id: 'event-456', name: 'Full Event', max_attendees: 2 };

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
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              count: 2,
              error: null
            })
          })
        });

      await expect(addSupabaseAttendee(registrationData)).rejects.toThrow('Event is full');
    });

    it('should throw error when insert fails', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: {}
      };

      const mockEvent = { event_id: 'event-456', name: 'Test Event', max_attendees: 100 };

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
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              count: 50,
              error: null
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
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: {}
      };

      const mockEvent = { event_id: 'event-456', max_attendees: 100 };
      const mockAttendee = { attendee_id: 'attendee-123', user_id: 'user-123', event_id: 'event-456' };

      // Mock successful responses
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
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              count: 50,
              error: null
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

      await addSupabaseAttendee(registrationData);

      // Verify the sequence of calls
      expect(mockFrom).toHaveBeenCalledTimes(4);
      expect(mockFrom).toHaveBeenNthCalledWith(1, 'Event');
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'Attendee');
      expect(mockFrom).toHaveBeenNthCalledWith(3, 'Attendee');
      expect(mockFrom).toHaveBeenNthCalledWith(4, 'Attendee');
    });
  });

  describe('data transformation', () => {
    it('should set registration_time as ISO string and status as registered', async () => {
      const registrationData: AttendeeInsert = {
        user_id: 'user-123',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: { question: 'answer' }
      };

      const mockEvent = { event_id: 'event-456', name: 'Test Event', max_attendees: 100 };
      const mockAttendee: AttendeeRow = {
        attendee_id: 'attendee-123',
        user_id: 'user-123',
        event_id: 'event-456',
        payment_id: 'payment-789',
        event_form_answers: { question: 'answer' },
        registration_time: '2025-01-15T10:00:00.000Z',
        status: 'registered',
        is_payment_verified: true,
        
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
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              count: 50,
              error: null
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