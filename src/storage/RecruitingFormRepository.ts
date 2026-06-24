import { supabase } from "../config/supabase";
import { RecruitingFormInsert } from "../schema/v2/RecruitingForm";

export const RecruitingFormRepository = {
  createForm: (form: RecruitingFormInsert) =>
    supabase.from("Recruiting").insert(form).select().single(),
  getFormById: (id: string) =>
    supabase.from("Recruiting").select("*").eq("recruiting_id", id).maybeSingle(),
  listForms: () =>
    supabase.from("Recruiting").select("*").order("created_at", { ascending: false }),
};
