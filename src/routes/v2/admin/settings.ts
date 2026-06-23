import { Request, Response, Router } from "express";
import { PortalSettingsUpdateSchema } from "../../../schema/v2/PortalSettings";
import { updateConstructionMode } from "../../../services/PortalSettings/PortalSettingsService";

export const settingsRouter = Router();

settingsRouter.patch("/", async (req: Request, res: Response) => {
  const parsed = PortalSettingsUpdateSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }

  try {
    const settings = await updateConstructionMode(
      parsed.data.construction_mode_enabled
    );
    return res.status(200).json(settings);
  } catch (error: any) {
    console.error("Update portal settings error:", error);
    return res.status(500).json({ error: error.message });
  }
});
