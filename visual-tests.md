# Visual Tests Documentation

## Overview

The visual tests system uses Playwright to capture screenshots of Storybook stories and compare them against baseline snapshots. This ensures visual consistency across component changes.

## Quick Start

### Basic Workflow

1. **Start Storybook** (if not already running):

   ```bash
   npm run storybook
   ```

2. **Run visual tests**:

   ```bash
   npm run test:visual-tests
   ```

3. **View results**:
   ```bash
   npm run test:visual-tests:report
   ```

## Available Commands

### `test:visual-tests`

Runs all visual tests for stories matching visual criteria in **full mode** (Default, Error, Long keywords or \_visual suffix).

**Usage:**

```bash
npm run test:visual-tests
```

**What it does:**

- Warms up Storybook server
- Discovers stories matching visual test criteria (full mode)
- Captures screenshots and compares against snapshots
- Generates reports and logs

**Mode:** Full (tests all stories matching keywords)

### `test:visual-tests:lite`

Runs visual tests in **lite mode** - only tests stories with `_visual` suffix.

**Usage:**

```bash
npm run test:visual-tests:lite
```

**What it does:**

- Warms up Storybook server
- Discovers only stories with `_visual` or `-visual` suffix
- Captures screenshots and compares against snapshots
- Generates reports and logs

**Mode:** Lite (only `_visual` stories)

**Use cases:**

- Faster test execution for quick checks
- Testing only explicitly marked visual stories
- CI/CD pipelines where speed is critical

**Output:**

- Console output with test results
- `logs/storybook-visual-results.log` - Detailed log file
- `logs/visual-test-results.json` - JSON results
- `logs/visual-test-report.html` - HTML report (if failures)
- `logs/screenshots/` - Failure screenshots

### `test:visual-tests:diff`

Runs visual tests only for stories that changed between a target branch and current HEAD. Optimized for CI/CD pipelines. **Uses lite mode by default** (only `_visual` stories).

**Usage:**

```bash
# Compare against default branch (Sprint16) - lite mode
npm run test:visual-tests:diff

# Compare against custom branch - lite mode
VISUAL_TESTS_TARGET_BRANCH=main npm run test:visual-tests:diff

# Use full mode instead
VISUAL_TEST_MODE=full npm run test:visual-tests:diff
```

**What it does:**

- Analyzes git diff between target branch and HEAD
- Identifies changed story files and component files
- Maps component changes to their story files
- Runs tests only for affected stories (filtered by mode)
- Automatically warms up Storybook

**Configuration:**

- `VISUAL_TESTS_TARGET_BRANCH` - Target branch name (default: `Sprint16`)
- `VISUAL_TEST_MODE` - Test mode: `lite` (default) or `full`

**Mode:** Lite by default (only `_visual` stories). Override with `VISUAL_TEST_MODE=full` for full keyword matching.

**Remote branch support:**

If the target branch doesn't exist locally, the script will:

1. Check if it exists remotely (e.g., `origin/Sprint16`)
2. Prompt you to either:
   - Use the remote branch directly for diff
   - Fetch and checkout the branch locally first
   - Cancel

**Examples:**

```bash
# Default: lite mode against Sprint16
npm run test:visual-tests:diff

# Full mode against develop branch
VISUAL_TEST_MODE=full VISUAL_TESTS_TARGET_BRANCH=develop npm run test:visual-tests:diff

# Lite mode against main branch
VISUAL_TESTS_TARGET_BRANCH=main npm run test:visual-tests:diff
```

### `test:visual-tests:update`

Updates snapshots for all stories matching visual criteria. Use when you've intentionally changed component visuals.

**Usage:**

```bash
npm run test:visual-tests:update
```

**Warning:** This will update ALL snapshots. Use `test:visual-tests:update-incremental` for safer updates.

### `test:visual-tests:update-incremental`

Updates snapshots for stories that don't have complete snapshots yet. Safe for initial snapshot generation and updating missing position snapshots.

**Usage:**

```bash
npm run test:visual-tests:update-incremental
```

**What it does:**

- Finds stories matching visual criteria that need snapshot updates:
  - Stories without image snapshots, OR
  - Stories with image snapshots but missing position snapshots (when position tracking is enabled)
- Generates snapshots only for those stories
- Skips stories that already have complete snapshots (both image and position)

### `test:visual-tests:report`

Opens the HTML report in your default browser.

**Usage:**

```bash
npm run test:visual-tests:report
```

**Report includes:**

- Side-by-side comparison of reference vs actual screenshots
- Story IDs and import paths
- Error messages
- Links to screenshot files

### `test:visual-tests:failures`

Reruns only the tests that failed in the last run.

**Usage:**

```bash
# Uses default results file: logs/visual-test-results.json
npm run test:visual-tests:failures

# Use custom results file
node scripts/visual-tests/run-visual-tests-failures.js logs/custom-results.json
```

**What it does:**

- Reads `logs/visual-test-results.json` from last run
- Extracts failed story IDs
- Reruns only those tests
- Useful for debugging specific failures

### `test:visual-tests:update-interactive`

Interactive command to update snapshots for selected failed stories. Shows a list of failures and lets you pick which ones to update.

