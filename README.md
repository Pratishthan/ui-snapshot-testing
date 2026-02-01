# Snapshot Testing

> Visual regression testing library for Storybook with Playwright, featuring position tracking and diff-based testing

[![npm version](https://img.shields.io/npm/v/ui-snapshot-testing.svg)](https://www.npmjs.com/package/ui-snapshot-testing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

✨ **Smart Story Discovery** - Automatically finds stories matching visual criteria  
📸 **Snapshot Comparison** - Pixel-perfect visual regression detection  
📍 **Position Tracking** - Detects element position changes (unique feature!)  
🔄 **Diff-Based Testing** - Only test stories affected by your changes  
🎯 **Flexible Filtering** - Filter by keywords, paths, or story IDs  
📱 **Mobile Snapshots** - Test responsive designs with mobile viewports  
🌍 **Locale Snapshots** - Test internationalized UIs across different languages/regions

🛠️ **CLI & Programmatic API** - Use however you prefer
📊 **Rich Reports** - HTML reports with side-by-side comparisons  
🔧 **Highly Configurable** - Config files, env vars, or programmatic options

## Quick Start

### Installation

```bash
npm install --save-dev ui-snapshot-testing
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
npx ui-snapshot-testing run
```

3. **View results:**

```bash
npx ui-snapshot-testing report
```

## CLI Commands

### `run` - Execute Visual Tests

```bash
# Run visual tests
npx ui-snapshot-testing run



# Run specific component
npx ui-snapshot-testing run --include-paths components/Button

# Update snapshots
npx ui-snapshot-testing run --update-snapshots
```

**Options:**

- `--storybook-port, -p` - Storybook port (default: 6006)
- `--include-paths, -i` - Path segments to include
- `--story-ids` - Specific story IDs to test
- `--update-snapshots, -u` - Update snapshots
- `--mobile` - Run in mobile mode with mobile viewports
- `--locale <code>` - Run in locale mode with specified locale (e.g., de, ar)
- `--config, -c` - Path to config file

### `update` - Update Snapshots

```bash
# Update all snapshots
npx ui-snapshot-testing update

# Update only missing snapshots
npx ui-snapshot-testing update --incremental

# Interactively select which to update
npx ui-snapshot-testing update --interactive

# Update specific stories
npx ui-snapshot-testing update --story-ids button--default,input--error
```

**Options:**

- `--incremental` - Only update missing snapshots
- `--interactive, -i` - Interactive selection
- `--story-ids` - Specific stories to update
- `--mobile` - Update mobile snapshots
- `--locale <code>` - Update locale snapshots for specified locale
- `--config, -c` - Path to config file

### `diff` - Test Changed Stories

```bash
# Test stories changed since Sprint16 (default)
npx ui-snapshot-testing diff

# Compare against different branch
npx ui-snapshot-testing diff --target-branch main

```

**Options:**

- `--target-branch, -t` - Target branch for comparison
- `--config, -c` - Path to config file

### `report` - View Reports

```bash
# Open HTML report
npx ui-snapshot-testing report

# Generate and open report
npx ui-snapshot-testing report --generate

# View JSON report
npx ui-snapshot-testing report --format json
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

| Setting                 | Type  | Description                            | Effect of Varying Numbers                                                                                                             |
| ----------------------- | ----- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **`maxDiffPixelRatio`** | `0-1` | Max allowed ratio of different pixels. | **Increase (e.g., 0.05):** More tolerant of widespread changes.<br>**Decrease (e.g., 0.001):** Stricter; fails on small area changes. |

| **`threshold`** | `0-1` | Color comparison sensitivity (YIQ). | **Increase (e.g., 0.5):** Looser color matching (ignores anti-aliasing).<br>**Decrease (e.g., 0.1):** Stricter color matching. |

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

### Mobile Snapshots

Test responsive designs with mobile viewports:

```javascript
export default {
  snapshot: {
    mobile: {
      enabled: true,
      // Optional: Only test stories with 'visual-mobile' tag in mobile mode
      testMatcher: {
        tags: ["visual-mobile"],
      },
      viewports: [
        { width: 375, height: 667, name: "iPhone SE" },
        { width: 390, height: 844, name: "iPhone 12/13" },
      ],
    },
  },
};
```

**Usage:**

```bash
# Run mobile tests
npx ui-snapshot-testing run --mobile

# Update mobile snapshots
npx ui-snapshot-testing update --mobile
```

### Locale Snapshots

Test internationalized UIs across different languages and regions:

```javascript
export default {
  snapshot: {
    locale: {
      enabled: true,
      // Optional: Only test stories with 'visual-locale' tag in locale mode
      testMatcher: {
        tags: ["visual-locale"],
      },
      locales: [
        { code: "en", name: "English" },
        { code: "de", name: "German" },
        { code: "ar", name: "Arabic", direction: "rtl" },
      ],
      // Storybook global parameter name
      storybookGlobalParam: "locale",
    },
  },
};
```

**Usage:**

```bash
# Run tests for German locale
npx ui-snapshot-testing run --locale de

# Update Arabic locale snapshots
npx ui-snapshot-testing update --locale ar

# Test RTL layouts
npx ui-snapshot-testing run --locale ar
```

**Storybook Setup:**

```javascript
// .storybook/preview.js
export const globalTypes = {
  locale: {
    name: "Locale",
    defaultValue: "en",
    toolbar: {
      icon: "globe",
      items: [
        { value: "en", title: "English" },
        { value: "de", title: "German" },
        { value: "ar", title: "Arabic" },
      ],
    },
  },
};

export const decorators = [
  (Story, context) => {
    i18n.changeLanguage(context.globals.locale);
    return <Story />;
  },
];
```

See [Usage Guide](./examples/usage.md) for detailed mobile and locale snapshot documentation.

## Programmatic API

```javascript
import {
  loadConfig,
  fetchStoriesFromStorybook,
  generateHtmlReport,
} from "ui-snapshot-testing";

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
import { loadConfig } from "ui-snapshot-testing/config";
import { generateVisualTests } from "ui-snapshot-testing/playwright";

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
import { generateVisualTests } from "ui-snapshot-testing/playwright";

await generateVisualTests({
  config,
  beforeEach: async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  },
});
```

**Filter stories programmatically:**

```typescript
import { generateVisualTestsWithFilter } from "ui-snapshot-testing/playwright";

await generateVisualTestsWithFilter({
  config,
  storyFilter: (story) => story.importPath.includes("components/Button"),
});
```

**Test specific stories:**

```typescript
import { generateVisualTestsForStories } from "ui-snapshot-testing/playwright";

await generateVisualTestsForStories({
  config,
  storyIds: ["button--default", "button--loading"],
});
```

**Custom masking:**

```typescript
import { maskElements } from "ui-snapshot-testing/playwright";

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
npx ui-snapshot-testing diff

# In CI/CD - use config file with different target branch
npx ui-snapshot-testing diff --target-branch main
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
npx ui-snapshot-testing run --storybook-port 6007
```

### Snapshots not found

```bash
# Generate initial snapshots
npx ui-snapshot-testing run --update-snapshots

# Or incrementally
npx ui-snapshot-testing update --incremental
```

### Too many failures

```bash
# Use lite mode for faster iteration
npx ui-snapshot-testing run --mode lite

# Or test specific component
npx ui-snapshot-testing run --include-paths components/Button
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
