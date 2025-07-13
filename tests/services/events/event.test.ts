jest.mock('../../../src/config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  }
}));

import { supabase } from '../../../src/config/supabase';
import { getSupabaseEvents, getSupabaseEventById } from '../../../src/services/events/event';

const mockedSupabaseFrom = jest.fn();
const mockedSupabaseSelect = jest.fn();
const mockedSupabaseEq = jest.fn();

(supabase.from as jest.Mock).mockImplementation(mockedSupabaseFrom);

describe('getSupabaseEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedSupabaseFrom.mockReturnValue({
      select: mockedSupabaseSelect,
    });
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
    jest.clearAllMocks();

    mockedSupabaseSelect.mockImplementation(() => ({
      eq: mockedSupabaseEq
    }));

    mockedSupabaseFrom.mockReturnValue({
        select: mockedSupabaseSelect,
    });
    
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