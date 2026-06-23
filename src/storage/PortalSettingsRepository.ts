import { supabase } from "../config/supabase";
import { Tables, TablesUpdate } from "../schema/v2/database.types";

type PortalSettingsRow = Tables<"Portal_Settings">;
type PortalSettingsUpdate = TablesUpdate<"Portal_Settings">;

export const PortalSettingsRepository = {
  getSettings: () =>
    supabase.from("Portal_Settings").select("*").limit(1).maybeSingle(),

  updateSettings: (id: string, updates: PortalSettingsUpdate) =>
    supabase
      .from("Portal_Settings")
      .update(updates)
      .eq("id", id)
      .select()
      .single(),
};

export type { PortalSettingsRow };
