/**
 * Visual Tests Configuration
 *
 * This file configures the visual testing library.
 * It is the single source of truth for test matching, snapshot settings, and paths.
 */

export default {
  // Test matching configuration
  testMatcher: {
    // Match stories with 'visual' tag
    tags: ["visual"],
    // Optional: Match stories with suffixes (e.g. _visual, _default)
    suffix: ["_visual", "_default"],
  },

  // Snapshot type configuration
  snapshot: {
    // Image comparison settings
    image: {
      // Optional: Override global testMatcher for image snapshots
      // testMatcher: { tags: ['visual-image'] },

      // Enable image snapshots
      enabled: true,

      /**
       * Max Ratio of Different Pixels (0-1)
       * - What it does: Sets the maximum allowed percentage of pixels that can differ.
       * - Increase (e.g., 0.05): More tolerant of widespread changes across the image.
       * - Decrease (e.g., 0.001): Stricter, fails even if a small area changes.
       */
      maxDiffPixelRatio: 0.01,

      /**
       * Max Number of Different Pixels
       * - What it does: Sets the absolute limit on the number of differing pixels.
       * - Increase (e.g., 500): Tolerates small artifacts or tiny layout shifts (e.g., 1px border shift).
       * - Decrease (e.g., 0): Zero tolerance for any pixel difference.
       */
      maxDiffPixels: 100,

      /**
       * Color Threshold (0-1)
       * - What it does: Sensitivity of pixel-to-pixel color comparison (YIQ difference).
       * - Increase (e.g., 0.5): Comparison becomes looser; colors must be very different to count as a mismatch (ignoring anti-aliasing).
       * - Decrease (e.g., 0.1): Stricter; slight color variations (e.g., rendering differences) will be flagged.
       */
      threshold: 0.2,
    },

    // JSON position tracking settings
    position: {
      // Optional: Override global testMatcher for position snapshots
      // testMatcher: { tags: ['visual-layout'] },

      // Enable position tracking
      enabled: process.env.ENABLE_POSITION_TRACKING !== "false",

      // Enable order checking
      orderCheck: process.env.ENABLE_ORDER_CHECK !== "false",

      // Position threshold (pixels)
      positionThreshold: parseInt(process.env.POSITION_THRESHOLD || "5", 10),

      // Size threshold (pixels)
      sizeThreshold: parseInt(process.env.SIZE_THRESHOLD || "5", 10),
    },
  },

  // Storybook configuration
  storybook: {
    port: process.env.STORYBOOK_PORT || "6006",
    host: process.env.STORYBOOK_HOST || "localhost",
  },

  // Story filtering
  filters: {
    // Exclusion patterns (no-visual)
    exclusions: process.env.STORY_VISUAL_EXCLUSIONS?.split(",") || [
      "no-visual",
    ],

    // Include paths filter
    includePaths: process.env.STORY_INCLUDE_PATHS?.split(",") || [],

    // Specific story IDs
    storyIds: process.env.STORY_IDS?.split(",") || [],
  },

  // Paths configuration
  paths: {
    // Snapshot directory
    snapshotsDir: "playwright/storybook-visual/__visual_snapshots__",

    // Logs directory
    logsDir: "logs",

    // Results file
    resultsFile: "logs/visual-test-results.json",

    // Failures file
    failuresFile: "logs/visual-test-failures.jsonl",

    // HTML report
    htmlReport: "logs/visual-test-report.html",

    // Log file
    logFile: "logs/storybook-visual-results.log",

    // Screenshots directory
    screenshotsDir: "logs/screenshots",

    // Library paths (These point to the installed library in node_modules)
    playwrightConfig: "node_modules/snapshot-testing/playwright.config.js",
    testSpec: "node_modules/snapshot-testing/visual-tests.spec.js",
  },

  // Diff-based testing
  diff: {
    // Target branch for comparison
    targetBranch: process.env.VISUAL_TESTS_TARGET_BRANCH || "main",
  },

  // Error handling
  errorHandling: {
    // Patterns to ignore (timeout, closed)
    ignorePatterns: process.env.IGNORE_ERROR_PATTERNS?.split(",") || [
      "timeout",
      "closed",
    ],

    // CI mode
    ci: process.env.CI === "1",
  },

  // Playwright test execution configuration
  playwrightConfig: {
    // Test execution settings
    fullyParallel: true,
    workers: process.env.CI ? 4 : 6,
    retries: 0,
    forbidOnly: !!process.env.CI,

    // Timeout configuration (milliseconds)
    timeout: 30000, // 30 seconds per test
    expect: {
      timeout: 5000,
    },

    // Reporter configuration
    reporter: [
      [
        "html",
        { outputFolder: "logs/playwright/storybook/reports", open: "never" },
      ],
      ["list"],
      [
        "json",
        { outputFile: "logs/playwright/storybook/reports/results.json" },
      ],
    ],

    // Browser and viewport settings
    use: {
      trace: "off",
      screenshot: "only-on-failure",
      video: "retain-on-failure",
      viewport: { width: 800, height: 600 },
      ignoreHTTPSErrors: true,
    },

    // Projects configuration (browsers to test)
    projects: [
      {
        name: "chromium",
        // Device settings can be customized here
        // use: { ...devices['Desktop Chrome'] }
      },
      // Uncomment to test on multiple browsers:
      // {
      //   name: 'firefox',
      //   use: { ...devices['Desktop Firefox'] }
      // },
      // {
      //   name: 'webkit',
      //   use: { ...devices['Desktop Safari'] }
      // },
    ],
  },

  // Storybook server configuration
  storybookConfig: {
    // Command to start Storybook (set to null to disable auto-start)
    command: "npm run storybook",

    // Timeout for Storybook to start (milliseconds)
    timeout: 120000, // 2 minutes

    // Reuse existing server (useful for development)
    reuseExistingServer: true,
  },

  // Playwright masking configuration
  playwright: {
    // Masking configuration
    masking: {
      // Selectors to mask (hide dynamic content)
      selectors: ['[data-testid="timeElapsed"]', '[data-testid="bsqDate"]'],
    },
  },
};
