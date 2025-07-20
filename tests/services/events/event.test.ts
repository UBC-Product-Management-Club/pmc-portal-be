import { supabase } from '../../../src/config/supabase';
import { getSupabaseEvents, getSupabaseEventById, addSupabaseEvent } from '../../../src/services/events/event';

const mockedSupabaseFrom = jest.fn();
const mockedSupabaseSelect = jest.fn();
const mockedSupabaseEq = jest.fn();
const mockedSupabaseInsert = jest.fn();

(supabase.from as jest.Mock).mockImplementation(mockedSupabaseFrom);

// Supabase setup helper
function setupSupabaseMocks() {
  jest.clearAllMocks();

  mockedSupabaseSelect.mockImplementation(() => ({
    eq: mockedSupabaseEq,
  }));

  mockedSupabaseFrom.mockReturnValue({
    select: mockedSupabaseSelect,
    insert: mockedSupabaseInsert, // add as needed
  });
}

describe('getSupabaseEvents', () => {
  beforeEach(() => {
    setupSupabaseMocks();
  });
  
  it('returns event list successfully', async () => {
    const testEvents = [
      {
        event_id: "1",
        name: "Test Event 1",
        date: "2025-01-01"
      },
      {
        event_id: "2", 
        name: "Test Event 2",
        date: "2025-01-02"
      }
    ];

    mockedSupabaseSelect.mockResolvedValue({ data: testEvents, error: null });

    const events = await getSupabaseEvents();

    expect(events).toEqual(testEvents);
    expect(mockedSupabaseFrom).toHaveBeenCalledWith('Event');
    expect(mockedSupabaseSelect).toHaveBeenCalled();
  });

  it('throws error when supabase returns an error', async () => {
    mockedSupabaseSelect.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    await expect(getSupabaseEvents()).rejects.toThrow('Failed to fetch events: DB error');
  });

  it('throws error on unexpected exception', async () => {
    mockedSupabaseFrom.mockImplementation(() => { throw new Error('Unexpected error'); });

    await expect(getSupabaseEvents()).rejects.toThrow('Unexpected error');
  });
});



describe('getSupabaseEventsById', () => {
  const testEvents = [
    {
      event_id: "1",
      name: "Test Event 1",
      date: "2025-01-01"
    },
    {
      event_id: "2", 
      name: "Test Event 2",
      date: "2025-01-02"
    }
  ];
    
  beforeEach(() => {
    setupSupabaseMocks();
  });
  
  it('returns event', async () => {

    mockedSupabaseEq.mockReturnValue({
      single: () => Promise.resolve({ data: testEvents[0], error: null }),
    });


    const result = await getSupabaseEventById('1');
    expect(result).toEqual(testEvents[0]);
    expect(supabase.from).toHaveBeenCalledWith('Event');
    expect(mockedSupabaseSelect).toHaveBeenCalled();
    expect(mockedSupabaseEq).toHaveBeenCalledWith('event_id', '1');
  });

  it('throws an error when supabase returns an error', async () => {
    mockedSupabaseEq.mockReturnValue({
      single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
    });

    await expect(getSupabaseEventById('bad-id')).rejects.toThrow('Failed to fetch event bad-id: Not found');
  });

  it('throws an error when data is null', async () => {
    mockedSupabaseEq.mockReturnValue({
      single: () => Promise.resolve({ data: null, error: null }),
    });

    await expect(getSupabaseEventById('missing')).rejects.toThrow('Failed to fetch event missing: undefined');
  });

  it('throws on unexpected exception', async () => {
    mockedSupabaseEq.mockImplementation(() => {
      throw new Error('Unexpected failure');
    });

    await expect(getSupabaseEventById('1')).rejects.toThrow('Unexpected failure');
  });

});


describe('addSupabaseEvent', () => {
  beforeEach(() => {
    setupSupabaseMocks();
  });

  const validEvent = {
    event_id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Event',
    date: '2025-08-01',
    start_time: '2025-08-01T17:00:00Z',
    end_time: '2025-08-01T19:00:00Z',
    description: 'This is a description of the test event.',
    location: 'Test Location',
    member_price: 20,
    non_member_price: 30,
    max_attendees: 100,
    event_form_questions: { questions: [{ id: 1, question: "What is your name?" }] }, // example JSON
    is_disabled: false,
    media: ['https://example.com/media1.jpg', 'https://example.com/media2.jpg'],
    thumbnail: 'https://example.com/thumbnail.jpg',
  };

  it('successfully inserts event', async () => {
    mockedSupabaseFrom.mockReturnValue({
      insert: jest.fn().mockResolvedValue({ error: null }),
    });

  await expect(addSupabaseEvent(validEvent)).resolves.toBeUndefined();

    expect(mockedSupabaseFrom).toHaveBeenCalledWith('Event');
    expect(mockedSupabaseFrom().insert).toHaveBeenCalledWith(validEvent);
  });

  it('throws if required fields are missing', async () => {
    const missingDate = { ...validEvent, date: '' };
    await expect(addSupabaseEvent(missingDate)).rejects.toThrow('Missing required fields.');
  });

  it('throws if date format invalid', async () => {
    const invalidDate = { ...validEvent, date: '07/20/2025' };
    await expect(addSupabaseEvent(invalidDate)).rejects.toThrow('Event date invalid');
  });

  it('throws if start_time format invalid', async () => {
    const invalidStartTime = { ...validEvent, start_time: '09:00:00' };
    await expect(addSupabaseEvent(invalidStartTime)).rejects.toThrow('Start time invalid');
  });

  it('throws if end_time format invalid', async () => {
    const invalidEndTime = { ...validEvent, end_time: '11:00:00' };
    await expect(addSupabaseEvent(invalidEndTime)).rejects.toThrow('End time invalid');
  });

  it('throws if supabase insert returns error', async () => {
    mockedSupabaseFrom.mockReturnValue({
      insert: jest.fn().mockResolvedValue({ error: { message: 'DB error' } }),
    });

    await expect(addSupabaseEvent(validEvent)).rejects.toThrow('Failed to insert event due to unexpected error: DB error');
  });
});