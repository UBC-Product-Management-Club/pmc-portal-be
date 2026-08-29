import { Request, Response, Router } from "express";
import { PortalSettingKeySchema } from "../../schema/v2/PortalSettings";
import {
  getPortalSetting,
  getPortalSettings,
} from "../../services/PortalSettings/PortalSettingsService";

export const settingsRouter = Router();

settingsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const settings = await getPortalSettings();
    return res.status(200).json(settings);
  } catch (error: any) {
    console.error("Get portal settings error:", error);
    return res.status(500).json({ error: error.message });
  }
});

settingsRouter.get("/:key", async (req: Request, res: Response) => {
  const parsed = PortalSettingKeySchema.safeParse(req.params.key);

  if (!parsed.success) {
    return res.status(400).json({ error: "Unknown portal setting key" });
  }

  try {
    const setting = await getPortalSetting(parsed.data);
    return res.status(200).json(setting);
  } catch (error: any) {
    console.error("Get portal setting error:", error);
    return res.status(500).json({ error: error.message });
  }
});
