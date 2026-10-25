// repositories/DraftRepository.ts
import { supabase } from "../config/supabase";

type DraftInsert = {
  user_id: string;
  event_id: string;
  draft_data: Record<string, any>;
};

export const DraftRepository = {
  findByUserAndEvent: (userId: string, eventId: string) =>
    supabase
      .from("Drafts")
      .select("*")
      .eq("user_id", userId)
      .eq("event_id", eventId)
      .maybeSingle(),

  // The first save of a draft; fails with 23505 if another tab saved one first
  insert: (draft: DraftInsert & { version: number }) =>
    supabase.from("Drafts").insert(draft).select().single(),

  // Saves only if the draft is still at the version the client loaded; no row back means it moved on
  updateIfVersion: (userId: string, eventId: string, draftData: Record<string, any>, version: number) =>
    supabase
      .from("Drafts")
      .update({ draft_data: draftData, version: version + 1 })
      .eq("user_id", userId)
      .eq("event_id", eventId)
      .eq("version", version)
      .select()
      .maybeSingle(),

  delete: (userId: string, eventId: string) =>
    supabase
      .from("Drafts")
      .delete()
      .eq("user_id", userId)
      .eq("event_id", eventId),
};