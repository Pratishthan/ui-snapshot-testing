# Snapshot Testing

> Visual regression testing library for Storybook with Playwright, featuring position tracking and diff-based testing

[![npm version](https://img.shields.io/npm/v/snapshot-testing.svg)](https://www.npmjs.com/package/snapshot-testing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

✨ **Smart Story Discovery** - Automatically finds stories matching visual criteria  
📸 **Snapshot Comparison** - Pixel-perfect visual regression detection  
📍 **Position Tracking** - Detects element position changes (unique feature!)  
🔄 **Diff-Based Testing** - Only test stories affected by your changes  
🎯 **Flexible Filtering** - Filter by keywords, paths, or story IDs

🛠️ **CLI & Programmatic API** - Use however you prefer
📊 **Rich Reports** - HTML reports with side-by-side comparisons  
🔧 **Highly Configurable** - Config files, env vars, or programmatic options

## Quick Start

### Installation

```bash
npm install --save-dev snapshot-testing
```

### Prerequisites

- Node.js >= 18
- Storybook project
- Playwright installed (`@playwright/test`)

### Basic Usage

1. **Start your Storybook:**

```bash
npm run storybook
```

2. **Run visual tests:**

```bash
npx snapshot-testing run
```

3. **View results:**

```bash
npx snapshot-testing report
```

## CLI Commands

### `run` - Execute Visual Tests

```bash
# Run visual tests
npx snapshot-testing run



# Run specific component
npx snapshot-testing run --include-paths components/Button

# Update snapshots
npx snapshot-testing run --update-snapshots
```

**Options:**

- `--storybook-port, -p` - Storybook port (default: 6006)

- `--include-paths, -i` - Path segments to include
- `--story-ids` - Specific story IDs to test
- `--update-snapshots, -u` - Update snapshots
- `--config, -c` - Path to config file

### `update` - Update Snapshots

```bash
# Update all snapshots
npx snapshot-testing update

# Update only missing snapshots
npx snapshot-testing update --incremental

# Interactively select which to update
npx snapshot-testing update --interactive

# Update specific stories
npx snapshot-testing update --story-ids button--default,input--error
```

**Options:**

- `--incremental` - Only update missing snapshots
- `--interactive, -i` - Interactive selection
- `--story-ids` - Specific stories to update
- `--config, -c` - Path to config file

### `diff` - Test Changed Stories

```bash
# Test stories changed since Sprint16 (default)
npx snapshot-testing diff

# Compare against different branch
npx snapshot-testing diff --target-branch main

```

**Options:**

- `--target-branch, -t` - Target branch for comparison
- `--config, -c` - Path to config file

### `report` - View Reports

```bash
# Open HTML report
npx snapshot-testing report

# Generate and open report
npx snapshot-testing report --generate

# View JSON report
npx snapshot-testing report --format json
```

**Options:**

- `--open, -o` - Open in browser (default: true)
- `--format, -f` - Report format: `html`, `json`, or `both`
- `--generate, -g` - Generate new report
- `--config, -c` - Path to config file

## Configuration

### Config File

Create `visual-tests.config.js` in your project root. You can copy the [default configuration template](./examples/visual-tests.config.js).

```javascript
export default {
  // Test matching configuration
  testMatcher: {
    // Match stories with 'visual' tag
    tags: ["visual"],
    // Optional: Match stories with suffixes (e.g. _visual, _default)
    suffix: ["_visual", "_default"],
  },

  storybook: {
    port: process.env.STORYBOOK_PORT || "6006",
    host: process.env.STORYBOOK_HOST || "localhost",
  },
  filters: {
    exclusions: ["no-visual"],
  },
  paths: {
    snapshotsDir: "playwright/storybook-visual/__visual_snapshots__",
    logsDir: "logs",
  },
  errorHandling: {
    ignorePatterns: ["timeout", "closed"],
  },

  snapshot: {
    image: {
      // Optional: Specific matcher for image snapshots
      testMatcher: { tags: ["visual-image"] },
    },
    position: {
      enabled: true,
      orderCheck: true,
      // Optional: Specific matcher for layout tracking
      testMatcher: { tags: ["visual-layout"] },
    },
  },
  positionTracking: {
    // specific settings for position tracking
    // ...
  },
};
```

### Image Comparison Settings

Fine-tune the sensitivity of visual tests in `visual-tests.config.js`:

| Setting                 | Type     | Description                              | Effect of Varying Numbers                                                                                                             |
| ----------------------- | -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **`maxDiffPixelRatio`** | `0-1`    | Max allowed ratio of different pixels.   | **Increase (e.g., 0.05):** More tolerant of widespread changes.<br>**Decrease (e.g., 0.001):** Stricter; fails on small area changes. |
| **`maxDiffPixels`**     | `number` | Max absolute number of differing pixels. | **Increase (e.g., 500):** Tolerates small artifacts or tiny layout shifts.<br>**Decrease (e.g., 0):** Zero tolerance.                 |
| **`threshold`**         | `0-1`    | Color comparison sensitivity (YIQ).      | **Increase (e.g., 0.5):** Looser color matching (ignores anti-aliasing).<br>**Decrease (e.g., 0.1):** Stricter color matching.        |

```javascript
export default {
  snapshot: {
    image: {
      maxDiffPixelRatio: 0.01,
      maxDiffPixels: 100,
      threshold: 0.2,
    },
  },
  // ... other config
};
```

## Programmatic API

```javascript
import {
  loadConfig,
  fetchStoriesFromStorybook,
  generateHtmlReport,
} from "snapshot-testing";

// Load configuration
const config = await loadConfig({
  mode: "lite",
  storybook: { port: "6006" },
});

// Fetch stories
const stories = await fetchStoriesFromStorybook(config);
console.log(`Found ${stories.length} stories`);

// Generate report
const results = {
  totalStories: 100,
  failures: [],
  passed: [],
  ignored: [],
  skipped: [],
};

await generateHtmlReport(results, config);
```

## Playwright Integration

### Setup

1. **Create Playwright config** (`playwright.config.ts`):

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright",
  snapshotDir: "./playwright/__visual_snapshots__",
  workers: 1, // Single worker for visual consistency

  use: {
    baseURL: "http://localhost:6006",
  },

  projects: [
    {
      name: "visual-tests",
      testMatch: "**/visual-tests.spec.ts",
    },
  ],

  webServer: {
    command: "npm run storybook",
    url: "http://localhost:6006",
    reuseExistingServer: !process.env.CI,
  },
});
```

2. **Create test file** (`playwright/visual-tests.spec.ts`):

```typescript
import { loadConfig } from "snapshot-testing/config";
import { generateVisualTests } from "snapshot-testing/playwright";

