import { z } from "zod/v4";

export const PORTAL_SETTING_KEYS = ["construction_mode_enabled"] as const;

export type PortalSettingKey = (typeof PORTAL_SETTING_KEYS)[number];

export const PortalSettingKeySchema = z.enum(PORTAL_SETTING_KEYS);

export const PortalSettingsUpdateSchema = z
  .object({
    construction_mode_enabled: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one setting must be provided",
  });

export type PortalSettingsUpdate = z.infer<typeof PortalSettingsUpdateSchema>;
