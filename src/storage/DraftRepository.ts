// repositories/DraftRepository.ts
import { supabase } from "../config/supabase";
import { Tables } from "../schema/v2/database.types";

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

  upsert: (draft: DraftInsert) =>
    supabase
      .from("Drafts")
      .upsert(draft, {
        onConflict: "user_id,event_id",
      })
      .select()
      .single(),

  delete: (userId: string, eventId: string) =>
    supabase
      .from("Drafts")
      .delete()
      .eq("user_id", userId)
      .eq("event_id", eventId),
};