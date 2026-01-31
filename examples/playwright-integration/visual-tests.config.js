/**
 * Visual Tests Configuration
 *
 * This file configures the visual testing library.
 * All settings can be overridden via environment variables.
 */

export default {
  // Test mode: 'lite' (only _visual stories) or 'full' (keyword matching)
  mode: "full",

  // Snapshot type configuration
  snapshot: {
    // Type of snapshots to use: 'image', 'json', or 'both'
    type: "both",

    // Image comparison settings
    image: {
      // Maximum ratio of different pixels (0-1)
      maxDiffPixelRatio: 0.01,

      // Maximum number of different pixels
      maxDiffPixels: 100,

      // Threshold for pixel comparison (0-1)
      threshold: 0.2,
    },

    // JSON position tracking settings
    position: {
      // Enable position tracking
      enabled: true,

      // Check element order
      orderCheck: true,

      // Position difference threshold (pixels)
      positionThreshold: 5,

      // Size difference threshold (pixels)
      sizeThreshold: 5,
    },
  },

  // Storybook server configuration
  storybook: {
    port: "6006",
    host: "localhost",
  },

  // Story filtering
  filters: {
    // Keywords to match in story names (full mode only)
    keywords: ["Default", "Error", "Long"],

    // Patterns to exclude
    exclusions: ["no-visual"],

    // Include only stories from specific paths
    // Example: ['components/Button', 'components/Input']
    includePaths: [],

    // Test only specific story IDs
    // Example: ['button--default', 'input--error']
    storyIds: [],
  },

  // Paths configuration (usually don't need to change these)
  paths: {
    logs: "./logs",
    snapshots: "./playwright/__visual_snapshots__",
    screenshots: "./logs/screenshots",
  },

  // Error handling
  errorHandling: {
    // Error message patterns to ignore (won't fail tests)
    // Note: Snapshot mismatches are NEVER ignored
    ignorePatterns: ["closed", "timeout"],
  },

  // Playwright test execution configuration
  playwrightConfig: {
    // Test execution settings
    fullyParallel: false, // Run visual tests sequentially for consistency
    workers: 1, // Single worker for visual consistency
    retries: process.env.CI ? 2 : 0,
    forbidOnly: !!process.env.CI,

    // Timeout configuration (milliseconds)
    timeout: 30000, // 30 seconds per test
    expect: {
      timeout: 5000,
    },

    // Reporter configuration
    reporter: [
      ["html", { outputFolder: "playwright-report" }],
      ["list"],
      ["json", { outputFile: "playwright-report/results.json" }],
    ],

    // Browser and viewport settings
    use: {
      trace: "on-first-retry",
      screenshot: "only-on-failure",
      video: "retain-on-failure",
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    },

    // Projects configuration (browsers to test)
    projects: [
      {
        name: "visual-tests",
        // Device settings can be customized here
        // use: { ...devices['Desktop Chrome'] }
      },
      // Uncomment to test on multiple browsers:
      // {
      //   name: 'visual-tests-firefox',
      //   use: { ...devices['Desktop Firefox'] }
      // },
      // {
      //   name: 'visual-tests-webkit',
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
    reuseExistingServer: !process.env.CI,
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
