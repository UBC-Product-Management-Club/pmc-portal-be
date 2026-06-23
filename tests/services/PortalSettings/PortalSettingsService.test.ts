import {
  getPortalSettings,
  updateConstructionMode,
} from "../../../src/services/PortalSettings/PortalSettingsService";
import { PortalSettingsRepository } from "../../../src/storage/PortalSettingsRepository";

jest.mock("../../../src/storage/PortalSettingsRepository");

describe("PortalSettingsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getPortalSettings", () => {
    it("returns settings when found", async () => {
      (PortalSettingsRepository.getSettings as jest.Mock).mockResolvedValueOnce({
        data: {
          id: "settings-id",
          construction_mode_enabled: true,
          updated_at: "2025-01-01T00:00:00.000Z",
        },
      });

      const result = await getPortalSettings();

      expect(result).toEqual({ construction_mode_enabled: true });
    });

    it("returns disabled when no settings row exists", async () => {
      (PortalSettingsRepository.getSettings as jest.Mock).mockResolvedValueOnce({
        data: null,
      });

      const result = await getPortalSettings();

      expect(result).toEqual({ construction_mode_enabled: false });
    });

    it("throws when repository returns an error", async () => {
      (PortalSettingsRepository.getSettings as jest.Mock).mockResolvedValueOnce({
        error: { message: "DB Down" },
      });

      await expect(getPortalSettings()).rejects.toThrow(
        "Failed to fetch portal settings: DB Down"
      );
    });
  });

  describe("updateConstructionMode", () => {
    it("updates and returns settings", async () => {
      (PortalSettingsRepository.getSettings as jest.Mock).mockResolvedValueOnce({
        data: {
          id: "settings-id",
          construction_mode_enabled: true,
          updated_at: "2025-01-01T00:00:00.000Z",
        },
      });
      (PortalSettingsRepository.updateSettings as jest.Mock).mockResolvedValueOnce({
        data: {
          id: "settings-id",
          construction_mode_enabled: false,
          updated_at: "2025-06-01T00:00:00.000Z",
        },
      });

      const result = await updateConstructionMode(false);

      expect(result).toEqual({ construction_mode_enabled: false });
      expect(PortalSettingsRepository.updateSettings).toHaveBeenCalledWith(
        "settings-id",
        expect.objectContaining({ construction_mode_enabled: false })
      );
    });

    it("throws when settings are not initialized", async () => {
      (PortalSettingsRepository.getSettings as jest.Mock).mockResolvedValueOnce({
        data: null,
      });

      await expect(updateConstructionMode(true)).rejects.toThrow(
        "Portal settings not initialized"
      );
    });
  });
});
