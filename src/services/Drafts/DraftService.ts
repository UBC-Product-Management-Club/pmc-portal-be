import { DraftRepository } from '../../storage/DraftRepository';
import {TablesInsert} from "../../schema/v2/database.types";

type Draft = TablesInsert<"Drafts">
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export class DraftService {
    async loadDraft(eventId: string, userId: string): Promise<Record<string, JsonValue> | null> {
        try {
            const { data, error } = await DraftRepository.findByUserAndEvent(userId, eventId);

            if (error) {
                console.error('DraftService: Error loading draft:', error);
                throw new Error('Failed to load draft');
            }

            if (!data) {
                return null;
            }

            return data.draft_data as Record<string, JsonValue>;

        } catch (error) {
            console.error('DraftService: Error loading draft:', error);
            throw new Error('Failed to load draft');
        }
    }

    async saveDraft(
        eventId: string,
        userId: string,
        draftData: Record<string, JsonValue>
    ): Promise<Draft> {
        try {
            // Validate draft data
            if (!draftData || typeof draftData !== 'object' || Array.isArray(draftData)) {
                console.error('DraftService: Invalid draft data');
                throw new Error('Invalid draft data');
            }

            const { data, error } = await DraftRepository.upsert({
                user_id: userId,
                event_id: eventId,
                draft_data: draftData,
            });

            if (error) {
                console.error('DraftService: Error saving draft:', error);
                throw new Error('Failed to save draft');
            }

            return {
                user_id: data.user_id,
                event_id: data.event_id,
                draft_data: data.draft_data,
            };
        } catch (error) {
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