**Usage:**

```bash
npm run test:visual-tests:update-interactive
```

**What it does:**

- Reads failures from `logs/visual-test-failures.jsonl` (preferred) or `logs/visual-test-results.json` (fallback)
- Displays an interactive multi-select list of failed stories
- Shows story ID, import path, and error message for each failure
- Allows you to select which stories to update (use space to select, enter to confirm)
- Confirms before updating snapshots
- Updates snapshots for selected stories using Playwright with `--update-snapshots` flag
- Updates both image and position snapshots automatically

**Use cases:**

- Selectively update snapshots for intentional visual changes
- Review failures before updating
- Update only specific stories instead of all failures
- Safer alternative to `test:visual-tests:update` which updates all snapshots

**Example workflow:**

1. Run visual tests and see failures:

   ```bash
   npm run test:visual-tests
   ```

2. Review failures in HTML report:

   ```bash
   npm run test:visual-tests:report
   ```

3. Update snapshots for selected stories:

   ```bash
   npm run test:visual-tests:update-interactive
   ```

4. The interactive prompt will show:
   - List of all failed stories
   - Story ID, import path, and error message
   - Multi-select interface to choose which to update
   - Confirmation prompt before proceeding

## Visual Test Modes

The visual test system supports two modes that control which stories are tested:

### Lite Mode

**Behavior:** Only tests stories with `_visual` or `-visual` suffix.

**Use cases:**

- Fast feedback during development
- CI/CD pipelines where speed is critical
- Testing only explicitly marked visual stories
- Quick regression checks

**Default for:** `test:visual-tests:diff`, `test:visual-tests:lite`

**Example:**

```bash
# Explicit lite mode
npm run test:visual-tests:lite

# Or via environment variable
VISUAL_TEST_MODE=lite npm run test:visual-tests
```

### Full Mode

**Behavior:** Tests stories matching keywords (Default, Error, Long) or `_visual` suffix.

**Use cases:**

- Comprehensive visual regression testing
- Pre-release validation
- Full test coverage
- Catching all visual changes

**Default for:** `test:visual-tests`

**Example:**

```bash
# Explicit full mode
npm run test:visual-tests

# Or via environment variable
VISUAL_TEST_MODE=full npm run test:visual-tests
```

### Choosing the Right Mode

- **Development:** Use lite mode for quick checks
- **CI/CD:** Use lite mode for faster feedback (default in `test:visual-tests:diff`)
- **Pre-release:** Use full mode for comprehensive testing
- **Debugging:** Use full mode to catch all potential issues

### Mode Override

You can override the mode for any command:

```bash
# Run diff in full mode
VISUAL_TEST_MODE=full npm run test:visual-tests:diff

# Run regular tests in lite mode
VISUAL_TEST_MODE=lite npm run test:visual-tests
```

## Reports and Logs

### Log Files

#### `logs/storybook-visual-results.log`

Detailed log file with:

- Test execution timeline
- Pass/fail status for each story
- Error messages
- Summary statistics

**Format:**

```
Run: 2025-01-15T10:30:00.000Z (stories: 150)
START button--default
PASS button--default
START button--loading
FAIL [button--loading] Snapshot mismatch
...
SUMMARY: Failing stories ❌
```

#### `logs/visual-test-results.json`

Machine-readable JSON results with:

- Timestamp
- Total stories tested
- Failed stories (with IDs, paths, messages, screenshot paths)
- Passed stories
- Ignored stories (with patterns)
- Skipped stories (with reasons)

