import { supabase } from '../../../src/config/supabase';
import { addEvent, getEvent, getEvents, getRegisteredEvents } from '../../../src/services/Event/EventService';

describe("EventService", () => {
    let mockFrom: jest.Mock = (supabase.from as jest.Mock);
    let mockSelect: jest.Mock = jest.fn();
    let mockEq: jest.Mock = jest.fn();
    let mockInsert: jest.Mock = jest.fn();
    let mockOrder: jest.Mock = jest.fn();
    let mockSingle: jest.Mock = jest.fn();
    let mockMaybeSingle: jest.Mock = jest.fn();
    let mockGte: jest.Mock = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks()
    });
  
    describe('getEvents', () => {

        it('returns event list successfully', async () => {
            const columns = "event_id, name, description, date, start_time, end_time, location, member_price, non_member_price, thumbnail, is_disabled"
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

            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    order: mockOrder.mockResolvedValueOnce({
                            data: testEvents, 
                            error: null
                    })
                })
            })
            const events = await getEvents();

            expect(events).toEqual(testEvents);
            expect(mockFrom).toHaveBeenCalledWith('Event');
            expect(mockSelect).toHaveBeenCalledWith(columns);
            expect(mockOrder).toHaveBeenCalledWith("date", { ascending: false})
        });

        it('throws error when supabase returns an error', async () => {
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    order: mockOrder.mockResolvedValueOnce({
                         data: null, 
                         error: { message: 'DB error' }
                    })
                })
            })
            await expect(getEvents()).rejects.toThrow('Failed to fetch events: DB error');
        });

        it('throws error on unexpected exception', async () => {
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    order: mockOrder.mockRejectedValueOnce(new Error("Unexpected error"))
                })
            })

            await expect(getEvents()).rejects.toThrow('Unexpected error');
        });
    });

    describe('getEvent', () => {
        const rawEvent = {
            event_id: "1",
            name: "Test Event 1",
            date: "2025-01-01",
            Attendee: [{
                count: 10
            }]
        }
        const parsedEvent = {
            event_id: "1",
            name: "Test Event 1",
            date: "2025-01-01",
            registered: 10
        }

        it('returns event', async () => {
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: jest.fn().mockReturnValueOnce({
                        eq: mockEq.mockReturnValueOnce({
                            maybeSingle: mockMaybeSingle.mockResolvedValueOnce({
                                data: rawEvent,
                                error: null 
                            })
                        })
                    })
                })
            })
            
            const result = await getEvent('1');
            expect(result).toEqual(parsedEvent);

            expect(mockFrom).toHaveBeenCalledWith('Event')
            expect(mockSelect).toHaveBeenCalledWith('*, Attendee(count)')
            expect(mockEq).toHaveBeenCalledWith("Attendee.is_payment_verified", true)
            expect(mockMaybeSingle).toHaveBeenCalled()
        });

        it('throws an error when fetch fails', async () => {
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: jest.fn().mockReturnValueOnce({
                        eq: mockEq.mockReturnValueOnce({
                            maybeSingle: mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } }),
                        })
                    })
                })
            })

            await expect(getEvent('bad-id')).rejects.toThrow('Failed to fetch event bad-id: Not found');
        });

        it('returns null when no event found', async () => {
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: jest.fn().mockReturnValueOnce({
                        eq: mockEq.mockReturnValueOnce({
                            maybeSingle: mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null }),
                        })
                    })
                })
            })

            const event = await getEvent("???")

            expect(event).toBeNull()
        });

        it('throws on unexpected exception', async () => {
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: jest.fn().mockReturnValueOnce({
                        eq: mockEq.mockReturnValueOnce({
                            maybeSingle: mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'Unexpected failure' } }),
                        })
                    })
                })
            })
            await expect(getEvent('1')).rejects.toThrow('Unexpected failure');
        });

    });

    describe('addEvent', () => {

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
            needs_review: true
        };

        it('successfully inserts event', async () => {
            mockFrom.mockReturnValue({
                insert: mockInsert.mockResolvedValue({ error: null }),
            });

        await expect(addEvent(validEvent)).resolves.toBeUndefined();

            expect(mockFrom).toHaveBeenCalledWith('Event');
            expect(mockInsert).toHaveBeenCalledWith(validEvent);
        });

        it('throws if required fields are missing', async () => {
            const missingDate = { ...validEvent, date: '' };
            await expect(addEvent(missingDate)).rejects.toThrow('Missing required fields.');
        });

        it('throws if date format invalid', async () => {
            const invalidDate = { ...validEvent, date: '07/20/2025' };
            await expect(addEvent(invalidDate)).rejects.toThrow('Event date invalid');
        });

        it('throws if start_time format invalid', async () => {
            const invalidStartTime = { ...validEvent, start_time: '09:00:00' };
            await expect(addEvent(invalidStartTime)).rejects.toThrow('Start time invalid');
        });

        it('throws if end_time format invalid', async () => {
            const invalidEndTime = { ...validEvent, end_time: '11:00:00' };
            await expect(addEvent(invalidEndTime)).rejects.toThrow('End time invalid');
        });

        it('throws if supabase insert returns error', async () => {
            mockFrom.mockReturnValue({
                insert: mockInsert.mockResolvedValue({ error: { message: 'DB error' } }),
            });

            await expect(addEvent(validEvent)).rejects.toThrow('Failed to insert event due to unexpected error: DB error');
        });
    });

    describe('getRegisteredEvents', () => {

      it('returns user events successfully', async () => {
        const userId = 'user123';
        const mockEvents = [
            {Event: { event_id: 'event1', name: 'Event 1', date: '2024-12-01', description: 'First event' }},
            {Event: { event_id: 'event2', name: 'Event 2', date: '2024-11-15', description: 'Second event' }}
        ]

        const expectedEvents = [
            { event_id: 'event1', name: 'Event 1', date: '2024-12-01', description: 'First event' },
            { event_id: 'event2', name: 'Event 2', date: '2024-11-15', description: 'Second event' }
        ]

       mockFrom.mockReturnValueOnce({
            select: mockSelect.mockReturnValueOnce({
                eq: mockEq.mockReturnValueOnce({
                    gte: mockGte.mockReturnValueOnce({
                        order: mockOrder.mockResolvedValueOnce({
                            data: mockEvents,
                            error: null
                        })
                    })
                })
            })
        })

        const result = await getRegisteredEvents(userId);

        expect(result).toEqual(expectedEvents);
        expect(mockFrom).toHaveBeenCalledWith('Attendee');
        expect(mockSelect).toHaveBeenCalled()
        expect(mockEq).toHaveBeenCalledWith("user_id", userId)
        expect(mockGte).toHaveBeenCalled()
        expect(mockOrder).toHaveBeenCalledWith("date", { referencedTable: "Event", ascending: false })
      });

      it('returns no events', async () => {

        mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        gte: mockGte.mockReturnValueOnce({
                            order: mockOrder.mockResolvedValueOnce({
                                data: [],
                                error: null
                            })
                        })
                    })
                })
            })

        const result = await getRegisteredEvents('user-id');

        expect(result).toEqual([])
        expect(mockFrom).toHaveBeenCalledWith('Attendee');
        expect(mockSelect).toHaveBeenCalled()
        expect(mockEq).toHaveBeenCalledWith("user_id", 'user-id')
        expect(mockGte).toHaveBeenCalled()
        expect(mockOrder).toHaveBeenCalledWith("date", { referencedTable: "Event", ascending: false })
      })

      it('throws on unexpected exception', async () => {
        const userId = 'user123';

       mockFrom.mockReturnValueOnce({
            select: mockSelect.mockReturnValueOnce({
              eq: mockEq.mockReturnValueOnce({
                gte: mockGte.mockReturnValueOnce({
                    order: mockOrder.mockRejectedValueOnce(new Error("Unexpected error"))
                })
              })
            })
          })


        await expect(getRegisteredEvents(userId)).rejects.toThrow('Unexpected error');
      });
    });

})