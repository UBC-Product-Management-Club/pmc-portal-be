import { Request, Response, Router } from "express";
import { getPortalSettings } from "../../services/PortalSettings/PortalSettingsService";

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
