import { loadConfig, getConfigValue } from "../config-loader.js";
import {
  DEFAULT_STORYBOOK_PORT,
  DEFAULT_ENABLE_IMAGE_SNAPSHOTS,
} from "../visual-test-config.js";

describe("Config Loader", () => {
  describe("loadConfig", () => {
    test("returns default config when no options provided", async () => {
      const config = await loadConfig();
      expect(config.storybook.port).toBe(DEFAULT_STORYBOOK_PORT);
      expect(config.snapshot.image.enabled).toBe(
        DEFAULT_ENABLE_IMAGE_SNAPSHOTS,
      );
    });

    test("overrides defaults with matching options", async () => {
      const config = await loadConfig({
        storybook: { port: 9009 },
      });
      expect(config.storybook.port).toBe(9009);
    });

    test("normalizes boolean values", async () => {
      const config = await loadConfig({
        snapshot: {
          image: { enabled: "false" },
        },
      });
      expect(config.snapshot.image.enabled).toBe(false);
    });
  });

  describe("getConfigValue", () => {
    const config = {
      nested: {
        deep: {
          val: 123,
        },
      },
    };

    test("retrieves nested value", () => {
      expect(getConfigValue(config, "nested.deep.val")).toBe(123);
    });

    test("returns default if not found", () => {
      expect(getConfigValue(config, "nested.missing", "default")).toBe(
        "default",
      );
    });
  });
});
