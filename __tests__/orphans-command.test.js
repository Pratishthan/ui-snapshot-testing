/**
 * Orphans Command Tests
 */

import { jest } from "@jest/globals";
import path from "path";

// Mock dependencies
const mockLoadConfig = jest.fn();
const mockFetchStories = jest.fn();
const mockSanitizeSnapshotName = jest.fn((id, viewport) => {
  let name = id;
  if (viewport && viewport.width && viewport.height) {
    name = `${id}-${viewport.width}x${viewport.height}`;
  }
  return name;
});

const mockFs = {
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  unlinkSync: jest.fn(),
};

const mockEnquirer = {
  prompt: jest.fn(),
};

jest.unstable_mockModule("fs", () => ({
  default: mockFs,
  existsSync: mockFs.existsSync,
  readdirSync: mockFs.readdirSync,
  unlinkSync: mockFs.unlinkSync,
}));

jest.unstable_mockModule("enquirer", () => ({
  default: mockEnquirer,
}));

jest.unstable_mockModule("../config-loader.js", () => ({
  loadConfig: mockLoadConfig,
}));

jest.unstable_mockModule("../lib/story-discovery.js", () => ({
  fetchStoriesFromStorybook: mockFetchStories,
  sanitizeSnapshotName: mockSanitizeSnapshotName,
}));