**Structure:**

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "totalStories": 150,
  "failures": [
    {
      "id": "button--loading",
      "importPath": "src/components/Button/Button.stories.tsx",
      "message": "Snapshot mismatch",
      "screenshotPath": "logs/screenshots/button--loading-1234567890.png"
    }
  ],
  "passed": ["button--default", "input--default"],
  "ignored": [
    {
      "id": "slow-component--default",
      "importPath": "src/components/Slow/Slow.stories.tsx",
      "message": "Test timeout of 30000ms exceeded",
      "pattern": "timeout"
    }
  ],
  "skipped": [
    {
      "id": "component--default-no-visual",
      "importPath": "src/components/Component/Component.stories.tsx",
      "message": "Snapshot not found: component--default-no-visual.png",
      "reason": "snapshot_not_found"
    },
    {
      "id": "another-component--default",
      "importPath": "src/components/Another/Another.stories.tsx",
      "message": "Failed to generate snapshot: Element not visible",
      "reason": "failed_to_generate_snapshot"
    }
  ]
}
```

**Skipped reasons:**

- `snapshot_not_found` - Snapshot doesn't exist and test is in verify mode (not update mode)
- `failed_to_generate_snapshot` - Attempted to generate snapshot but failed (element not visible, timeout, etc.)
- `visibility_timeout_issue` - Snapshot generation failed due to visibility or timeout issues

### HTML Report

#### `logs/visual-test-report.html`

Interactive HTML report with:

- Side-by-side comparison of reference vs actual screenshots
- Story IDs and import paths
- Error messages
- Visual diff view

**Access:**

```bash
npm run test:visual-tests:report
```

**Features:**

- Only generated when there are failures
- Deduplicates failures by story ID
- Shows reference snapshot (if exists) and error screenshot
- Responsive layout for easy viewing

### Screenshots

#### `logs/screenshots/`

Directory containing failure screenshots:

- Filename format: `{storyId}-{timestamp}.png`
- Captured when tests fail
- Used in HTML report for comparison

### Snapshots

#### `playwright/storybook-visual/__visual_snapshots__/`

Directory containing baseline snapshot images:

- Filename format: `{sanitized-story-id}.png`
- These are the "golden" images for comparison
- Updated via `test:visual-tests:update` commands
- Committed to version control

## Component Masking

### Purpose

Some components display dynamic content (like timestamps) that changes between test runs, causing false failures. Masking hides these elements while preserving layout.

### Masked Components

#### `BsqDate`

Displays formatted dates that change over time.

**Location:** `src/components/BsqComponents/BsqDate/BsqDate.tsx`

**How it's masked:**

- Uses `data-testid="bsqDate"` attribute
- CSS rule hides element: `visibility: hidden !important;`
- Layout space is preserved (element still takes up space)

#### `TimeElapsed`

Displays relative time (e.g., "2 minutes ago") that changes constantly.

**Location:** `src/components/BsqComponents/TimeElapsed/TimeElapsed.tsx`

**How it's masked:**

- Uses `data-testid="timeElapsed"` attribute
- CSS rule hides element: `visibility: hidden !important;`
- Layout space is preserved

### How Masking Works

Masking is applied automatically before taking screenshots:

1. **CSS Injection**: Before screenshot, a style tag is injected into the page
2. **Selector Matching**: Elements with `data-testid="bsqDate"` or `data-testid="timeElapsed"` are hidden
3. **Layout Preservation**: Uses `visibility: hidden` (not `display: none`) to preserve layout
4. **Screenshot**: Screenshot is taken with masked elements invisible

**Implementation** (from `visual-tests.spec.ts`):

```typescript
const maskTimestampElements = async (page: Page): Promise<void> => {
  await page.addStyleTag({
    content: `
      [data-testid="timeElapsed"],
      [data-testid="bsqDate"] {
        visibility: hidden !important;
      }
    `,
  });
};
```

### Adding More Components to Mask

To mask additional components with dynamic content:

1. **Add `data-testid` to component:**

   ```tsx
   <div data-testid="myDynamicComponent">{dynamicContent}</div>
   ```

2. **Update masking function** in `playwright/storybook-visual/visual-tests.spec.ts`:

   ```typescript
   const maskTimestampElements = async (page: Page): Promise<void> => {
     await page.addStyleTag({
       content: `
         [data-testid="timeElapsed"],
         [data-testid="bsqDate"],
         [data-testid="myDynamicComponent"] {  // Add your component here
           visibility: hidden !important;
         }
       `,
     });
   };
   ```

3. **Test the masking:**
   - Run visual tests
   - Verify component is hidden in screenshots
   - Ensure layout is preserved (no layout shifts)

**Best Practices:**

- Only mask components with truly dynamic content (timestamps, random IDs, etc.)
- Use `visibility: hidden` (not `display: none`) to preserve layout
- Document why components are masked
- Consider if component should be mocked in stories instead

## Element Position Tracking

### Overview

Element position tracking automatically captures and compares the positions of all elements with `data-testid` attributes. This catches layout shifts (like elements moving from one position to another) that might be missed by image snapshot comparison with tolerance settings.

### Why It Was Added

Image snapshot comparison with tolerance settings can miss essential layout changes. For example, if an icon moves from before to after another element, the tolerance settings may allow it to pass if the colors are similar. Position tracking provides a precise, automatic way to detect such layout shifts without requiring any developer intervention.

### How It Works

1. **Capture Phase (Update Mode):**
   - When snapshots are updated, element positions are automatically captured
   - All elements with `data-testid` attributes are found within the target container
   - Element order (sequence in DOM) is recorded
   - Positions are saved as JSON files: `{snapshot-name}.positions.json`

2. **Comparison Phase (Verify Mode):**
   - Before image comparison, current element order is captured
   - Expected order is loaded from the position snapshot file
   - Element order is compared element-by-element by `testId`
   - Order changes are reported as failures

3. **Configuration:**
   - **Order Check**: Enabled by default, can be disabled via `ENABLE_ORDER_CHECK=false`
   - **Position/Size Thresholds**: Kept for configuration compatibility but currently disabled (x, y, width, height checks are not performed)

### What It Catches

- Element order changes (elements appearing in different sequence)
- Missing elements (elements that were present but are now gone)
- New elements (elements that were added)

**Note:** Currently only element order is checked. X/Y coordinate and width/height comparisons are disabled to reduce false positives from rendering variations.

### What It Doesn't Catch

- CSS styling changes (colors, fonts, borders)
- Visual appearance (same position, different look)
- Elements without `data-testid` attributes
- Text content changes (unless element position changes)

### Configuration

Environment variables:

- `ENABLE_POSITION_TRACKING`: Set to `'false'` to disable (default: `'true'`)
- `ENABLE_ORDER_CHECK`: Set to `'false'` to disable order checking (default: `'true'`)
- `POSITION_THRESHOLD`: Kept for config compatibility, not currently used (x/y checks disabled)
- `SIZE_THRESHOLD`: Kept for config compatibility, not currently used (width/height checks disabled)

### File Structure

Position snapshots are stored alongside image snapshots:

```
playwright/storybook-visual/__visual_snapshots__/
  ├── books-booktable--default.png
  ├── books-booktable--default.positions.json
  ├── button--default.png
  └── button--default.positions.json
