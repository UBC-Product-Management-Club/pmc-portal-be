import { DraftRepository } from '../../storage/DraftRepository';
import { ApiError } from '../ApiError';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

// A draft and its version. Each save adds one to the version, and a save that
// builds on an older version is refused, so two tabs never overwrite each other.
export type SavedDraft = { draft: Record<string, JsonValue>; version: number };

const UNIQUE_VIOLATION = '23505';

export class DraftService {
    async loadDraft(eventId: string, userId: string): Promise<SavedDraft | null> {
        try {
            const { data, error } = await DraftRepository.findByUserAndEvent(userId, eventId);

            if (error) {
                console.error('DraftService: Error loading draft:', error);
                throw new Error('Failed to load draft');
            }

            if (!data) {
                return null;
            }

            return { draft: data.draft_data as Record<string, JsonValue>, version: data.version };

        } catch (error) {
            console.error('DraftService: Error loading draft:', error);
            throw new Error('Failed to load draft');
        }
    }

    // version is the one the client loaded. Older clients send none and save
    // over whatever is there.
    async saveDraft(
        eventId: string,
        userId: string,
        draftData: Record<string, JsonValue>,
        version?: number
    ): Promise<SavedDraft> {
        try {
            // Validate draft data
            if (!draftData || typeof draftData !== 'object' || Array.isArray(draftData)) {
                console.error('DraftService: Invalid draft data');
                throw new Error('Invalid draft data');
            }

            const expected = version ?? (await this.loadDraft(eventId, userId))?.version ?? 0;

            const updated = await DraftRepository.updateIfVersion(userId, eventId, draftData, expected);
            if (updated.error) throw updated.error;
            if (updated.data) return { draft: draftData, version: updated.data.version };

            // Nothing at that version: either there's no draft yet, or another tab saved first
            if (expected === 0) {
                const inserted = await DraftRepository.insert({
                    user_id: userId,
                    event_id: eventId,
                    draft_data: draftData,
                    version: 1,
                });
                if (!inserted.error) return { draft: draftData, version: inserted.data.version };
                if (inserted.error.code !== UNIQUE_VIOLATION) throw inserted.error;
            }

            const current = await this.loadDraft(eventId, userId);
            throw new ApiError(409, 'STALE_DRAFT', 'This application was changed in another tab.', undefined, {
                draft: current?.draft ?? null,
                version: current?.version ?? 0,
            });
        } catch (error) {
            if (error instanceof ApiError) throw error;
            console.error('DraftService: Error saving draft:', error);
            throw new Error('Failed to save draft');
        }
    }

    async deleteDraft(eventId: string, userId: string): Promise<void> {

        try {
            const { error } = await DraftRepository.delete(userId, eventId);

        if (error) {
            console.error('DraftService: Error deleting draft:', error);
            throw new Error('Failed to delete draft');
        }

        } catch (error) {
            console.error('DraftService: Error deleting draft:', error);
            throw new Error('Failed to delete draft');
        }
    }
}
