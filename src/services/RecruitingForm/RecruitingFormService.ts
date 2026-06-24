import { Tables } from "../../schema/v2/database.types";
import { RecruitingFormInsert } from "../../schema/v2/RecruitingForm";
import { RecruitingFormRepository } from "../../storage/RecruitingFormRepository";

type RecruitingFormRow = Tables<"Recruiting">;

export const createForm = async (form: RecruitingFormInsert) => {
  const { data, error } = await RecruitingFormRepository.createForm(form);
  if (error) throw new Error(error.message);
  return data;
};

export const getFormById = async (
  id: string
): Promise<RecruitingFormRow | null> => {
  const { data, error } = await RecruitingFormRepository.getFormById(id);
  if (error) throw new Error(error.message);
  return data;
};

export const listForms = async () => {
  const { data, error } = await RecruitingFormRepository.listForms();
  if (error) throw new Error(error.message);
  return data;
};
