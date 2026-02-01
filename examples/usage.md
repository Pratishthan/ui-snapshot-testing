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

---

## Mobile Snapshots

Test your stories with mobile viewports using the `--mobile` flag.

### Configuration

Add mobile configuration to `visual-tests.config.js`:

```javascript
export default {
  snapshot: {
    mobile: {
      // Enable mobile snapshots
      enabled: true,

      // Override test matcher for mobile (optional)
      // Only stories with 'visual-mobile' tag will be tested in mobile mode
      testMatcher: {
        tags: ["visual-mobile"],
      },

      // Define mobile viewports to test
      viewports: [
        { width: 375, height: 667, name: "iPhone SE" },
        { width: 390, height: 844, name: "iPhone 12/13" },
        { width: 360, height: 640, name: "Android Small" },
      ],
    },
  },
};
```

### Story Tagging

Tag stories that should be tested in mobile mode:

```typescript
// ForgotPassword.stories.tsx
export const Default: Story = {
  tags: ['visual', 'visual-mobile'],  // Include both tags
  args: { ... },
};
```

### Running Mobile Tests

| Action                      | Command                                                             |
| :-------------------------- | :------------------------------------------------------------------ |
| **Run Mobile Tests**        | `npx snapshot-testing run --mobile`                                 |
| **Update Mobile Snapshots** | `npx snapshot-testing run --mobile --update-snapshots`              |
| **Test Specific Story**     | `npx snapshot-testing run --mobile --include-paths "path/to/story"` |

### Behavior

- **Snapshot Directory**: Mobile snapshots are stored in a `mobile/` subdirectory (e.g., `__visual_snapshots__/mobile/`)
- **Viewport Selection**: Currently uses the first viewport from the `viewports` array
- **Tag Filtering**: When `testMatcher` is configured in `snapshot.mobile`, only stories with matching tags are tested
- **Independent Snapshots**: Mobile and desktop snapshots are stored separately and compared independently

### Example Package.json Scripts

```json
{
  "scripts": {
    "test:visual:mobile": "npm run warmup-storybook && npx snapshot-testing run --mobile",
    "test:visual:mobile:update": "npm run warmup-storybook && npx snapshot-testing run --mobile --update-snapshots"
  }
}
```

### Future Enhancements

- **Multi-viewport support**: Run tests across all configured viewports
- **Story-level viewport override**: Override viewports per story via `story.parameters.mobileViewports`
- **Parallel viewport testing**: Generate snapshots for all viewports concurrently

---

## Locale Snapshots

Test your stories with different locales (languages/regions) using the `--locale` flag. This is useful for internationalized applications to ensure UI renders correctly in different languages and RTL layouts.

### Configuration

Add locale configuration to `visual-tests.config.js`:

```javascript
export default {
  snapshot: {
    locale: {
      // Enable locale snapshots
      enabled: true,

      // Optional: Override test matcher for locale-specific stories
      // Only stories with 'visual-locale' tag will be tested in locale mode
      testMatcher: {
        tags: ["visual-locale"],
      },

      // Define locales to test
      locales: [
        { code: "en", name: "English" },
        { code: "de", name: "German" },
        { code: "ar", name: "Arabic", direction: "rtl" },
      ],

      // Storybook parameter to set locale (how to pass locale to stories)
      // This will be injected as a URL parameter when navigating to stories
      storybookGlobalParam: "locale", // e.g., ?globals=locale:de
    },
  },
};
```

### Story Tagging

Tag stories that should be tested in locale mode:

```typescript
// LoginForm.stories.tsx
export const Default: Story = {
  tags: ['visual', 'visual-locale'],  // Include both tags
  args: { ... },
};
```

### Running Locale Tests

| Action                      | Command                                                                |
| :-------------------------- | :--------------------------------------------------------------------- |
| **Run Locale Tests**        | `npx snapshot-testing run --locale de`                                 |
| **Update Locale Snapshots** | `npx snapshot-testing update --locale de`                              |
| **Test Specific Story**     | `npx snapshot-testing run --locale de --include-paths "path/to/story"` |
| **Test RTL Locale**         | `npx snapshot-testing run --locale ar`                                 |

### Behavior

- **Snapshot Directory**: Locale snapshots are stored in locale-specific subdirectories (e.g., `__visual_snapshots__/de/`, `__visual_snapshots__/ar/`)
- **Locale Parameter Injection**: The locale code is automatically injected into Storybook URLs as a global parameter (e.g., `?globals=locale:de`)
- **Tag Filtering**: When `testMatcher` is configured in `snapshot.locale`, only stories with matching tags are tested in locale mode
- **Independent Snapshots**: Each locale has its own set of snapshots, allowing you to verify translations and layout changes
- **RTL Support**: Locales with `direction: 'rtl'` can be tested to ensure proper right-to-left layout rendering

### Storybook Integration

Ensure your Storybook is configured to respond to the locale global parameter:

```javascript
// .storybook/preview.js
export const globalTypes = {
  locale: {
    name: "Locale",
    description: "Internationalization locale",
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

// Decorator to apply locale to stories
export const decorators = [
  (Story, context) => {
    const locale = context.globals.locale;
    // Apply locale to your i18n library
    i18n.changeLanguage(locale);
    return <Story />;
  },
];
```

### Example Package.json Scripts

```json
{
  "scripts": {
    "test:visual:locale:de": "npm run warmup-storybook && npx snapshot-testing run --locale de",
    "test:visual:locale:ar": "npm run warmup-storybook && npx snapshot-testing run --locale ar",
    "test:visual:locale:update": "npm run warmup-storybook && npx snapshot-testing update --locale de"
  }
}
```

### Testing Multiple Locales

To test all configured locales, create a script:

```bash
#!/bin/bash
# test-all-locales.sh
for locale in en de ar; do
  echo "Testing locale: $locale"
  npx snapshot-testing run --locale $locale
done
```

### Future Enhancements

- **Multi-locale batch testing**: Run tests for all configured locales in a single command
- **Locale-specific thresholds**: Different comparison thresholds for RTL layouts
- **Locale coverage reports**: Track which stories have been tested in which locales
