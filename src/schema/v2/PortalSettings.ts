import { z } from "zod/v4";

export const PortalSettingsUpdateSchema = z.object({
  construction_mode_enabled: z.boolean(),
});
