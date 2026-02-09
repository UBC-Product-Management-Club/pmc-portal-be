jest.mock("../../../src/config/stripe", () => ({
  stripe: {
    prices: {
      retrieve: jest.fn(),
    },
  },
}));

import { stripe } from "../../../src/config/stripe";
import {
  addEvent,
  getEvent,
  getEvents,
  getRegisteredEvents,
} from "../../../src/services/Event/EventService";
import { EventRepository } from "../../../src/storage/EventRepository";

describe("EventService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getEvents", () => {
    it("returns event list successfully", async () => {
      const testEvents = [
        {
          event_id: "1",
          name: "Test Event 1",
          date: "2025-01-01",
        },
        {
          event_id: "2",
          name: "Test Event 2",
          date: "2025-01-02",
        },
      ];

      // MockEventRepo.getEvents.mockResolvedValueOnce({ data: testEvents, error: null })
      (EventRepository.getEvents as jest.Mock).mockResolvedValueOnce({
        data: testEvents,
      });
      const events = await getEvents();

      expect(events).toEqual(testEvents);
    });

    it("throws error when supabase returns an error", async () => {
      (EventRepository.getEvents as jest.Mock).mockResolvedValueOnce({
        error: { message: "DB Error" },
      });
      await expect(getEvents()).rejects.toThrow("DB Error");
    });
  });

  describe("getEvent", () => {
    let mockGetPrice: jest.Mock;
    beforeEach(() => {
      mockGetPrice = stripe.prices.retrieve as jest.Mock;
    });
    const rawEvent = {
      event_id: "1",
      name: "Test Event 1",
      date: "2025-01-01",
      member_price_id: "member-price-id",
      non_member_price_id: "non-member-price-id",
      Attendee: [
        {
          count: 10,
        },
      ],
    };
    const parsedEvent = {
      event_id: "1",
      name: "Test Event 1",
      date: "2025-01-01",
      registered: 10,
      member_price_id: "member-price-id",
      non_member_price_id: "non-member-price-id",
      member_price: 10,
      non_member_price: 20,
    };

    it("returns event", async () => {
      (EventRepository.getEvent as jest.Mock).mockResolvedValueOnce({
        data: rawEvent,
      });
      mockGetPrice
        .mockResolvedValueOnce({ unit_amount: 1000 })
        .mockResolvedValueOnce({ unit_amount: 2000 });
      const result = await getEvent("1");
      expect(mockGetPrice).toHaveBeenCalledWith("member-price-id");
      expect(mockGetPrice).toHaveBeenCalledWith("non-member-price-id");
      expect(result).toEqual(parsedEvent);
    });

    it("throws an error when fetch fails", async () => {
      (EventRepository.getEvent as jest.Mock).mockResolvedValueOnce({
        error: { message: "Not found" },
      });
      await expect(getEvent("bad-id")).rejects.toThrow("Not found");
    });

    it("returns null when no event found", async () => {
      (EventRepository.getEvent as jest.Mock).mockResolvedValueOnce({
        data: null,
      });
      const event = await getEvent("???");
      expect(event).toBeNull();
    });

    it("fetches price if price id exists", async () => {
      const rawEventWithPriceIds = {
        event_id: "1",
        name: "Test Event 1",
        date: "2025-01-01",
        member_price_id: "",
        non_member_price_id: "234",
        Attendee: [
          {
            count: 10,
          },
        ],
      };
      (EventRepository.getEvent as jest.Mock).mockResolvedValueOnce({
        data: rawEventWithPriceIds,
      });
      mockGetPrice.mockResolvedValueOnce({ unit_amount: 2000 });
      const result = await getEvent("1");

      expect(mockGetPrice).toHaveBeenCalledWith("234");
      expect(result).toEqual({
        ...parsedEvent,
        member_price: 0,
        non_member_price: 20,
        member_price_id: "",
        non_member_price_id: "234",
      });
    });
  });

  // Very broken. Need to revisit
  // describe('addEvent', () => {

  //     const validEvent = {
  //         event_id: '123e4567-e89b-12d3-a456-426614174000',
  //         name: 'Test Event',
  //         date: '2025-08-01',
  //         start_time: '2025-08-01T17:00:00Z',
  //         end_time: '2025-08-01T19:00:00Z',
  //         description: 'This is a description of the test event.',
  //         location: 'Test Location',
  //         member_price: 20,
  //         non_member_price: 30,
  //         max_attendees: 100,
  //         event_form_questions: { questions: [{ id: 1, question: "What is your name?" }] }, // example JSON
  //         is_disabled: false,
  //         media: ['https://example.com/media1.jpg', 'https://example.com/media2.jpg'],
  //         thumbnail: 'https://example.com/thumbnail.jpg',
  //         needs_review: true
  //     };

  //     it('successfully inserts event', async () => {
  //         mockFrom.mockReturnValue({
  //             insert: mockInsert.mockResolvedValue({ error: null }),
  //         });

  //     await expect(addEvent(validEvent)).resolves.toBeUndefined();

  //         expect(mockFrom).toHaveBeenCalledWith('Event');
  //         expect(mockInsert).toHaveBeenCalledWith(validEvent);
  //     });

  //     it('throws if required fields are missing', async () => {
  //         const missingDate = { ...validEvent, date: '' };
  //         await expect(addEvent(missingDate)).rejects.toThrow('Missing required fields.');
  //     });

  //     it('throws if date format invalid', async () => {
  //         const invalidDate = { ...validEvent, date: '07/20/2025' };
  //         await expect(addEvent(invalidDate)).rejects.toThrow('Event date invalid');
  //     });

  //     it('throws if start_time format invalid', async () => {
  //         const invalidStartTime = { ...validEvent, start_time: '09:00:00' };
  //         await expect(addEvent(invalidStartTime)).rejects.toThrow('Start time invalid');
  //     });

  //     it('throws if end_time format invalid', async () => {
  //         const invalidEndTime = { ...validEvent, end_time: '11:00:00' };
  //         await expect(addEvent(invalidEndTime)).rejects.toThrow('End time invalid');
  //     });

  //     it('throws if supabase insert returns error', async () => {
  //         mockFrom.mockReturnValue({
  //             insert: mockInsert.mockResolvedValue({ error: { message: 'DB error' } }),
  //         });

  //         await expect(addEvent(validEvent)).rejects.toThrow('Failed to insert event due to unexpected error: DB error');
  //     });
  // });

  describe("getRegisteredEvents", () => {
    it("returns user events successfully", async () => {
      const userId = "user123";
      const mockEvents = [
        {
          Event: {
            event_id: "event1",
            name: "Event 1",
            date: "2024-12-01",
            description: "First event",
          },
        },
        {
          Event: {
            event_id: "event2",
            name: "Event 2",
            date: "2024-11-15",
            description: "Second event",
          },
        },
      ];
      const expectedEvents = [
        {
          event_id: "event1",
          name: "Event 1",
          date: "2024-12-01",
          description: "First event",
        },
        {
          event_id: "event2",
          name: "Event 2",
          date: "2024-11-15",
          description: "Second event",
        },
      ];
      (EventRepository.getRegisteredEvents as jest.Mock).mockResolvedValueOnce({
        data: mockEvents,
      });
      const result = await getRegisteredEvents(userId);
      expect(result).toEqual(expectedEvents);
    });

    it("returns no events", async () => {
      (EventRepository.getRegisteredEvents as jest.Mock).mockResolvedValueOnce({
        data: [],
      });
      const result = await getRegisteredEvents("user-id");
      expect(result).toEqual([]);
    });
  });
});
