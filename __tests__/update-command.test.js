/**
 * Update Command Tests
 */

import { jest } from "@jest/globals";

// Mock dependencies
const mockSpawn = jest.fn();
const mockLoadConfig = jest.fn();
const mockFetchStories = jest.fn();
const mockGenerateTestFiles = jest.fn();
const mockCleanupTestFiles = jest.fn();
const mockReadFailuresFromJsonl = jest.fn();

jest.unstable_mockModule("child_process", () => ({
  spawn: mockSpawn,
}));

jest.unstable_mockModule("../config-loader.js", () => ({
  loadConfig: mockLoadConfig,
}));

jest.unstable_mockModule("../lib/story-discovery.js", () => ({
  fetchStoriesFromStorybook: mockFetchStories,
  sanitizeSnapshotName: (id) => id.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
}));

jest.unstable_mockModule("../lib/test-runner-utils.js", () => ({
  generateTestFiles: mockGenerateTestFiles,
  cleanupTestFiles: mockCleanupTestFiles,
}));

jest.unstable_mockModule("../lib/result-processor.js", () => ({
  readFailuresFromJsonl: mockReadFailuresFromJsonl,
  parseFailures: jest.fn(),
  readIgnoredFromJsonl: jest.fn(),
}));

describe("Update Command - Locale Mode", () => {
  let updateCommand;
  let mockYargs;
  let commandHandler;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Import the module after mocks are set up
    const module = await import("../cli/commands/update.js");
    updateCommand = module.updateCommand;

    // Create mock yargs
    mockYargs = {
      command: jest.fn((name, description, builder, handler) => {
        commandHandler = handler;
        return mockYargs;
      }),
      option: jest.fn(() => mockYargs),
      example: jest.fn(() => mockYargs),
    };

    // Setup default mocks
    mockGenerateTestFiles.mockReturnValue({
      dataFile: "/tmp/data.json",
      specFile: "/tmp/spec.js",
    });

    mockFetchStories.mockResolvedValue([
      { id: "button--default", name: "Default" },
    ]);

    // Mock spawn to simulate successful execution
    const mockProcess = {
      on: jest.fn((event, callback) => {
        if (event === "exit") {
          setTimeout(() => callback(0), 10);
        }
      }),
    };
    mockSpawn.mockReturnValue(mockProcess);
  });

  describe("All Locales Mode", () => {
    it("should detect --locale without value as all locales mode", async () => {
      const mockConfig = {
        snapshot: {
          locale: {
            locales: [
              { code: "en-US", name: "English" },
              { code: "de-DE", name: "German" },
            ],
          },
        },
        paths: {
          snapshotsDir: "__visual_snapshots__",
          playwrightConfig: "playwright.config.js",
        },
        playwrightConfig: {},
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      // Register the command
      updateCommand(mockYargs);

      // Execute with --locale as boolean
      const argv = {
        locale: true, // Boolean indicates no value provided
        config: "visual-tests.config.js",
        mobile: false,
      };

      await commandHandler(argv);

      // Should load config twice (once for initial check, once per locale)
      expect(mockLoadConfig).toHaveBeenCalledTimes(3);

      // Should call runUpdate for each locale
      expect(mockFetchStories).toHaveBeenCalledTimes(2);
    });

    it("should validate that locales are configured", async () => {
      const mockConfig = {
        snapshot: {
          locale: {
            locales: [], // Empty locales array
          },
        },
        paths: {},
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      // Mock process.exit
      const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {});

      updateCommand(mockYargs);

      const argv = {
        locale: true,
        config: "visual-tests.config.js",
        mobile: false,
      };

      await commandHandler(argv);

      // Should exit with error
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it("should iterate through all configured locales", async () => {
      const mockConfig = {
        snapshot: {
          locale: {
            locales: [
              { code: "en-US", name: "English" },
              { code: "de-DE", name: "German" },
              { code: "ar-SA", name: "Arabic", direction: "rtl" },
            ],
          },
        },
        paths: {
          snapshotsDir: "__visual_snapshots__",
          playwrightConfig: "playwright.config.js",
        },
        playwrightConfig: {},
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      updateCommand(mockYargs);

      const argv = {
        locale: true,
        config: "visual-tests.config.js",
        mobile: false,
      };

      await commandHandler(argv);

      // Should load config 4 times (1 initial + 3 locales)
      expect(mockLoadConfig).toHaveBeenCalledTimes(4);

      // Verify each locale was loaded
      expect(mockLoadConfig).toHaveBeenCalledWith(
        expect.objectContaining({ locale: "en-US" }),
      );
      expect(mockLoadConfig).toHaveBeenCalledWith(
        expect.objectContaining({ locale: "de-DE" }),
      );
      expect(mockLoadConfig).toHaveBeenCalledWith(
        expect.objectContaining({ locale: "ar-SA" }),
      );
    });

    it("should handle failures in locale updates", async () => {
      const mockConfig = {
        snapshot: {
          locale: {
            locales: [
              { code: "en-US", name: "English" },
              { code: "de-DE", name: "German" },
            ],
          },
        },
        paths: {
          snapshotsDir: "__visual_snapshots__",
          playwrightConfig: "playwright.config.js",
        },
        playwrightConfig: {},
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      // Mock spawn to fail on second locale
      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        return {
          on: jest.fn((event, callback) => {
            if (event === "exit") {
              // First locale succeeds, second fails
              setTimeout(() => callback(callCount === 1 ? 0 : 1), 10);
            }
          }),
        };
      });

      const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {});

      updateCommand(mockYargs);

      const argv = {
        locale: true,
        config: "visual-tests.config.js",
        mobile: false,
      };

      await commandHandler(argv);

      // Should exit with error code 1
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });

  describe("Single Locale Mode", () => {
    it("should handle --locale with specific value", async () => {
      const mockConfig = {
        snapshot: {
          locale: {
            locales: [
              { code: "en-US", name: "English" },
              { code: "de-DE", name: "German" },
            ],
          },
        },
        paths: {
          snapshotsDir: "__visual_snapshots__",
          playwrightConfig: "playwright.config.js",
        },
        playwrightConfig: {},
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      updateCommand(mockYargs);

      const argv = {
        locale: "de-DE", // String value
        config: "visual-tests.config.js",
        mobile: false,
      };

      await commandHandler(argv);

      // Should load config once with the specific locale
      expect(mockLoadConfig).toHaveBeenCalledTimes(1);
      expect(mockLoadConfig).toHaveBeenCalledWith(
        expect.objectContaining({ locale: "de-DE" }),
      );

      // Should fetch stories once
      expect(mockFetchStories).toHaveBeenCalledTimes(1);
    });
  });

  describe("No Locale Mode", () => {
    it("should handle update without locale flag", async () => {
      const mockConfig = {
        snapshot: {},
        paths: {
          snapshotsDir: "__visual_snapshots__",
          playwrightConfig: "playwright.config.js",
        },
        playwrightConfig: {},
      };

      mockLoadConfig.mockResolvedValue(mockConfig);

      updateCommand(mockYargs);

      const argv = {
        // No locale property
        config: "visual-tests.config.js",
        mobile: false,
      };

      await commandHandler(argv);

      // Should load config once without locale
      expect(mockLoadConfig).toHaveBeenCalledTimes(1);
      expect(mockLoadConfig).toHaveBeenCalledWith(
        expect.objectContaining({ locale: undefined }),
      );
    });
  });
});
