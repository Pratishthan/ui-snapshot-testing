# Visual Testing Library Usage Guide

This guide covers how to use the `@pratishthan/snapshot-testing` library, from basic CLI usage to advanced programmatic integration.

## Table of Contents

- [CLI Usage](#cli-usage) (Recommended)
  - [Setup](#setup)
  - [Running Tests](#running-tests)
- [Programmatic Usage](#programmatic-usage) (Advanced)
  - [Custom Scripts](#custom-scripts)
- [Story Configuration](#story-configuration)
- [Advanced Topics](../docs/advanced-guide.md) (Masking, Position Tracking, Troubleshooting)

---

## CLI Usage

The simplest way to use the library is via the Command Line Interface (CLI).

### Setup

1. **Install the library:**

   ```bash
   npm install --save-dev @pratishthan/snapshot-testing
   ```

2. **Configure (Optional but Recommended):**

   Create `visual-tests.config.js` in your project root. [See template](./visual-tests.config.js).

3. **Ensure Storybook is running:**

   ```bash
   npm run storybook
   ```

### Running Tests

| Action                      | Command                                                        |
| :-------------------------- | :------------------------------------------------------------- |
| **Run All Tests**           | `npx snapshot-testing run`                                     |
| **Update Snapshots**        | `npx snapshot-testing update --interactive`                    |
| **Test Specific Component** | `npx snapshot-testing run --include-paths "components/Button"` |
| **Test Changed Stories**    | `npx snapshot-testing diff`                                    |
| **View Report**             | `npx snapshot-testing report`                                  |

---

## Programmatic Usage

For complex workflows, you can import library functions directly into your Node.js scripts.

### Installation

```bash
npm install --save-dev @pratishthan/snapshot-testing
```

### Example Script (`scripts/run-visual-tests.js`)

```javascript
import {
  loadConfig,
  fetchStoriesFromStorybook,
  generateHtmlReport,
  categorizeFailures,
} from "@pratishthan/snapshot-testing";

async function main() {
  // 1. Load configuration
  const config = await loadConfig({
    // Override defaults
    storybook: { port: "6006" },
  });

  // 2. Fetch stories from Storybook
  const stories = await fetchStoriesFromStorybook(config);
  console.log(`found ${stories.length} stories.`);

  // 3. execute tests (pseudo-code)
  // Note: Actual test execution usually happens via Playwright test runner
  // See 'examples/playwright-integration' for full test runner setup.

  // 4. Generate Report (if you have results)
  const results = {
    totalStories: stories.length,
    failures: [], // Populate with actual failures
    passed: stories.map((s) => s.id),
    ignored: [],
    skipped: [],
  };

  const reportPath = await generateHtmlReport(results, config);
  console.log(`📊 Report generated: ${reportPath}`);
}

main().catch(console.error);
```

Run with: `node scripts/run-visual-tests.js`

---

## Story Configuration

Control which stories are tested using `testMatcher` configuration.

### Tag-Based Matching (Recommended)

Add tags to your stories in Storybook (Storybook 7+).

```javascript
// Button.stories.tsx
export default {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs", "visual"], // Add 'visual' tag
};

export const Default = () => <Button>Click me</Button>;
```

### Configuration

Configure how stories are found in `visual-tests.config.js`:

```javascript
export default {
  testMatcher: {
    tags: ["visual"], // Match stories with this tag
    suffix: ["_visual"], // Optional: Match by suffix
  },
};
```

### Granular Control (New)

You can fine-tune matching in `visual-tests.config.js`:

```javascript
export default {
  snapshot: {
    image: {
      // Only match stories with 'visual-image' tag for image snapshots
      testMatcher: { tags: ["visual-image"] },
    },
    position: {
      // Only match stories with 'visual-layout' tag for layout tracking
      testMatcher: { tags: ["visual-layout"] },
    },
  },
};
```