describe("Orphans Command", () => {
  let orphansCommand;
  let mockYargs;
  let commandHandler;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await import("../cli/commands/orphans.js");
    orphansCommand = module.orphansCommand;

    mockYargs = {
      command: jest.fn((name, description, builder, handler) => {
        commandHandler = handler;
        return mockYargs;
      }),
      option: jest.fn(() => mockYargs),
      example: jest.fn(() => mockYargs),
    };

    // Default fs mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([]); // Empty directory by default
    mockFs.unlinkSync.mockImplementation(() => {});

    // Default enquirer mock
    mockEnquirer.prompt.mockResolvedValue({ confirm: false });
  });

  it("should check desktop snapshots by default", async () => {
    const mockConfig = {
      snapshot: {
        paths: { snapshotsDir: "__visual_snapshots__" },
        image: { enabled: true },
        position: { enabled: true },
      },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);

    // Storybook returns one story
    mockFetchStories.mockResolvedValue([{ id: "story1" }]);

    // Filesystem has orphaned file
    mockFs.readdirSync.mockReturnValue([
      "story1.png", // Valid
      "story1.positions.json", // Valid
      "orphan.png", // Orphan
    ]);

    orphansCommand(mockYargs);
    const argv = { config: "config.js" };
    await commandHandler(argv);

    const snapshotsDir = path.join(process.cwd(), "__visual_snapshots__");
    expect(mockFs.readdirSync).toHaveBeenCalledWith(snapshotsDir);

    // Should assume default viewport from valid config (mockLoadConfig should provide it)
    // We didn't provide mockConfig.playwright.use.viewport, so it falls back to undefined?
    // In our implementation, we check config.playwright?.use?.viewport.
    // If undefined, sanitizeSnapshotName is called with undefined, so "story1".
  });

  it("should use playwright viewport for desktop if configured", async () => {
    const mockConfig = {
      snapshot: {
        paths: { snapshotsDir: "__visual_snapshots__" },
        image: { enabled: true },
        position: { enabled: true },
        // Simulate what happens in config-loader defaults
      },
      playwright: {
        use: { viewport: { width: 1280, height: 720 } },
      },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);

    mockFetchStories.mockResolvedValue([{ id: "story1" }]);
    mockFs.readdirSync.mockReturnValue(["story1-1280x720.png"]); // Matches expected

    orphansCommand(mockYargs);
    const argv = { config: "config.js" };

    // Verify usage of console.log
    // We need to spy on console.log if not already handled
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await commandHandler(argv);

    // Verify sanitizeSnapshotName called with viewport
    expect(mockSanitizeSnapshotName).toHaveBeenCalledWith("story1", {
      width: 1280,
      height: 720,
    });
    // Should find NO orphans
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("No orphaned snapshots found"),
    );

    logSpy.mockRestore();
  });

  it("should check mobile snapshots with viewports", async () => {
    const mockConfig = {
      snapshot: {
        paths: { snapshotsDir: "__visual_snapshots__" },
        mobile: {
          enabled: true,
          viewports: [{ width: 375, height: 667 }],
        },
        image: { enabled: true },
      },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockFetchStories.mockResolvedValue([{ id: "story1" }]);

    // Mobile directory
    const mobileDir = path.join(
      process.cwd(),
      "__visual_snapshots__",
      "mobile",
    );
    mockFs.readdirSync.mockReturnValue(["story1-375x667.png"]); // Valid

    orphansCommand(mockYargs);
    const argv = { config: "config.js", mobile: true };
    await commandHandler(argv);

    expect(mockFs.readdirSync).toHaveBeenCalledWith(mobileDir);
    expect(mockSanitizeSnapshotName).toHaveBeenCalledWith("story1", {
      width: 375,
      height: 667,
    });
  });

  it("should check locales correctly (flat structure)", async () => {
    const mockConfig = {
      snapshot: {
        paths: { snapshotsDir: "__visual_snapshots__" },
        locale: { code: "de-DE" },
        image: { enabled: true },
      },
      locale: { code: "de-DE" },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockFetchStories.mockResolvedValue([{ id: "story1" }]);

    // Locale directory
    const localeDir = path.join(process.cwd(), "__visual_snapshots__", "de-DE");
    mockFs.readdirSync.mockReturnValue(["story1.png"]);

    orphansCommand(mockYargs);
    const argv = { config: "config.js", locale: "de-DE" };
    await commandHandler(argv);

    expect(mockFs.readdirSync).toHaveBeenCalledWith(localeDir);
  });

  it("should check --all modes including mobile and locales", async () => {
    const mockBaseConfig = {
      snapshot: {
        paths: { snapshotsDir: "__visual_snapshots__" },
        mobile: { enabled: true, viewports: [{ width: 375, height: 667 }] },
        locale: { enabled: true, locales: [{ code: "de-DE", default: false }] },
      },
    };

    const mockMobileConfig = {
      ...mockBaseConfig,
      activeViewport: { width: 375, height: 667 },
    };
    const mockLocaleConfig = { ...mockBaseConfig, locale: { code: "de-DE" } };

    mockLoadConfig
      .mockResolvedValueOnce(mockBaseConfig) // Initial load
      .mockResolvedValueOnce(mockBaseConfig) // Desktop check config load? No, it reuses?
      .mockResolvedValue(mockBaseConfig); // Fallback

    // Actually the implementation calls loadConfig multiple times
    // We can use mockImplementation to return based on args
    mockLoadConfig.mockImplementation(async (opts) => {
      if (opts.mobile) return mockMobileConfig;
      if (opts.locale) return mockLocaleConfig;
      return mockBaseConfig;
    });

    mockFetchStories.mockResolvedValue([{ id: "story1" }]);
    mockFs.readdirSync.mockReturnValue([]);

    orphansCommand(mockYargs);
    const argv = { config: "config.js", all: true };
    await commandHandler(argv);

    const snapshotsDir = path.join(process.cwd(), "__visual_snapshots__");
    const mobileDir = path.join(snapshotsDir, "mobile");
    const localeDir = path.join(snapshotsDir, "de-DE");

    expect(mockFs.readdirSync).toHaveBeenCalledWith(snapshotsDir);
    expect(mockFs.readdirSync).toHaveBeenCalledWith(mobileDir);
    expect(mockFs.readdirSync).toHaveBeenCalledWith(localeDir);

    // Ensure NO nested mobile/locale check
    // Jest doesn't easily negate "any call with substring", but we can check calls
    const calls = mockFs.readdirSync.mock.calls.map((c) => c[0]);
    const hasNested = calls.some(
      (p) => p.includes("mobile/de-DE") || p.includes("de-DE/mobile"),
    );
    expect(hasNested).toBe(false);
  });

  it("should delete orphans when requested and confirmed", async () => {
    const mockConfig = {
      snapshot: {
        paths: { snapshotsDir: "__visual_snapshots__" },
        image: { enabled: true },
      },
    };
    mockLoadConfig.mockResolvedValue(mockConfig);
    mockFetchStories.mockResolvedValue([{ id: "story1" }]);

    const snapshotsDir = path.join(process.cwd(), "__visual_snapshots__");
    mockFs.readdirSync.mockReturnValue(["story1.png", "orphan.png"]);

    mockEnquirer.prompt.mockResolvedValue({ confirm: true });

    orphansCommand(mockYargs);
    const argv = { config: "config.js", delete: true };
    await commandHandler(argv);

    expect(mockFs.unlinkSync).toHaveBeenCalledWith(
      path.join(snapshotsDir, "orphan.png"),
    );
    expect(mockFs.unlinkSync).not.toHaveBeenCalledWith(
      path.join(snapshotsDir, "story1.png"),
    );
  });
});