```

### Error Messages

When order differences are detected, clear error messages are shown:

```
Element 'freeze-icon' order changed from position 2 to 5
Element 'short-name' was removed (was at order position 3)
Element 'new-button' was added at order position 4
```

### Troubleshooting

**Position file not found:**

- This is normal for existing snapshots created before position tracking was added
- Tests will still run (image comparison only)
- Update snapshots to generate position files: `npm run test:visual-tests:update`

**Too many order failures:**

- Check if elements are legitimately reordered (responsive layouts, dynamic content)
- Consider disabling order checking for specific stories if order changes are expected
- Ensure elements have stable `data-testid` attributes

**Elements not being tracked:**

- Only elements with `data-testid` attributes are tracked
- Ensure components have test IDs if you want them tracked
- Hidden elements (width=0 or height=0) are automatically excluded
- Only element order is checked (x, y, width, height comparisons are disabled)

## Approaches Considered

### Problem Statement

Image snapshot comparison with tolerance settings was missing essential layout changes. For example, when a freeze icon moved from before to after the shortname column, the test still passed because the tolerance settings allowed the difference (similar colors, within pixel ratio threshold).

### Options Considered

#### 1. Lowering Tolerance Settings

**Approach:** Make tolerance settings stricter (lower threshold, lower maxDiffPixelRatio)

**Pros:**

- Simple - just configuration changes
- No code changes needed
- Still catches visual differences

**Cons:**

- Too many false positives from rendering differences (anti-aliasing, font rendering)
- Doesn't specifically target layout changes
- May cause tests to be flaky

**Decision:** Not chosen - too many false positives, doesn't solve the root problem

#### 2. HTML Snapshots

**Approach:** Capture and compare HTML structure alongside image snapshots

**Pros:**

- Catches structural changes (element order, nesting)
- Catches attribute changes
- Text-based, easy to diff

**Cons:**

- Requires normalization logic for dynamic content
- Higher maintenance (normalization rules need updates)
- More false positives (class name changes, attribute order)
- Doesn't catch CSS styling changes
- Doesn't catch visual appearance

**Decision:** Not chosen - requires more maintenance, higher false positive rate

#### 3. Manual Position Assertions

**Approach:** Developers add explicit position checks in story files or test files

**Pros:**

- Precise for known layout requirements
- Clear intent
- Fast comparison

**Cons:**

- Not scalable - requires developer intervention for each component
- Developers won't remember to add checks
- Maintenance burden
- Doesn't catch unexpected changes

**Decision:** Not chosen - not scalable, requires too much developer intervention

#### 4. Automatic Element Position Tracking (Chosen)

**Approach:** Automatically capture and compare element positions for all elements with `data-testid` attributes

**Pros:**

- Zero developer intervention required
- Automatically catches layout shifts
- Precise error messages showing exact position changes
- Fast comparison (no image processing)
- Works with existing `data-testid` attributes
- Complements image snapshots (catches what images might miss)
- Low false positive rate (only fails on actual position changes)

**Cons:**

- Requires `data-testid` attributes (but these are already widely used)
- May need threshold tuning for responsive/dynamic layouts
- Doesn't catch CSS styling changes (but image snapshots do)

**Decision:** Chosen - best balance of automatic detection, precision, and low maintenance

### Comparison Table

| Aspect                 | Lower Tolerance   | HTML Snapshots            | Manual Assertions      | Position Tracking |
| ---------------------- | ----------------- | ------------------------- | ---------------------- | ----------------- |
| Developer Intervention | None              | None (if automatic)       | Required per component | None              |
| Catches Layout Shifts  | Partial           | Only if structure changes | Yes (if added)         | Yes               |
| Catches CSS Changes    | Yes               | No                        | No                     | No                |
| False Positives        | High              | Medium                    | Low                    | Low               |
| Maintenance            | Low               | Medium                    | High                   | Low               |
| Performance            | Slow (image diff) | Fast (text diff)          | Very fast              | Very fast         |
| Scalability            | Good              | Good                      | Poor                   | Excellent         |

### Decision Rationale

Automatic element position tracking was chosen because:

1. **Zero Developer Intervention**: Works automatically for all stories with `data-testid` attributes
2. **Precise Detection**: Specifically targets layout shifts that tolerance-based image comparison might miss
3. **Low False Positives**: Only fails on actual position changes, not rendering differences
4. **Fast**: Simple number comparison, no image processing needed
5. **Complements Existing Tests**: Works alongside image snapshots to provide comprehensive coverage
6. **Maintainable**: Minimal maintenance required, self-updating

The approach provides the best balance between automatic detection, precision, and ease of maintenance.

## Story Selection Criteria

Stories are included in visual tests based on the selected mode and filters. Filters are applied in this order:

### Filter Order

1. **Exclusion Filter** (applied first)
   - Stories matching `STORY_VISUAL_EXCLUSIONS` patterns are excluded
   - Default: excludes stories containing "no-visual"
   - Checked against story ID, name, and import path (case-insensitive)

2. **Mode-Based Selection**
   - Lite Mode: Only stories with `_visual` or `-visual` suffix
   - Full Mode: Stories with `_visual` suffix OR matching keywords

3. **Additional Filters** (if set)
   - Path Filter: Story import path matches `STORY_INCLUDE_PATHS`
   - ID Filter: Story ID matches `STORY_IDS`

4. **Snapshot Filter** (verify mode only)
   - Only stories with existing snapshots are tested
   - In update mode, all matching stories are included

### Mode-Based Selection

**Lite Mode (`VISUAL_TEST_MODE=lite`):**

- Only stories with `_visual` or `-visual` suffix are included
- Keywords are ignored (even if `STORY_VISUAL_KEYWORDS` is set)

**Full Mode (`VISUAL_TEST_MODE=full`):**

- Stories with `_visual` or `-visual` suffix (always included)
- Stories matching keywords from `STORY_VISUAL_KEYWORDS` (default: Default, Error, Long)

### Exclusion Patterns

Stories matching exclusion patterns are filtered out before all other criteria:

- **Default exclusion**: `no-visual` (stories containing "no-visual" are excluded)
- **Configurable**: Set via `STORY_VISUAL_EXCLUSIONS` environment variable
- **Matching**: Checked against story ID, display name, and import path (case-insensitive)

### Examples

**Exclusion Examples:**

- `Button--default-no-visual` ❌ (contains "no-visual" - excluded)
- `Component--no-visual-test` ❌ (contains "no-visual" - excluded)
- `Button--default` ✅ (doesn't contain exclusion pattern)

**Lite Mode:**

- `Button--visual` ✅ (has \_visual suffix)
- `Button--default` ❌ (no \_visual suffix)
- `Button--loading` ❌ (no \_visual suffix)
- `Button--default-no-visual` ❌ (excluded by exclusion pattern)

**Full Mode:**

- `Button--default` ✅ (matches "Default" keyword)
- `Button--error` ✅ (matches "Error" keyword)
- `Button--long` ✅ (matches "Long" keyword)
- `Button--visual` ✅ (has \_visual suffix)
- `Button--loading` ❌ (doesn't match criteria - "Loading" removed from defaults)
- `Button--interactive` ❌ (doesn't match criteria)
- `Button--default-no-visual` ❌ (excluded by exclusion pattern)

**Note:**

- Stories with `_visual` suffix are always included in both modes (unless excluded)
- Exclusion patterns are checked first, so excluded stories never enter the test pipeline

## Step-by-Step Usage Guide

### First Time Setup

1. **Ensure Storybook is running:**

   ```bash
   npm run storybook
   ```

2. **Generate initial snapshots:**
   ```bash
   npm run test:visual-tests:update-incremental
   ```

This creates snapshots only for stories without existing snapshots.

3. **Commit snapshots:**
   ```bash
   git add playwright/storybook-visual/__visual_snapshots__/
   git commit -m "Add initial visual test snapshots"
   ```

### Daily Development Workflow

1. **Make component changes**

2. **Run visual tests:**

   ```bash
   npm run test:visual-tests
   ```

3. **If tests fail:**
   - Review HTML report: `npm run test:visual-tests:report`
   - Check if failures are intentional visual changes
   - If intentional, update snapshots: `npm run test:visual-tests:update-interactive` (recommended) or `npm run test:visual-tests:update`
   - If unintentional, fix the component

4. **Commit changes:**
   ```bash
   git add playwright/storybook-visual/__visual_snapshots__/
   git commit -m "Update visual test snapshots"
   ```

### CI/CD Workflow

1. **Run diff-based tests (lite mode by default):**

   ```bash
   VISUAL_TESTS_TARGET_BRANCH=main npm run test:visual-tests:diff
   ```

2. **Tests run only for changed stories** (faster execution)
   - Uses lite mode by default (only `_visual` stories)
   - Override with `VISUAL_TEST_MODE=full` for comprehensive testing

3. **If failures occur:**
   - Check logs: `logs/storybook-visual-results.log`
   - Review JSON results: `logs/visual-test-results.json`
   - Download HTML report if available

**Tip:** Use lite mode in CI for faster feedback, and full mode for comprehensive pre-release testing.

### Debugging Failures

1. **View detailed log:**

   ```bash
   cat logs/storybook-visual-results.log
   ```

2. **Rerun only failures:**

   ```bash
   npm run test:visual-tests:failures
   ```

3. **Check specific story:**

   ```bash
   STORY_IDS=button--default npm run test:visual-tests
   ```

4. **View screenshots:**
   - Check `logs/screenshots/` directory
   - Compare with `playwright/storybook-visual/__visual_snapshots__/`

## Handling Snapshot Test Failures

When a snapshot test fails, follow these steps to diagnose and resolve the issue:

### Step 1: Understand the Failure

1. **Check the test output:**
   ```bash
   npm run test:visual-tests
   ```

Look for error messages indicating which stories failed.

2. **View the HTML report:**
   ```bash
   npm run test:visual-tests:report
   ```

This shows side-by-side comparison of expected vs actual screenshots.

3. **Review detailed logs:**
   ```bash
   cat logs/storybook-visual-results.log
   ```

Check for specific error messages and story IDs.

4. **Check JSON results:**
   ```bash
   cat logs/visual-test-results.json
   ```

Machine-readable format with failure details.

### Step 2: Determine Failure Type

#### Visual Regression (Unintentional Change)

- Component looks different than expected
- Layout shifted or broke
- Styling changed unexpectedly
- Component behavior changed

**Action:** Fix the component to match the expected visual state.

#### Intentional Visual Change

- You intentionally changed the component's appearance
- Design was updated
- New feature was added
- Component was refactored with visual changes

**Action:** Update the snapshot (see Step 3).

#### False Positive

- Dynamic content not properly masked
- Timing issue (component not fully loaded)
- Environment difference (fonts, browser, etc.)

**Action:** Fix masking, timing, or environment issues.

### Step 3: Resolve the Failure

#### Option A: Fix Unintentional Changes

1. **Identify the root cause:**
   - Review component code changes
   - Check CSS/styling changes
   - Verify component props/state

2. **Fix the component:**
   - Revert unintended changes
   - Fix styling issues
   - Correct component behavior

3. **Verify the fix:**

   ```bash
   # Rerun only the failed test
   npm run test:visual-tests:failures

   # Or test specific component
   STORY_INCLUDE_PATHS=components/Button npm run test:visual-tests
   ```

4. **Confirm test passes:**
   ```bash
   npm run test:visual-tests
   ```

#### Option B: Update Snapshot for Intentional Changes

1. **Verify the change is intentional:**
   - Review the HTML report
   - Confirm the new visual matches your design intent
   - Check with team if needed

2. **Update the snapshot:**

   ```bash
   # Interactive: Select which failures to update (recommended)
   npm run test:visual-tests:update-interactive

   # Update all snapshots (use with caution)
   npm run test:visual-tests:update

   # Or update specific component
   STORY_INCLUDE_PATHS=components/Button npm run test:visual-tests:update
   ```

3. **Review the updated snapshot:**
   - Check `playwright/storybook-visual/__visual_snapshots__/` directory
   - Verify the new snapshot looks correct
   - Open in image viewer if needed

4. **Commit the changes:**
   ```bash
   git add playwright/storybook-visual/__visual_snapshots__/
   git commit -m "Update visual test snapshot for Button component"
   ```

#### Option C: Fix False Positives

1. **For dynamic content issues:**
   - Add component to masking (see "Adding More Components to Mask")
   - Or mock the dynamic content in the story

2. **For timing issues:**
   - Check if component needs more time to render
   - Verify loading states are handled correctly
   - Check Storybook story configuration

3. **For environment issues:**
   - Ensure consistent fonts are loaded
   - Check browser/Playwright configuration
   - Verify Storybook is running correctly

### Step 4: Verify Resolution

After fixing or updating:

1. **Run tests again:**

   ```bash
   npm run test:visual-tests
   ```

2. **Check results:**
   - All tests should pass
   - No unexpected failures
   - Snapshots match current component state

3. **Review in Storybook:**
   ```bash
   npm run storybook
   ```

Manually verify the component looks correct in Storybook UI.

### Common Failure Scenarios

#### Scenario 1: Component Styling Changed

**Symptom:** Snapshot shows different colors, spacing, or layout.

**Solution:**

- If intentional: Update snapshot
- If unintentional: Fix CSS/styling to match design

#### Scenario 2: Component Content Changed

**Symptom:** Snapshot shows different text or content.

**Solution:**

- If intentional: Update snapshot
- If unintentional: Fix component props or data

#### Scenario 3: Dynamic Content Causing Failures

**Symptom:** Timestamps, random IDs, or other dynamic content differ.

**Solution:**

- Add component to masking (see masking documentation)
- Or mock the dynamic content in the story

#### Scenario 4: Component Not Fully Loaded

**Symptom:** Snapshot shows loading state or empty component.

**Solution:**

- Check story configuration
- Verify async data loading
- Add proper loading state handling

#### Scenario 5: Layout Shift

**Symptom:** Elements are in different positions.

**Solution:**

- Check CSS changes
- Verify responsive behavior
- Check for missing styles or fonts

### Best Practices for Handling Failures

1. **Always review the HTML report** before updating snapshots
2. **Don't blindly update all snapshots** - review each failure individually
3. **Use `test:visual-tests:update-interactive`** to selectively update snapshots instead of updating all at once
4. **Test locally first** before pushing changes
5. **Use diff-based tests in CI** to catch issues early
6. **Document intentional visual changes** in commit messages
7. **Rerun failed tests** to verify fixes before committing
8. **Keep snapshots in sync** with component changes

## Troubleshooting

### Storybook Not Running

**Error:** `Unable to load Storybook index`

**Solution:**

```bash
npm run storybook
# Wait for Storybook to start, then run tests
```

### Tests Timing Out

**Error:** `Test timeout of 30000ms exceeded`

**Solutions:**

- Check if Storybook is responsive
- Increase timeout in `visual-tests.spec.ts` if needed
- Verify component renders correctly in Storybook UI

### Snapshot Mismatches

**Error:** Visual differences detected

**Solutions:**

- Review HTML report for actual differences
- If intentional: `npm run test:visual-tests:update`
- If unintentional: Fix component styling/behavior
- See "Handling Snapshot Test Failures" section above for detailed steps

### Masking Not Working

**Issue:** Dynamic content still causing failures

**Solutions:**

- Verify component has correct `data-testid`
- Check masking function includes the selector
- Ensure component is rendered before masking is applied

## Best Practices

1. **Run tests before committing** to catch visual regressions early
2. **Use diff-based tests in CI** for faster feedback (lite mode by default)
3. **Use lite mode for quick checks** during development
4. **Use full mode for comprehensive testing** before releases
5. **Review HTML reports** to understand visual changes
6. **Update snapshots intentionally** - don't blindly accept all changes
7. **Mask dynamic content** to prevent false failures
8. **Keep snapshots in version control** for team consistency
9. **Document masking decisions** when adding new masked components
10. **Mark critical visual stories** with `_visual` suffix for lite mode testing
11. **Exclude non-visual stories** by adding `no-visual` to story names/IDs to prevent unnecessary testing
12. **Review skipped tests** in results JSON to identify stories that need snapshots or fixes

### Convert to library

# Visual Tests NPM Library Extraction Plan

## Viability Assessment

**Yes, this is absolutely viable.** The code is well-structured and the core logic is already generic and reusable. The main work involves abstracting project-specific configurations and creating a flexible API.

## What You Currently Have

### 1. Core Test Logic (`visual-tests.spec.ts`)

- Storybook story discovery and filtering
- Screenshot capture with masking capabilities
- Snapshot comparison with configurable tolerance
- Element position tracking for layout shift detection
- Comprehensive error handling and retry logic
- Report generation and logging

### 2. Story Discovery (`storyDiscovery.ts`)

- Fetches stories from Storybook's `index.json`
- Filtering by keywords, paths, story IDs
- Mode support (lite/full)
- Exclusion pattern support

### 3. Supporting Scripts

- Report generation (`generate-visual-test-reports.js`)
- Wrapper scripts for different modes
- Interactive update tools
- Git diff-based testing

## What Needs to Be Abstracted

### 1. Project-Specific Paths

**Current Issues:**

- Hardcoded paths like `playwright/storybook-visual/__visual_snapshots__/`
- Log directory: `logs/`
- Script paths: `scripts/visual-tests/`

**Solution:** Make all paths configurable via options or environment variables.

### 2. Project-Specific Masking

**Current Issues:**

- Hardcoded selectors: `[data-testid="timeElapsed"]`, `[data-testid="bsqDate"]`

**Solution:** Accept a configurable list of CSS selectors to mask.

### 3. Configuration Coupling

**Current Issues:**

- Imports from `scripts/visual-tests/visual-test-config.js`
- Default keywords/exclusions are project-specific

**Solution:** Accept configuration via options object, config file, or environment variables.

### 4. Playwright Config Dependency

**Current Issues:**

- Assumes specific Playwright config structure
- Uses `testInfo.snapshotPath()` which is Playwright-specific

**Solution:** Accept Playwright test context or provide a config template.

### 5. Wrapper Scripts

**Current Issues:**

- Multiple wrapper scripts (`run-visual-tests-wrapper.js`, `run-visual-tests-diff.js`, etc.)
- Git diff logic for diff-based testing

**Solution:** Provide as CLI commands or programmatic APIs.

## Proposed Library Structure

```
@pratishthan/snapshot-testing/
├── src/
│   ├── core/
│   │   ├── visual-tests.spec.ts (abstracted)
│   │   ├── story-discovery.ts (abstracted)
│   │   └── position-tracking.ts
│   ├── config/
│   │   └── defaults.ts
│   ├── utils/
│   │   ├── masking.ts
│   │   └── reporting.ts
│   └── cli/
│       ├── run.ts
│       ├── update.ts
│       └── diff.ts
├── bin/
│   └── snapshot-testing (CLI entry point)
├── templates/
│   └── playwright.config.ts (template for Playwright integration)
└── package.json
```

## Configuration API

```typescript
interface VisualTestConfig {
  // Paths
  snapshotDir?: string;
  logDir?: string;

