#!/usr/bin/env node

/**
 * Interactive script to update visual test snapshots for selected failed stories
 * Reads failures from JSONL or JSON files and allows user to select which stories to update.
 * 
 * Usage:
 *   node scripts/visual-tests/run-visual-tests-update-interactive.js
 *   npm run test:visual-tests:update-interactive
 */

import { existsSync, readFileSync, readdirSync, copyFileSync, statSync, mkdirSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'url';
import enquirer from 'enquirer';
const { MultiSelect, Confirm } = enquirer;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sanitizes story ID for use in file names
 */
function sanitizeSnapshotName(storyId) {
  return storyId.replace(/[^a-z0-9]+/gi, '-');
}

/**
 * Reads failures from JSONL file (preferred)
 * @returns {Array} Array of failure objects
 */
async function readFailuresFromJSONL() {
  const failuresFile = path.join(process.cwd(), 'logs', 'visual-test-failures.jsonl');
  
  if (!existsSync(failuresFile)) {
    return null;
  }

  try {
    const content = await readFileAsync(failuresFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const failures = lines.map((line) => JSON.parse(line));
    // Deduplicate by story ID (keep first occurrence)
    return Array.from(new Map(failures.map((f) => [f.id, f])).values());
  } catch (error) {
    console.warn(`⚠️  Failed to read JSONL file: ${error.message}`);
    return null;
  }
}

/**
 * Reads failures from JSON results file (fallback)
 * @returns {Array} Array of failure objects
 */
function readFailuresFromJSON() {
  const jsonFilePath = path.join(process.cwd(), 'logs', 'visual-test-results.json');
  
  if (!existsSync(jsonFilePath)) {
    return null;
  }

  try {
    const content = readFileSync(jsonFilePath, 'utf-8');
    const results = JSON.parse(content);
    return results.failures || [];
  } catch (error) {
    console.warn(`⚠️  Failed to read JSON file: ${error.message}`);
    return null;
  }
}

/**
 * Truncates text to a maximum length
 */
function truncate(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Formats error message for display (extracts first meaningful line)
 */
function formatErrorMessage(message) {
  if (!message) return 'No error message';
  
  // Remove ANSI escape codes
  const cleanMessage = message.replace(/\u001b\[[0-9;]*m/g, '');
  
  // Extract first line or meaningful part
  const lines = cleanMessage.split('\n').filter(Boolean);
  const firstLine = lines[0] || cleanMessage;
  
  // Truncate if too long
  return truncate(firstLine, 80);
}

/**
 * Finds the most recent screenshot for a story in logs/screenshots/
 * @param {string} storyId - The story ID
 * @returns {string|null} Path to the most recent screenshot, or null if not found
 */
function findMostRecentScreenshot(storyId) {
  const screenshotsDir = path.join(process.cwd(), 'logs', 'screenshots');
  
  if (!existsSync(screenshotsDir)) {
    return null;
  }

  const sanitizedId = sanitizeSnapshotName(storyId);
  const files = readdirSync(screenshotsDir);
  
  // Find all screenshots for this story (format: {sanitizedId}-{timestamp}.png)
  const matchingFiles = files
    .filter(file => file.startsWith(`${sanitizedId}-`) && file.endsWith('.png'))
    .map(file => {
      const filePath = path.join(screenshotsDir, file);
      const stats = statSync(filePath);
      return { file, filePath, mtime: stats.mtime };
    })
    .sort((a, b) => b.mtime - a.mtime); // Sort by modification time, newest first

  return matchingFiles.length > 0 ? matchingFiles[0].filePath : null;
}

/**
 * Copies actual snapshots to reference directory without running tests
 * @param {Array<string>} storyIds - Array of story IDs to update
 * @param {Array} failures - Array of failure objects with screenshotPath
 */
async function copySnapshotsToReference(storyIds, failures) {
  const snapshotDir = path.join(
    process.cwd(),
    'playwright',
    'storybook-visual',
    '__visual_snapshots__'
  );

  // Ensure snapshot directory exists
  if (!existsSync(snapshotDir)) {
    mkdirSync(snapshotDir, { recursive: true });
  }

  const results = {
    updated: [],
    skipped: [],
    errors: []
  };

  for (const storyId of storyIds) {
    const sanitizedId = sanitizeSnapshotName(storyId);
    const referenceImagePath = path.join(snapshotDir, `${sanitizedId}.png`);
    const referencePositionPath = path.join(snapshotDir, `${sanitizedId}.positions.json`);

    try {
      // Find the actual screenshot to copy
      const failure = failures.find(f => f.id === storyId);
      let actualScreenshotPath = null;

      // First try to use screenshotPath from failure data
      if (failure?.screenshotPath && existsSync(failure.screenshotPath)) {
        actualScreenshotPath = failure.screenshotPath;
      } else {
        // Fallback: find most recent screenshot in logs/screenshots/
        actualScreenshotPath = findMostRecentScreenshot(storyId);
      }

      if (!actualScreenshotPath || !existsSync(actualScreenshotPath)) {
        results.skipped.push({
          storyId,
          reason: 'No actual screenshot found'
        });
        console.warn(`⚠️  No screenshot found for ${storyId}`);
        continue;
      }

      // Copy image snapshot
      copyFileSync(actualScreenshotPath, referenceImagePath);
      results.updated.push({
        storyId,
        type: 'image',
        from: actualScreenshotPath,
        to: referenceImagePath
      });

      // Try to find and copy position snapshot if it exists
      // Position snapshots have the same base name as image snapshots but with .positions.json extension
      let actualPositionPath = null;
      
      // Strategy 1: Check if position snapshot exists alongside the screenshot (same directory)
      const screenshotDir = path.dirname(actualScreenshotPath);
      const screenshotBaseName = path.basename(actualScreenshotPath, '.png');
      const positionPathAlongside = path.join(screenshotDir, `${screenshotBaseName}.positions.json`);
      if (existsSync(positionPathAlongside)) {
        actualPositionPath = positionPathAlongside;
      } else {
        // Strategy 2: Look for position snapshot in test-results directory
        const testResultsDir = path.join(process.cwd(), 'logs', 'playwright', 'storybook', 'test-results');
        if (existsSync(testResultsDir)) {
          try {
            const findPositionSnapshot = (dir) => {
              const entries = readdirSync(dir, { withFileTypes: true });
              for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                  const found = findPositionSnapshot(fullPath);
                  if (found) return found;
                } else if (entry.name === `${sanitizedId}.positions.json` || 
                          entry.name.endsWith('.positions.json')) {
                  // Check if this position file might be related to our story
                  // by checking if the base name matches (without timestamp)
                  const baseName = entry.name.replace('.positions.json', '');
                  if (baseName.startsWith(sanitizedId) || baseName === sanitizedId) {
                    return fullPath;
                  }
                }
              }
              return null;
            };
            
            const foundPositionPath = findPositionSnapshot(testResultsDir);
            if (foundPositionPath && existsSync(foundPositionPath)) {
              actualPositionPath = foundPositionPath;
            }
          } catch (err) {
            // Ignore errors when searching for position snapshots
          }
        }
        
        // Strategy 3: Check in logs/screenshots/ with same pattern as screenshot
        if (!actualPositionPath) {
          const screenshotsDir = path.join(process.cwd(), 'logs', 'screenshots');
          if (existsSync(screenshotsDir)) {
            const files = readdirSync(screenshotsDir);
            // Find position files that match the screenshot pattern
            const matchingPositionFiles = files
              .filter(file => {
                const fileBase = file.replace('.positions.json', '');
                const screenshotBase = screenshotBaseName;
                // Match if base names are similar (accounting for timestamp)
                return file.endsWith('.positions.json') && 
                       (fileBase.startsWith(sanitizedId) || screenshotBase.startsWith(sanitizedId));
              })
              .map(file => {
                const filePath = path.join(screenshotsDir, file);
                const stats = statSync(filePath);
                return { file, filePath, mtime: stats.mtime };
              })
              .sort((a, b) => b.mtime - a.mtime); // Sort by modification time, newest first
            
            if (matchingPositionFiles.length > 0) {
              actualPositionPath = matchingPositionFiles[0].filePath;
            }
          }
        }
      }

      // Copy position snapshot if found
      if (actualPositionPath && existsSync(actualPositionPath)) {
        copyFileSync(actualPositionPath, referencePositionPath);
        results.updated.push({
          storyId,
          type: 'position',
          from: actualPositionPath,
          to: referencePositionPath
        });
        console.log(`   ✓ Updated image and position snapshots for ${storyId}`);
      } else {
        // Position snapshot not found - that's okay, image snapshot is the main one
        console.log(`   ✓ Updated image snapshot for ${storyId} (position snapshot not found)`);
      }

    } catch (error) {
      results.errors.push({
        storyId,
        error: error.message
      });
      console.error(`   ❌ Failed to update ${storyId}: ${error.message}`);
    }
  }

  return results;
}

/**
 * Main execution
 */
async function main() {
  console.log('📖 Loading visual test failures...\n');

  // Try JSONL first (preferred), then JSON (fallback)
  let failures = await readFailuresFromJSONL();
  let source = 'JSONL';
  
  if (!failures || failures.length === 0) {
    failures = readFailuresFromJSON();
    source = 'JSON';
  }

  if (!failures || failures.length === 0) {
    console.error('❌ No failures found in logs/visual-test-failures.jsonl or logs/visual-test-results.json');
    console.error('');
    console.error('💡 To generate failure data, run:');
    console.error('   npm run test:visual-tests');
    console.error('');
    console.error('💡 Or view existing failures in the HTML report:');
    console.error('   npm run test:visual-tests:report');
    process.exit(1);
  }

  console.log(`✅ Found ${failures.length} failure(s) from ${source} file\n`);

  // Prepare choices for enquirer
  const choices = failures.map((failure, index) => {
    const storyId = failure.id || 'unknown';
    const importPath = failure.importPath || 'unknown';
    const message = formatErrorMessage(failure.message);
    
    // Truncate import path for display
    const displayPath = truncate(importPath, 60);
    
    return {
      name: storyId,
      message: `${storyId}`,
      hint: `${displayPath} - ${message}`,
      value: storyId,
    };
  });

  // Interactive multi-select prompt
  const prompt = new MultiSelect({
    name: 'stories',
    message: 'Select stories to update snapshots (use space to select, enter to confirm)',
    choices: choices,
    limit: Math.min(choices.length, 20), // Show up to 20 at a time
    multiple: true,
    required: true,
  });

  let selectedStoryIds;
  try {
    const answer = await prompt.run();
    selectedStoryIds = Array.isArray(answer) ? answer : [answer];
  } catch (error) {
    // User cancelled (Ctrl+C)
    if (error.name === 'CancelError' || error.message?.includes('cancel')) {
      console.log('\n❌ Cancelled by user');
      process.exit(0);
    }
    throw error;
  }

  if (selectedStoryIds.length === 0) {
    console.log('\n❌ No stories selected. Exiting.');
    process.exit(0);
  }

  console.log(`\n📸 Selected ${selectedStoryIds.length} story/stories to update:\n`);
  selectedStoryIds.forEach((storyId, index) => {
    const failure = failures.find((f) => f.id === storyId);
    const pathInfo = failure?.importPath ? ` (${truncate(failure.importPath, 50)})` : '';
    console.log(`   ${index + 1}. ${storyId}${pathInfo}`);
  });

  // Confirm before updating
  const confirmPrompt = new Confirm({
    name: 'confirm',
    message: '\n⚠️  This will update snapshots for the selected stories. Continue?',
    initial: true,
  });

  const confirmed = await confirmPrompt.run();
  if (!confirmed) {
    console.log('\n❌ Update cancelled by user');
    process.exit(0);
  }

  console.log(`\n🚀 Copying actual snapshots to reference directory...\n`);
  console.log(`   This will copy the actual screenshots from the most recent test run to the reference directory.\n`);

  try {
    const results = await copySnapshotsToReference(selectedStoryIds, failures);
    
    console.log(`\n✅ Snapshot update complete!`);
    console.log(`   Updated: ${results.updated.filter(r => r.type === 'image').length} image snapshot(s)`);
    if (results.updated.some(r => r.type === 'position')) {
      console.log(`   Updated: ${results.updated.filter(r => r.type === 'position').length} position snapshot(s)`);
    }
    if (results.skipped.length > 0) {
      console.log(`   Skipped: ${results.skipped.length} story/stories (no actual screenshot found)`);
    }
    if (results.errors.length > 0) {
      console.log(`   Errors: ${results.errors.length} story/stories`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Failed to update snapshots: ${error.message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Error updating visual test snapshots:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});

