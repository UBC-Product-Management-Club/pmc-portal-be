import { DraftService } from '../../../src/services/Drafts/DraftService';
import { DraftRepository } from '../../../src/storage/DraftRepository';

// Mock the DraftRepository
jest.mock('../../../src/storage/DraftRepository');

describe('DraftService', () => {
  let draftService: DraftService;

    beforeEach(() => {
        jest.clearAllMocks();
        draftService = new DraftService();
    });

    describe('loadDraft', () => {
        const userId = 'user123';
        const eventId = 'event456';
        const mockDraftData = {
            q1: 'Answer 1',
            q2: 'Answer 2',
            q3: 'Answer 3'
        };

        it('returns draft data successfully', async () => {
            const mockResponse = {
                user_id: userId,
                event_id: eventId,
                draft_data: mockDraftData
            };

            (DraftRepository.findByUserAndEvent as jest.Mock).mockResolvedValueOnce({
                data: mockResponse,
                error: null
            });

            const result = await draftService.loadDraft(eventId, userId);

            expect(result).toEqual(mockDraftData);
            expect(DraftRepository.findByUserAndEvent).toHaveBeenCalledWith(userId, eventId);
        });

        it('returns null when no draft found', async () => {
            (DraftRepository.findByUserAndEvent as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: null
            });

            const result = await draftService.loadDraft(eventId, userId);

            expect(result).toBeNull();
            expect(DraftRepository.findByUserAndEvent).toHaveBeenCalledWith(userId, eventId);
        });

        it('throws error when repository returns error', async () => {
            (DraftRepository.findByUserAndEvent as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: { message: 'Database error' }
            });

            await expect(draftService.loadDraft(eventId, userId))
                .rejects
                .toThrow('Failed to load draft');

            expect(DraftRepository.findByUserAndEvent).toHaveBeenCalledWith(userId, eventId);
        });

        it('throws error when repository throws exception', async () => {
            (DraftRepository.findByUserAndEvent as jest.Mock).mockRejectedValueOnce(
                new Error('Connection failed')
            );

            await expect(draftService.loadDraft(eventId, userId))
                .rejects
                .toThrow('Failed to load draft');
            });
        });

    describe('saveDraft', () => {
        const userId = 'user123';
        const eventId = 'event456';
        const draftData = {
            q1: 'Answer 1',
            q2: 'Answer 2',
            q3: 'Answer 3'
        };

        it('saves draft successfully', async () => {
            const mockResponse = {
                user_id: userId,
                event_id: eventId,
                draft_data: draftData
            };

            (DraftRepository.upsert as jest.Mock).mockResolvedValueOnce({
                data: mockResponse,
                error: null
            });

            const result = await draftService.saveDraft(eventId, userId, draftData);

            expect(result).toEqual({
                user_id: userId,
                event_id: eventId,
                draft_data: draftData
            });
            expect(DraftRepository.upsert).toHaveBeenCalledWith({
                user_id: userId,
                event_id: eventId,
                draft_data: draftData
            });
        });

        it('throws error when draft data is null', async () => {
            await expect(draftService.saveDraft(eventId, userId, null as any))
                .rejects
                .toThrow('Failed to save draft');

            expect(DraftRepository.upsert).not.toHaveBeenCalled();
        });

        it('throws error when draft data is undefined', async () => {
            await expect(draftService.saveDraft(eventId, userId, undefined as any))
                .rejects
                .toThrow('Failed to save draft');

            expect(DraftRepository.upsert).not.toHaveBeenCalled();
        });

        it('throws error when draft data is not an object', async () => {
            await expect(draftService.saveDraft(eventId, userId, 'not an object' as any))
                .rejects
                .toThrow('Failed to save draft');

            expect(DraftRepository.upsert).not.toHaveBeenCalled();
        });

        it('throws error when draft data is an array', async () => {
            await expect(draftService.saveDraft(eventId, userId, [] as any))
                .rejects
                .toThrow('Failed to save draft');

            expect(DraftRepository.upsert).not.toHaveBeenCalled();
        });

        it('throws error when repository returns error', async () => {
            (DraftRepository.upsert as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: { message: 'Database error' }
        });

            await expect(draftService.saveDraft(eventId, userId, draftData))
                .rejects
                .toThrow('Failed to save draft');

            expect(DraftRepository.upsert).toHaveBeenCalledWith({
                user_id: userId,
                event_id: eventId,
                draft_data: draftData
            });
        });

        it('throws error when repository throws exception', async () => {
            (DraftRepository.upsert as jest.Mock).mockRejectedValueOnce(
                new Error('Connection failed')
            );

            await expect(draftService.saveDraft(eventId, userId, draftData))
                .rejects
                .toThrow('Failed to save draft');
        });

        it('saves draft with empty object', async () => {
            const emptyDraft = {};
            const mockResponse = {
                user_id: userId,
                event_id: eventId,
                draft_data: emptyDraft
            };

            (DraftRepository.upsert as jest.Mock).mockResolvedValueOnce({
                data: mockResponse,
                error: null
            });

            const result = await draftService.saveDraft(eventId, userId, emptyDraft);

            expect(result).toEqual({
                user_id: userId,
                event_id: eventId,
                draft_data: emptyDraft
            });
        });
    });

    describe('deleteDraft', () => {
        const userId = 'user123';
        const eventId = 'event456';

        it('deletes draft successfully', async () => {
            (DraftRepository.delete as jest.Mock).mockResolvedValueOnce({
                error: null
            });

            await expect(draftService.deleteDraft(eventId, userId))
                .resolves
                .toBeUndefined();

            expect(DraftRepository.delete).toHaveBeenCalledWith(userId, eventId);
        });

        it('throws error when repository returns error', async () => {
            (DraftRepository.delete as jest.Mock).mockResolvedValueOnce({
                error: { message: 'Database error' }
            });

            await expect(draftService.deleteDraft(eventId, userId))
                .rejects
                .toThrow('Failed to delete draft');

            expect(DraftRepository.delete).toHaveBeenCalledWith(userId, eventId);
        });

        it('throws error when repository throws exception', async () => {
            (DraftRepository.delete as jest.Mock).mockRejectedValueOnce(
                new Error('Connection failed')
            );

            await expect(draftService.deleteDraft(eventId, userId))
                .rejects
                .toThrow('Failed to delete draft');
        });
    });
});