  // Storybook
  storybookUrl?: string;
  storybookPort?: number;
  storybookHost?: string;

  // Story selection
  mode?: "lite" | "full";
  keywords?: string[];
  exclusions?: string[];
  includePaths?: string[];
  storyIds?: string[];

  // Snapshot settings
  maxDiffPixelRatio?: number;
  maxDiffPixels?: number;
  threshold?: number;

  // Position tracking
  enablePositionTracking?: boolean;
  positionTrackingMinElements?: number;

  // Masking
  maskSelectors?: string[];

  // Error handling
  ignoreErrorPatterns?: string[];
  testTimeout?: number;
}
```

## What You'd Need to Do

### 1. Extract Core Logic

- Remove all hardcoded paths
- Make masking configurable
- Abstract configuration loading
- Remove project-specific imports

### 2. Create Configuration System

- Accept config via:
  - Options object (for programmatic use)
  - Config file (JSON/JS)
  - Environment variables (for backward compatibility)
  - CLI flags

### 3. Provide Multiple Entry Points

- **Programmatic API**: `import { runVisualTests } from '@pratishthan/snapshot-testing'`
- **CLI**: `snapshot-testing run`
- **Playwright Integration**: Plugin or helper function

### 4. Handle Dependencies

- **Peer dependencies**: `@playwright/test`
- **Optional dependencies**: For CLI features
- **Bundle utilities**: That don't require external dependencies

### 5. Documentation

- Migration guide from current setup
- API documentation
- Configuration reference
- Examples for different use cases

## Challenges to Consider

### 1. Playwright Integration

The test file uses Playwright's test framework directly. You have a few options:

**Option A: Playwright Plugin**

- Create a Playwright plugin that registers the tests
- Users configure it in their `playwright.config.ts`

**Option B: Test Generator Function**

- Export a function that generates Playwright tests
- Users call it in their test file

**Option C: Setup Guide**

- Provide a template and setup instructions
- Users copy and configure the test file

**Recommendation:** Option B (test generator) provides the best balance of flexibility and ease of use.

### 2. Storybook Version Compatibility

- Ensure compatibility with different Storybook versions
- The `index.json` format may vary between versions
- Consider version detection and adapters

### 3. Backward Compatibility

- If you want to keep using it in your current project, maintain compatibility
- Consider a migration path that allows gradual adoption

### 4. Git Diff Logic

- The diff-based testing uses git commands
- Make this optional or provide alternatives
- Consider supporting other VCS or change detection methods

## Recommended Approach

### Phase 1: Extract Core Logic

- Create library structure
- Extract core test logic into reusable functions
- Keep current project working
- Test with your project first

### Phase 2: Add Configuration Layer

- Create configuration system
- Support multiple config sources
- Maintain environment variable compatibility

### Phase 3: Provide APIs

- Programmatic API
- CLI commands
- Playwright integration helper

### Phase 4: Documentation and Examples

- Usage examples
- Migration guide
- Best practices

## Estimated Effort

- **Core extraction**: 2-3 days
- **Configuration system**: 1-2 days
- **CLI/API**: 2-3 days
- **Testing and documentation**: 2-3 days
- **Total**: ~1-2 weeks

## Example Usage (After Extraction)

### Programmatic API

```typescript
import { runVisualTests } from "@pratishthan/snapshot-testing";

