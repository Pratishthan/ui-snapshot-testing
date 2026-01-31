# Playwright Integration Example

This example shows how to integrate the visual testing library with Playwright.

## Setup

### 1. Install Dependencies

```bash
npm install --save-dev @playwright/test
npm install --save-dev @pratishthan/snapshot-testing
```

### 2. Create Playwright Config

Create `playwright.config.ts` in your project root:

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright",

  // Snapshot configuration
  snapshotDir: "./playwright/__visual_snapshots__",
  snapshotPathTemplate: "{snapshotDir}/{testFileDir}/{arg}{ext}",

  // Test configuration
  fullyParallel: false, // Run visual tests sequentially for consistency
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for visual tests

  // Reporter configuration
  reporter: [["html", { outputFolder: "playwright-report" }], ["list"]],

  // Shared settings for all tests
  use: {
    baseURL: "http://localhost:6006",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  // Configure projects for different scenarios
  projects: [
    {
      name: "visual-tests",
      testMatch: "**/visual-tests.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Optionally start Storybook before tests
  webServer: {
    command: "npm run storybook",
    url: "http://localhost:6006",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

### 3. Create Visual Test File

Create `playwright/visual-tests.spec.ts`:

```typescript
import { loadConfig } from "@pratishthan/snapshot-testing/config";
import { generateVisualTests } from "@pratishthan/snapshot-testing/playwright";

// Load configuration
const config = await loadConfig({
  mode: "full", // or 'lite'
  storybook: {
    port: "6006",
    host: "localhost",
  },
});

// Generate visual tests
await generateVisualTests({ config });
```

### 4. Create Configuration File (Optional)

Create `visual-tests.config.js` in your project root:

```javascript
export default {
  mode: "full",

  storybook: {
    port: "6006",
    host: "localhost",
  },

  filters: {
    keywords: ["Default", "Error", "Long"],
    exclusions: ["no-visual"],
    includePaths: [], // e.g., ['components/Button']
  },

  snapshot: {
    maxDiffPixelRatio: 0.01,
    maxDiffPixels: 100,
    threshold: 0.2,
  },

  positionTracking: {
    enabled: true,
    orderCheck: true,
    positionThreshold: 5,
    sizeThreshold: 5,
  },

  maskSelectors: ['[data-testid="timeElapsed"]', '[data-testid="bsqDate"]'],

  errorHandling: {
    ignorePatterns: ["closed", "timeout"],
  },
};
```

## Running Tests

### Run All Visual Tests

```bash
npx playwright test --project=visual-tests
```

### Update Snapshots

```bash
npx playwright test --project=visual-tests --update-snapshots
```

### Run in UI Mode

```bash
npx playwright test --project=visual-tests --ui
```

### Run Specific Story

```bash
STORY_IDS=button--default npx playwright test --project=visual-tests
```

### Run in Lite Mode

```bash
VISUAL_TEST_MODE=lite npx playwright test --project=visual-tests
```

## Advanced Usage

### Custom Test File with Hooks

```typescript
import { test } from "@playwright/test";
import { loadConfig } from "@pratishthan/snapshot-testing/config";
import { generateVisualTests } from "@pratishthan/snapshot-testing/playwright";

const config = await loadConfig();

await generateVisualTests({
  config,

  // Custom hooks
  beforeAll: async () => {
    console.log("Starting visual tests...");
  },

  afterAll: async () => {
    console.log("Visual tests complete!");
  },

  beforeEach: async ({ page }) => {
    // Set viewport or other page settings
    await page.setViewportSize({ width: 1280, height: 720 });
  },

  afterEach: async ({ page }) => {
    // Cleanup if needed
  },
});
```

### Filter Stories Programmatically

```typescript
import { generateVisualTestsWithFilter } from "@pratishthan/snapshot-testing/playwright";

await generateVisualTestsWithFilter({
  config,
  storyFilter: (story) => {
    // Only test Button component stories
    return story.importPath.includes("components/Button");
  },
});
```

### Test Specific Stories

```typescript
import { generateVisualTestsForStories } from "@pratishthan/snapshot-testing/playwright";

await generateVisualTestsForStories({
  config,
  storyIds: ["button--default", "button--loading", "input--default"],
});
```

### Custom Target Selector

```typescript
await generateVisualTests({
  config,
  targetSelector: "#root", // Default is '#storybook-root'
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Visual Tests

on: [push, pull_request]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run visual tests
        run: npx playwright test --project=visual-tests

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Troubleshooting

### Storybook Not Ready

If tests fail because Storybook isn't ready:

1. Increase `webServer.timeout` in `playwright.config.ts`
2. Add a warmup script before tests
3. Check Storybook is accessible at the configured URL

### Snapshot Mismatches

If you get unexpected snapshot mismatches:

1. Check if dynamic content needs masking
2. Verify viewport size is consistent
3. Review `maxDiffPixelRatio` and `threshold` settings
4. Run tests with `--update-snapshots` to regenerate

### Position Tracking Failures

If position tracking reports false positives:

1. Disable position tracking: `ENABLE_POSITION_TRACKING=false`
2. Disable only order check: `ENABLE_ORDER_CHECK=false`
3. Adjust thresholds in config

## Best Practices

1. **Run sequentially**: Set `workers: 1` for consistent results
2. **Mask dynamic content**: Add selectors to `maskSelectors` config
3. **Use lite mode in CI**: Faster feedback with `VISUAL_TEST_MODE=lite`
4. **Version snapshots**: Commit snapshots to version control
5. **Review failures**: Use HTML report to review visual changes
6. **Update incrementally**: Use interactive update for selective changes
