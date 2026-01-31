#!/usr/bin/env node

/**
 * Incremental visual test snapshot generation script
 * Generates snapshots for stories that match visual test criteria but:
 * - Don't have image snapshots yet, OR
 * - Have image snapshots but are missing position snapshots (when position tracking is enabled)
 * 
 * Usage:
 *   node scripts/visual-tests/run-visual-tests-incremental.js
 */

import { spawn } from 'child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { clearResultFiles } from './clear-visual-test-results.js';
import { DEFAULT_VISUAL_TEST_MODE, getDefaultKeywordsForMode, getDefaultExclusions } from './visual-test-config.js';
import { generateReports } from './generate-visual-test-reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORYBOOK_PORT = process.env.STORYBOOK_PORT || '6006';
const STORYBOOK_HOST = process.env.STORYBOOK_HOST || 'localhost';

const parseEnvList = (value) =>
  (value || '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

const sanitizeSnapshotName = (storyId) => storyId.replace(/[^a-z0-9]+/gi, '-');

const getSnapshotPath = (storyId, extension) => {
  const snapshotName = `${sanitizeSnapshotName(storyId)}${extension}`;
  return path.join(
    process.cwd(),
    'playwright',
    'storybook-visual',
    '__visual_snapshots__',
    snapshotName
  );
};

const imageSnapshotExists = (storyId) => {
  return existsSync(getSnapshotPath(storyId, '.png'));
};

const positionSnapshotExists = (storyId) => {
  return existsSync(getSnapshotPath(storyId, '.positions.json'));
};

const snapshotExists = (storyId) => {
  return imageSnapshotExists(storyId);
};

const needsSnapshotUpdate = (storyId) => {
  // Need update if:
  // 1. Image snapshot doesn't exist, OR
  // 2. Image snapshot exists but position snapshot is missing (when position tracking is enabled)
  const hasImage = imageSnapshotExists(storyId);
  const hasPosition = positionSnapshotExists(storyId);
  const positionTrackingEnabled = process.env.ENABLE_POSITION_TRACKING !== 'false';
  
  if (!hasImage) {
    return true; // Need image snapshot
  }
  
  if (hasImage && !hasPosition && positionTrackingEnabled) {
    return true; // Have image but missing position snapshot
  }
  
  return false; // Both exist
};

// Check if story matches exclusion patterns
const matchesExclusionPatterns = (entry) => {
  const visualTestExclusions = parseEnvList(
    process.env.STORY_VISUAL_EXCLUSIONS || getDefaultExclusions()
  ).map((pattern) => pattern.toLowerCase());
  
  if (visualTestExclusions.length === 0) {
    return false; // No exclusions configured
  }

  const id = entry.id?.toLowerCase() ?? '';
  const displayName = entry.name?.toLowerCase() ?? '';
  const importPath = entry.importPath?.toLowerCase() ?? '';
  
  // Check if any exclusion pattern matches the story ID, name, or import path
  return visualTestExclusions.some((pattern) => 
    id.includes(pattern) || 
    displayName.includes(pattern) || 
    importPath.includes(pattern)
  );
};

const matchesVisualCriteria = (entry) => {
  const id = entry.id?.toLowerCase() ?? '';
  const storySegment = id.split('--').pop() ?? '';
  
  // Check for _visual or -visual suffix (backward compatibility)
  if (storySegment.endsWith('_visual') || storySegment.endsWith('-visual')) {
    return true;
  }

  const displayName = entry.name?.toLowerCase() ?? '';
  
  // Check for _visual or -visual suffix in display name
  if (displayName.endsWith('_visual') || displayName.endsWith('-visual')) {
    return true;
  }

  // Check if story matches any of the configured keywords
  // Respect VISUAL_TEST_MODE: lite = only _visual, full = all keywords
  const visualTestMode = process.env.VISUAL_TEST_MODE || DEFAULT_VISUAL_TEST_MODE;
  const defaultKeywords = getDefaultKeywordsForMode(visualTestMode);
  const visualTestKeywords = parseEnvList(
    process.env.STORY_VISUAL_KEYWORDS || defaultKeywords
  ).map((keyword) => keyword.toLowerCase());
  
  if (visualTestKeywords.length > 0) {
    const storyName = displayName || storySegment;
    if (visualTestKeywords.some((keyword) => storyName.includes(keyword))) {
      return true;
    }
  }

  return false;
};

const matchesPathFilters = (entry, includeStoryPaths) => {
  if (includeStoryPaths.length === 0) {
    return true;
  }

  const importPath = entry.importPath ?? '';
  return includeStoryPaths.some((segment) => importPath.includes(segment));
};

const fetchStories = async () => {
  const indexUrl = `http://${STORYBOOK_HOST}:${STORYBOOK_PORT}/index.json`;
  
  try {
    const response = await fetch(indexUrl);

    if (!response.ok) {
      throw new Error(`Unable to load Storybook index (${response.status} ${response.statusText})`);
    }

    const indexJson = await response.json();
    const entries = Object.values(indexJson.entries ?? {});
    const includeStoryPaths = parseEnvList(
      process.env.STORY_INCLUDE_PATHS || process.env.STORY_INCLUDE_PATH || ''
    );
    
    return entries
      .filter((entry) => entry.type === 'story' && entry.id)
      .filter((entry) => !matchesExclusionPatterns(entry)) // Exclude stories matching exclusion patterns
      .filter(matchesVisualCriteria)
      .filter((entry) => matchesPathFilters(entry, includeStoryPaths))
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    throw new Error(`Failed to fetch stories: ${error.message}`);
  }
};

const main = async () => {
  console.log('🔍 Finding stories needing snapshot updates...\n');
  
  try {
    // Clear result files before starting tests
    console.log('Clearing previous test results...');
    try {
      await clearResultFiles();
    } catch (error) {
      console.error('❌ Failed to clear result files:', error.message);
      console.error('Aborting to prevent mixing results from different runs');
      process.exit(1);
    }
    
    // Fetch all stories matching visual criteria
    const allStories = await fetchStories();
    console.log(`📚 Found ${allStories.length} stories matching visual test criteria`);
    
    // Filter to stories that need snapshot updates
    // This includes stories without image snapshots OR stories with image but missing position snapshots
    const storiesNeedingUpdate = allStories.filter((story) => needsSnapshotUpdate(story.id));
    
    if (storiesNeedingUpdate.length === 0) {
      console.log('✅ All stories already have complete snapshots (image and position). Nothing to generate.');
      process.exit(0);
    }
    
    // Categorize stories for better reporting
    const storiesWithoutImage = storiesNeedingUpdate.filter((story) => !imageSnapshotExists(story.id));
    const storiesMissingPosition = storiesNeedingUpdate.filter((story) => 
      imageSnapshotExists(story.id) && !positionSnapshotExists(story.id)
    );
    
    console.log(`📸 Found ${storiesNeedingUpdate.length} stories needing snapshot updates:`);
    if (storiesWithoutImage.length > 0) {
      console.log(`   ${storiesWithoutImage.length} story/stories without image snapshots:`);
      storiesWithoutImage.forEach((story, index) => {
        console.log(`      ${index + 1}. ${story.id}`);
      });
    }
    if (storiesMissingPosition.length > 0) {
      console.log(`   ${storiesMissingPosition.length} story/stories missing position snapshots:`);
      storiesMissingPosition.forEach((story, index) => {
        console.log(`      ${index + 1}. ${story.id}`);
      });
    }
    
    const storiesWithCompleteSnapshots = allStories.length - storiesNeedingUpdate.length;
    if (storiesWithCompleteSnapshots > 0) {
      console.log(`\n⏭️  Skipping ${storiesWithCompleteSnapshots} stories that already have complete snapshots`);
    }
    
    // Prepare STORY_IDS environment variable to filter stories at discovery time
    // This ensures only matching stories are discovered, preventing "Test not found" errors
    // The storyDiscovery.ts file filters by STORY_IDS BEFORE tests are generated
    const storyIds = storiesNeedingUpdate.map((story) => story.id);
    const storyIdArray = storyIds;
    const storyIdsEnv = storyIds.join(',');
    
    console.log(`\n🚀 Running Playwright to generate snapshots for ${storiesNeedingUpdate.length} stories...\n`);
    console.log(`📋 Filtering to ${storiesNeedingUpdate.length} specific stories via STORY_IDS environment variable`);
    console.log(`   This ensures tests are only generated for stories needing snapshot updates\n`);
    
    // Build the playwright command
    // We use STORY_IDS env var to filter at story discovery time (in storyDiscovery.ts)
    // This happens BEFORE tests are generated, preventing "Test not found" errors
    // The filtering logic is in playwright/storybook-visual/storyDiscovery.ts:matchesStoryIdFilters()
    const playwrightArgs = [
      'test',
      'playwright/storybook-visual/visual-tests.spec.ts',
      '--config=playwright/config/playwright.storybook.config.ts',
      '--project=chromium',
      '--update-snapshots'
    ];
    
    // Set up environment with STORY_IDS filter
    // This ensures storyDiscovery.ts only returns the stories we want to test
    // The filter happens at discovery time, so only matching tests are generated
    const envWithFilter = {
      ...process.env,
      STORY_IDS: storyIdsEnv,
      SKIP_CLEAR_AND_GENERATE: '1',
      // Ensure update mode is detected correctly
      UPDATE_SNAPSHOTS: '1',
      // Set incremental mode to only update missing snapshots
      INCREMENTAL_UPDATE_MODE: '1'
    };
    
    // Run playwright test with STORY_IDS environment variable
    // The storyDiscovery.ts file will filter stories BEFORE tests are generated
    const playwrightProcess = spawn('npx', ['playwright', ...playwrightArgs], {
      stdio: 'inherit',
      shell: true,
      env: envWithFilter
    });
    
    // Wait for process to complete
    const exitCode = await new Promise((resolve) => {
      playwrightProcess.on('exit', (code) => {
        resolve(code || 0);
      });
    });
    
    // Generate reports after tests complete
    console.log('\nGenerating test reports...');
    let reportSuccess = false;
    try {
      await generateReports(storyIdArray);
      reportSuccess = true;
    } catch (error) {
      console.error('⚠️  Failed to generate reports:', error.message);
      // Don't exit on report generation failure, continue with exit code
    }
    
    // Verify that snapshots were actually generated
    // Check both image and position snapshots
    const generatedImageSnapshots = storiesNeedingUpdate.filter((story) => imageSnapshotExists(story.id));
    const generatedPositionSnapshots = storiesNeedingUpdate.filter((story) => positionSnapshotExists(story.id));
    const positionTrackingEnabled = process.env.ENABLE_POSITION_TRACKING !== 'false';
    
    const failedToGenerateImage = storiesNeedingUpdate.filter((story) => !imageSnapshotExists(story.id)).length;
    const failedToGeneratePosition = positionTrackingEnabled 
      ? storiesNeedingUpdate.filter((story) => imageSnapshotExists(story.id) && !positionSnapshotExists(story.id)).length
      : 0;
    
    // Respect Playwright's exit code - if Playwright failed, we should fail too
    // The report generation saying "All stories passed" is misleading when Playwright exited with code 1
    if (exitCode === 0) {
      if (generatedImageSnapshots.length === 0) {
        console.log(`\n⚠️  No image snapshots were generated for ${storiesNeedingUpdate.length} stories.`);
        console.log(`   All tests were skipped. Check the logs above to see why.`);
        console.log(`   This may indicate that update mode was not detected correctly.`);
        process.exit(1);
      } else if (failedToGenerateImage > 0) {
        console.log(`\n⚠️  Only ${generatedImageSnapshots.length} of ${storiesNeedingUpdate.length} image snapshots were generated.`);
        console.log(`   ${failedToGenerateImage} story/stories were skipped. Check the logs above to see why.`);
        process.exit(1);
      } else if (positionTrackingEnabled && failedToGeneratePosition > 0) {
        console.log(`\n⚠️  Image snapshots generated, but ${failedToGeneratePosition} position snapshot(s) are still missing.`);
        console.log(`   This may indicate that position tracking was disabled during the update.`);
        process.exit(1);
      } else {
        const positionMsg = positionTrackingEnabled 
          ? ` (${generatedImageSnapshots.length} image + ${generatedPositionSnapshots.length} position)`
          : ` (${generatedImageSnapshots.length} image)`;
        console.log(`\n✅ Successfully generated snapshots for ${generatedImageSnapshots.length} stories${positionMsg}`);
        process.exit(0);
      }
    } else {
      // Playwright failed - check if it's due to "Test not found" errors or actual test failures
      if (reportSuccess) {
        console.log(`\n⚠️  Playwright exited with code ${exitCode}, but report shows all stories passed.`);
        console.log(`   This may indicate "Test not found" errors. Check the logs above for details.`);
      } else {
        console.log(`\n❌ Playwright exited with code ${exitCode}`);
      }
      if (generatedImageSnapshots.length > 0) {
        console.log(`   Note: ${generatedImageSnapshots.length} snapshot(s) were generated before the failure.`);
      }
      process.exit(exitCode);
    }
  } catch (error) {
    console.error('❌ Error running incremental visual tests:', error.message);
    if (error.message.includes('fetch') || error.message.includes('Storybook')) {
      console.error('\n💡 Make sure Storybook is running on port', STORYBOOK_PORT);
      console.error('   You can start it with: npm run storybook');
    }
    process.exit(1);
  }
};

main();

