import { DraftService } from '../../../src/services/Drafts/DraftService';
import { DraftRepository } from '../../../src/storage/DraftRepository';
import { ApiError } from '../../../src/services/ApiError';

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
        const mockDraftData = { q1: 'Answer 1', q2: 'Answer 2' };

        it('returns the draft and its version', async () => {
            (DraftRepository.findByUserAndEvent as jest.Mock).mockResolvedValueOnce({
                data: { user_id: userId, event_id: eventId, draft_data: mockDraftData, version: 3 },
                error: null
            });

            const result = await draftService.loadDraft(eventId, userId);

            expect(result).toEqual({ draft: mockDraftData, version: 3 });
            expect(DraftRepository.findByUserAndEvent).toHaveBeenCalledWith(userId, eventId);
        });

        it('returns null when no draft found', async () => {
            (DraftRepository.findByUserAndEvent as jest.Mock).mockResolvedValueOnce({ data: null, error: null });

            await expect(draftService.loadDraft(eventId, userId)).resolves.toBeNull();
        });

        it('throws error when repository returns error', async () => {
            (DraftRepository.findByUserAndEvent as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: { message: 'Database error' }
            });

            await expect(draftService.loadDraft(eventId, userId)).rejects.toThrow('Failed to load draft');
        });

        it('throws error when repository throws exception', async () => {
            (DraftRepository.findByUserAndEvent as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

            await expect(draftService.loadDraft(eventId, userId)).rejects.toThrow('Failed to load draft');
        });
    });

    describe('saveDraft', () => {
        const userId = 'user123';
        const eventId = 'event456';
        const draftData = { q1: 'Answer 1', q2: 'Answer 2' };
        const row = (version: number, draft: object = draftData) =>
            ({ user_id: userId, event_id: eventId, draft_data: draft, version });

        it('saves on top of the version the client loaded', async () => {
            (DraftRepository.updateIfVersion as jest.Mock).mockResolvedValueOnce({ data: row(3), error: null });

            await expect(draftService.saveDraft(eventId, userId, draftData, 2)).resolves.toEqual({ draft: draftData, version: 3 });
            expect(DraftRepository.updateIfVersion).toHaveBeenCalledWith(userId, eventId, draftData, 2);
            expect(DraftRepository.insert).not.toHaveBeenCalled();
        });

        it('creates the first draft at version 1', async () => {
            (DraftRepository.updateIfVersion as jest.Mock).mockResolvedValueOnce({ data: null, error: null });
            (DraftRepository.insert as jest.Mock).mockResolvedValueOnce({ data: row(1), error: null });

            await expect(draftService.saveDraft(eventId, userId, draftData, 0)).resolves.toEqual({ draft: draftData, version: 1 });
            expect(DraftRepository.insert).toHaveBeenCalledWith({ user_id: userId, event_id: eventId, draft_data: draftData, version: 1 });
        });

        it('refuses a save from an out-of-date tab and returns the server copy', async () => {
            (DraftRepository.updateIfVersion as jest.Mock).mockResolvedValueOnce({ data: null, error: null });
            (DraftRepository.findByUserAndEvent as jest.Mock).mockResolvedValueOnce({ data: row(4, { q1: 'Other tab' }), error: null });

            const error = await draftService.saveDraft(eventId, userId, draftData, 2).catch((e) => e);
            expect(error).toBeInstanceOf(ApiError);
            expect(error).toMatchObject({
                status: 409,
                code: 'STALE_DRAFT',
                extra: { draft: { q1: 'Other tab' }, version: 4 },
            });
        });

        it('treats a first save that loses the race to another tab as stale', async () => {
            (DraftRepository.updateIfVersion as jest.Mock).mockResolvedValueOnce({ data: null, error: null });
            (DraftRepository.insert as jest.Mock).mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate key' } });
            (DraftRepository.findByUserAndEvent as jest.Mock).mockResolvedValueOnce({ data: row(1, { q1: 'Other tab' }), error: null });

            const error = await draftService.saveDraft(eventId, userId, draftData, 0).catch((e) => e);
            expect(error).toMatchObject({ code: 'STALE_DRAFT', extra: { version: 1 } });
        });

        it('saves over the current version when the client sends none', async () => {
            (DraftRepository.findByUserAndEvent as jest.Mock).mockResolvedValueOnce({ data: row(5), error: null });
            (DraftRepository.updateIfVersion as jest.Mock).mockResolvedValueOnce({ data: row(6), error: null });

            await expect(draftService.saveDraft(eventId, userId, draftData)).resolves.toEqual({ draft: draftData, version: 6 });
            expect(DraftRepository.updateIfVersion).toHaveBeenCalledWith(userId, eventId, draftData, 5);
        });

        it.each([null, undefined, 'not an object', []])('rejects draft data %p', async (bad) => {
            await expect(draftService.saveDraft(eventId, userId, bad as any)).rejects.toThrow('Failed to save draft');
            expect(DraftRepository.updateIfVersion).not.toHaveBeenCalled();
        });

        it('hides database errors behind a generic one', async () => {
            (DraftRepository.updateIfVersion as jest.Mock).mockResolvedValueOnce({ data: null, error: { message: 'Database error' } });

            await expect(draftService.saveDraft(eventId, userId, draftData, 1)).rejects.toThrow('Failed to save draft');
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