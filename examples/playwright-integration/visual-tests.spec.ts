/**
 * Visual Regression Tests
 *
 * This file generates Playwright tests for all Storybook stories
 * matching the configured criteria.
 *
 * The tests will:
 * 1. Navigate to each story
 * 2. Wait for the story to be ready
 * 3. Mask dynamic elements (timestamps, etc.)
 * 4. Capture element positions (if enabled)
 * 5. Take a screenshot and compare with baseline
 */

import { loadConfig } from "ui-snapshot-testing/config";
import { generateVisualTests } from "ui-snapshot-testing/playwright";

// Load configuration from visual-tests.config.js or environment variables
const config = await loadConfig();

// Generate visual tests for all matching stories
await generateVisualTests({ config });