const config = await loadConfig();
await generateVisualTests({ config });
```

3. **Run tests:**

```bash
npx playwright test --project=visual-tests
```

### Advanced Playwright Usage

**With custom hooks:**

```typescript
import { generateVisualTests } from "snapshot-testing/playwright";

await generateVisualTests({
  config,
  beforeEach: async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  },
});
```

**Filter stories programmatically:**

```typescript
import { generateVisualTestsWithFilter } from "snapshot-testing/playwright";

await generateVisualTestsWithFilter({
  config,
  storyFilter: (story) => story.importPath.includes("components/Button"),
});
```

**Test specific stories:**

```typescript
import { generateVisualTestsForStories } from "snapshot-testing/playwright";

await generateVisualTestsForStories({
  config,
  storyIds: ["button--default", "button--loading"],
});
```

**Custom masking:**

```typescript
import { maskElements } from "snapshot-testing/playwright";

await generateVisualTests({
  config: {
    ...config,
    maskSelectors: ['[data-testid="timeElapsed"]', '[data-testid="randomId"]'],
  },
});
```

See [Playwright Integration Example](./examples/playwright-integration/) for complete setup guide.

## Position Tracking

Unique feature that detects element position changes:

```javascript
// Automatically tracks all elements with data-testid
<div data-testid="header">Header</div>
<div data-testid="content">Content</div>
```

**What it catches:**

- Element order changes
- Missing/added elements
- Layout shifts

**Configuration:**

```javascript
{
  positionTracking: {
    enabled: true,
    orderCheck: true,
    positionThreshold: 5, // pixels
    sizeThreshold: 5,     // pixels
  }
}
```

## Diff-Based Testing

Only test stories affected by your changes:

```bash
# Test stories changed since Sprint16
npx snapshot-testing diff

# In CI/CD - use config file with different target branch
npx snapshot-testing diff --target-branch main
```

**How it works:**

1. Analyzes git diff between branches
2. Identifies changed story files
3. Maps component changes to story files
4. Runs tests only for affected stories

## Reports

### HTML Report

Side-by-side comparison with:

- Reference vs actual screenshots
- Position diff tables
- Error messages
- Story metadata

### JSON Report

Machine-readable format with:

- All test results
- Failure details
- Timestamps
- File paths

## Best Practices

### 1. Naming Conventions

```javascript
// Lite mode - explicit visual stories
export const Default_visual = () => <Component />;

// Full mode - keyword matching
export const Default = () => <Component />;
export const Error = () => <Component error />;
export const Loading = () => <Component loading />;
```

### 2. Exclude Non-Visual Stories

```javascript
// Exclude from visual tests
export const InteractiveDemo_no_visual = () => <Component />;
```

### 3. Use Position Tracking

```javascript
// Add data-testid for position tracking
<div data-testid="header">
  <div data-testid="logo">Logo</div>
  <div data-testid="nav">Navigation</div>
</div>
```

### 4. CI/CD Integration

```yaml
# GitHub Actions example
- name: Run Visual Tests
  run: |
    npm run storybook &
    npx wait-on http://localhost:6006
    npx snapshot-testing diff --target-branch ${{ github.base_ref }}
```

## Troubleshooting

### Storybook not running

```bash
# Make sure Storybook is running
npm run storybook

# Or specify custom port
npx snapshot-testing run --storybook-port 6007
```

### Snapshots not found

```bash
# Generate initial snapshots
npx snapshot-testing run --update-snapshots

# Or incrementally
npx snapshot-testing update --incremental
```

### Too many failures

```bash
# Use lite mode for faster iteration
npx snapshot-testing run --mode lite

# Or test specific component
npx snapshot-testing run --include-paths components/Button
```

## Migration Guide

Migrating from existing setup? See [MIGRATION.md](./MIGRATION.md)

## API Documentation

Full API documentation: [API.md](./API.md)

## Examples

- [Usage Guide](./examples/usage.md)
- [Configuration Template](./examples/visual-tests.config.js)
- [Playwright Integration](./examples/playwright-integration/)

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT © Pratishthan

## Support

- 📖 [Documentation](https://github.com/pratishthan/snapshot-testing)
- 🐛 [Issue Tracker](https://github.com/pratishthan/snapshot-testing/issues)
- 💬 [Discussions](https://github.com/pratishthan/snapshot-testing/discussions)
