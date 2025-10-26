
import { supabase } from '../../../src/config/supabase';
import { Database } from '../../../src/schema/v2/database.types';
import * as AttendeeService from '../../../src/services/Attendee/AttendeeService';
import { addAttendee, checkValidAttendee, getAttendee } from '../../../src/services/Attendee/AttendeeService';
import { getEvent } from '../../../src/services/Event/EventService';

type AttendeeRow = Database['public']['Tables']['Attendee']['Row'];
type AttendeeInsert = Database['public']['Tables']['Attendee']['Insert'];

jest.mock("../../../src/services/Event/EventService")

describe("AttendeeService", () => {
    let mockFrom: jest.Mock = (supabase.from as jest.Mock);
    let mockSelect: jest.Mock = jest.fn();
    let mockEq: jest.Mock = jest.fn();
    let mockInsert: jest.Mock = jest.fn();
    let mockSingle: jest.Mock = jest.fn();
    let mockMaybeSingle: jest.Mock = jest.fn();
    let mockGetEvent: jest.Mock = (getEvent as jest.Mock);
    let registrationData: AttendeeInsert;

    beforeEach(() => {
        registrationData = {
            user_id: 'user-123',
            event_id: 'event-456',
        };
    });

    describe('checkValidAttendee', () => {

        it('should throw error for missing required fields', async () => {
            const testCases = [
                { user_id: '', event_id: 'event-456' },
                { user_id: 'user-123', event_id: '' },
            ];

            for (const registrationData of testCases) {
                await expect(checkValidAttendee(registrationData)).rejects.toThrow('Missing required fields');
            }
            expect(mockFrom).not.toHaveBeenCalled();
        });

        it('should throw error when event not found', async () => {
            registrationData = {
                user_id: 'user-123',
                event_id: 'nonexistent-event',
            };

            mockGetEvent.mockResolvedValueOnce(null)

            await expect(checkValidAttendee(registrationData)).rejects.toThrow('Event missing');
            expect(mockGetEvent).toHaveBeenCalledWith(registrationData.event_id)
        });

        it('should throw error when user already registered', async () => {
            const mockEvent = { event_id: 'event-456', max_attendees: 100, attendees: 10 };
            const existingAttendee = { attendee_id: 'existing-123', user_id: 'user-123', event_id: 'event-456' };

            mockGetEvent.mockResolvedValueOnce(mockEvent)

            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: jest.fn().mockReturnValueOnce({
                        eq: jest.fn().mockReturnValueOnce({ 
                            eq: mockEq.mockReturnValueOnce({
                                maybeSingle: mockMaybeSingle.mockResolvedValueOnce({
                                    data: existingAttendee,
                                    error: null
                                })
                            })
                        })
                    })
                })
            })

            await expect(checkValidAttendee(registrationData)).rejects.toThrow('User already registered for event');
            expect(mockFrom).toHaveBeenCalledWith("Attendee")
        });

        it('should throw error when event is full', async () => {
            const mockEvent = { event_id: 'event-456', max_attendees: 2, registered: 2 };

            mockGetEvent.mockResolvedValueOnce(mockEvent)

            await expect(checkValidAttendee(registrationData)).rejects.toThrow('Event event-456 is full');
        });

        it('should throw error when counting attendees fails', async () => {
            const mockEvent = { event_id: 'event-456', max_attendees: 100 };

            mockGetEvent.mockResolvedValueOnce(mockEvent)


            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: jest.fn().mockReturnValueOnce({
                        eq: jest.fn().mockReturnValueOnce({
                            eq: mockEq.mockReturnValueOnce({ 
                                maybeSingle: mockMaybeSingle.mockResolvedValueOnce({
                                    data: null,
                                    error: {}
                                })
                            })
                      })
                    })
                })
            })

            await expect(checkValidAttendee(registrationData)).rejects.toThrow('Failed to check if user user-123 is registered for event event-456');
        });

        it('should not throw when all validations pass', async () => {
            const mockEvent = { event_id: 'event-456', max_attendees: 100, attendees: 10 };

            mockGetEvent.mockResolvedValueOnce(mockEvent)

            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: jest.fn().mockReturnValueOnce({
                        eq: jest.fn().mockReturnValueOnce({
                            eq: mockEq.mockReturnValueOnce({
                                maybeSingle: mockMaybeSingle.mockResolvedValueOnce({
                                    data: null,
                                    error: null
                                })
                            })
                        })
                    })
                })
            })

            await expect(checkValidAttendee(registrationData)).resolves.not.toThrow();
        });
    });

    describe('addAttendee', () => {
        describe('successfully', () => {

            beforeEach(() => {
                jest.spyOn(AttendeeService, "checkValidAttendee").mockResolvedValue(undefined);
            })

            it('should create attendee with full data', async () => {
                const registrationData: AttendeeInsert = {
                    user_id: 'user-123',
                    event_id: 'event-456',
                    payment_id: 'payment-789',
                    event_form_answers: { shirtSize: 'M', meal: 'vegetarian' }
                };

                const mockAttendee: AttendeeRow = {
                    attendee_id: 'attendee-123',
                    user_id: 'user-123',
                    event_id: 'event-456',
                    payment_id: 'payment-789',
                    event_form_answers: { shirtSize: 'M', meal: 'vegetarian' },
                    registration_time: '2025-01-15T10:00:00.000Z',
                    status: 'REGISTERED',
                    is_payment_verified: true,
                };

                mockFrom.mockReturnValueOnce({
                    insert: mockInsert.mockReturnValueOnce({
                        select: mockSelect.mockReturnValueOnce({
                            single: mockSingle.mockResolvedValueOnce({
                                data: mockAttendee,
                                error: null
                            })
                        })
                    })
                })

                const result = await addAttendee(registrationData);

                expect(result).toEqual(mockAttendee);
            });

            it('should handle free events and minimal data', async () => {
                const registrationData: AttendeeInsert = {
                    user_id: 'user-123',
                    event_id: 'event-456',
                };

                const mockAttendee: AttendeeRow = {
                    attendee_id: 'attendee-123',
                    user_id: 'user-123',
                    event_id: 'event-456',
                    payment_id: null,
                    event_form_answers: null,
                    registration_time: '2025-01-15T10:00:00.000Z',
                    status: 'REGISTERED',
                    is_payment_verified: true,
                };

                mockFrom.mockReturnValueOnce({
                    insert: mockInsert.mockReturnValueOnce({
                        select: mockSelect.mockReturnValueOnce({
                            single: mockSingle.mockResolvedValueOnce({
                                data: mockAttendee,
                                error: null
                            })
                        })
                    })
                })

                const result = await addAttendee(registrationData);

                expect(result.payment_id).toBeNull();
                expect(result.event_form_answers).toBeNull();
                expect(result.status).toBe('registered');
            });
        });

        describe('with errors', () => {

            it('throws error when user is not a valid attendee', async () => {
                jest.spyOn(AttendeeService, "checkValidAttendee").mockRejectedValueOnce(new Error("Invalid attendee"));
                const registrationData: AttendeeInsert = {
                    user_id: 'user-123',
                    event_id: 'event-456',
                };

                await expect(addAttendee(registrationData)).rejects.toThrow("Invalid attendee")
            })

            it('should throw error when insert fails', async () => {
                jest.spyOn(AttendeeService, "checkValidAttendee").mockResolvedValueOnce(undefined);
                const registrationData: AttendeeInsert = {
                    user_id: 'user-123',
                    event_id: 'event-456',
                };

                mockFrom.mockReturnValueOnce({
                    insert: mockInsert.mockReturnValueOnce({
                        select: mockSelect.mockReturnValueOnce({
                            single: mockSingle.mockResolvedValueOnce({
                                data: null,
                                error: { message: "Foreign key constraint violation" }
                            })
                        })
                    })
                })



                await expect(addAttendee(registrationData)).rejects.toThrow('Failed to create attendee: Foreign key constraint violation');
            });
        });

    });

    describe('getAttendee', () => {
        let mockEq2: jest.Mock;

        beforeEach(() => {
            mockEq2 = jest.fn()
        })

        const mockAttendee = {
            attendee_id: "attendee_id",
            event_form_answers: {},
            event_id: "event_id",
            is_payment_verified: true,
            payment_id: "payment_id",
            registration_time: "reg-time",
            status: "REGISTERED",
            user_id: "user_id",
        }

        it('fetches event attendee by user id', async () => {
            const eventId = "event_id";
            const userId = "user_id";
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        eq: mockEq2.mockReturnValueOnce({
                            maybeSingle: mockMaybeSingle.mockResolvedValueOnce({
                                data: mockAttendee, error: null
                            })
                        })
                    })
                })
            })

            const attendee = await getAttendee(eventId, userId)

            expect(attendee).toEqual(mockAttendee)
            expect(mockFrom).toHaveBeenCalledWith("Attendee")
            expect(mockEq).toHaveBeenCalledWith("user_id", userId)
            expect(mockEq2).toHaveBeenCalledWith("event_id", eventId)
            expect(mockMaybeSingle).toHaveBeenCalled()
        })

        it('fails to fetch attendee', async () => {
            const eventId = "event_id";
            const userId = "user_id";
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        eq: mockEq2.mockReturnValueOnce({
                            maybeSingle: mockMaybeSingle.mockResolvedValueOnce({
                                data: null, error: { message: "error" }
                            })
                        })
                    })
                })
            })

            await expect(getAttendee(eventId, userId)).rejects.toThrow("Failed to check if user user_id is registered for event event_id")
        })

    })
})

