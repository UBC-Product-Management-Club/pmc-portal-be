import {
  PortalSettingsRepository,
  PortalSettingsRow,
} from "../../storage/PortalSettingsRepository";
import { PortalSettingsUpdate } from "../../schema/v2/PortalSettings";

export type PortalSettingsResponse = {
  construction_mode_enabled: boolean;
};

const toResponse = (settings: PortalSettingsRow): PortalSettingsResponse => ({
  construction_mode_enabled: settings.construction_mode_enabled,
});

export const getPortalSettings =
  async (): Promise<PortalSettingsResponse> => {
    const { data, error } = await PortalSettingsRepository.getSettings();

    if (error) {
      throw new Error(`Failed to fetch portal settings: ${error.message}`);
    }

    if (!data) {
      return { construction_mode_enabled: false };
    }

    return toResponse(data);
  };

export const updatePortalSettings = async (
  updates: PortalSettingsUpdate
): Promise<PortalSettingsResponse> => {
  const { data: existing, error: fetchError } =
    await PortalSettingsRepository.getSettings();

  if (fetchError) {
    throw new Error(`Failed to fetch portal settings: ${fetchError.message}`);
  }

  if (!existing) {
    throw new Error("Portal settings not initialized");
  }

  const { data, error } = await PortalSettingsRepository.updateSettings(
    existing.id,
    {
      ...updates,
      updated_at: new Date().toISOString(),
    }
  );

  if (error || !data) {
    throw new Error(
      `Failed to update portal settings: ${error?.message ?? "Unknown error"}`
    );
  }

  return toResponse(data);
};