await runVisualTests({
  storybookPort: 6006,
  snapshotDir: "./playwright/snapshots",
  mode: "full",
  keywords: ["Default", "Error"],
  maskSelectors: ['[data-testid="timeElapsed"]'],
});
```

### CLI Usage

```bash
snapshot-testing run \
  --storybook-port 6006 \
  --mode full \
  --keywords Default,Error \
  --mask-selectors '[data-testid="timeElapsed"]'
```

### Playwright Integration

```typescript
// playwright.config.ts
import { defineConfig } from "@playwright/test";
import { storybookVisualTests } from "@pratishthan/snapshot-testing";

export default defineConfig({
  // ... your config
  projects: [
    {
      name: "visual-tests",
      testMatch: "**/visual-tests.spec.ts",
    },
  ],
});

// visual-tests.spec.ts
import { generateVisualTests } from "@pratishthan/snapshot-testing";

generateVisualTests({
  storybookPort: 6006,
  mode: "full",
});
```

## Key Files to Extract

1. **`playwright/storybook-visual/visual-tests.spec.ts`**
   - Core test logic
   - Screenshot capture
   - Snapshot comparison
   - Position tracking

2. **`playwright/storybook-visual/storyDiscovery.ts`**
   - Story fetching
   - Filtering logic

3. **`scripts/visual-tests/generate-visual-test-reports.js`**
   - Report generation
   - HTML report creation

4. **`scripts/visual-tests/visual-test-config.js`**
   - Default configuration
   - Mode handling

## Dependencies to Consider

### Required (Peer Dependencies)

- `@playwright/test` - Core testing framework

### Optional

- `chalk` - CLI colors
- `commander` or `yargs` - CLI argument parsing
- `inquirer` - Interactive prompts (for update-interactive)

### Internal

- Node.js built-ins (fs, path, etc.)
- Native fetch (Node 18+)

## Conclusion

This is **highly viable** and would be a valuable open-source contribution. The code is well-structured and mostly generic. The main work involves:

1. Abstracting project-specific paths/config
2. Creating a flexible configuration system
3. Providing multiple integration options (programmatic, CLI, Playwright plugin)

The hardest part is the Playwright integration - you'll need to decide whether to provide a plugin, a test generator function, or a setup guide. The test generator approach is probably the most flexible.

The library would be useful for any team using Storybook + Playwright for visual regression testing, and your position tracking feature is a nice differentiator.
