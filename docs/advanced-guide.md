# Visual Testing Advanced Guide

This guide covers advanced topics, troubleshooting, and internal mechanisms of the `@pratishthan/snapshot-testing` library.

> **Note:** For basic setup and usage instructions, please refer to the [Usage Guide](../examples/usage.md).

## Table of Contents

- [Component Masking](#component-masking)
- [Element Position Tracking](#element-position-tracking)
- [Handling Failures](#handling-snapshot-test-failures)
- [Troubleshooting](#troubleshooting)
- [Design Decisions](#approaches-considered)

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
   npx ui-snapshot-testing update-incremental
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
   npx ui-snapshot-testing run
   ```

3. **If tests fail:**
   - Review HTML report: `npx ui-snapshot-testing report`
   - Check if failures are intentional visual changes
   - If intentional, update snapshots: `npx ui-snapshot-testing update-interactive` (recommended) or `npx ui-snapshot-testing update`
   - If unintentional, fix the component

4. **Commit changes:**
   ```bash
   git add playwright/storybook-visual/__visual_snapshots__/
   git commit -m "Update visual test snapshots"
   ```

### CI/CD Workflow

1. **Run diff-based tests (lite mode by default):**

   ```bash
   VISUAL_TESTS_TARGET_BRANCH=main npx ui-snapshot-testing diff
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
   npx ui-snapshot-testing failures
   ```

3. **Check specific story:**

   ```bash
   STORY_IDS=button--default npx ui-snapshot-testing run
   ```

4. **View screenshots:**
   - Check `logs/screenshots/` directory
   - Compare with `playwright/storybook-visual/__visual_snapshots__/`

## Handling Snapshot Test Failures

When a snapshot test fails, follow these steps to diagnose and resolve the issue:

### Step 1: Understand the Failure

1. **Check the test output:**
   ```bash
   npx ui-snapshot-testing run
   ```

Look for error messages indicating which stories failed.

2. **View the HTML report:**
   ```bash
   npx ui-snapshot-testing report
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
   npx ui-snapshot-testing failures

   # Or test specific component
   STORY_INCLUDE_PATHS=components/Button npx ui-snapshot-testing run
   ```

4. **Confirm test passes:**
   ```bash
   npx ui-snapshot-testing run
   ```

#### Option B: Update Snapshot for Intentional Changes

1. **Verify the change is intentional:**
   - Review the HTML report
   - Confirm the new visual matches your design intent
   - Check with team if needed

2. **Update the snapshot:**

   ```bash
   # Interactive: Select which failures to update (recommended)
   npx ui-snapshot-testing update-interactive

   # Update all snapshots (use with caution)
   npx ui-snapshot-testing update

   # Or update specific component
   STORY_INCLUDE_PATHS=components/Button npx ui-snapshot-testing update
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
   npx ui-snapshot-testing run
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
- If intentional: `npx ui-snapshot-testing update`
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
2. **Use diff-based tests in CI** for faster feedback
3. **Review HTML reports** to understand visual changes
4. **Update snapshots intentionally** - don't blindly accept all changes
5. **Mask dynamic content** to prevent false failures
6. **Keep snapshots in version control** for team consistency
7. **Document masking decisions** when adding new masked components
8. **Exclude non-visual stories** tags to prevent unnecessary testing
