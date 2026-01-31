#!/usr/bin/env node

/**
 * Central report generation script for visual tests
 * Reads results from JSONL files and generates JSON and HTML reports
 * 
 * Usage:
 *   node scripts/visual-tests/generate-visual-test-reports.js [testedStoryIds...]
 * 
 * If testedStoryIds are provided, only failures for those stories will be included.
 * Otherwise, all failures from JSONL files will be included.
 */

import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { fileURLToPath } from 'url';
import { DEFAULT_VISUAL_KEYWORDS, DEFAULT_VISUAL_TEST_MODE, getDefaultKeywordsForMode, getDefaultExclusions } from './visual-test-config.js';

// Helper function to parse comma-separated environment variable lists
const parseEnvList = (value) =>
  (value || '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

// Fetch stories from Storybook (duplicated from storyDiscovery.ts to avoid TypeScript import issues)
// If includeAllMatching is true, returns all stories matching criteria regardless of snapshot existence
// If false, only returns stories that have snapshots (for verify mode)
const fetchStories = async (includeAllMatching = false) => {
  const STORYBOOK_PORT = process.env.STORYBOOK_PORT || '6006';
  const STORYBOOK_HOST = process.env.STORYBOOK_HOST || 'localhost';
  const indexUrl = `http://${STORYBOOK_HOST}:${STORYBOOK_PORT}/index.json`;
  
  const includeStoryPaths = parseEnvList(
    process.env.STORY_INCLUDE_PATHS || process.env.STORY_INCLUDE_PATH || ''
  );
  const includeStoryIds = parseEnvList(process.env.STORY_IDS || '');
  const visualTestMode = process.env.VISUAL_TEST_MODE || DEFAULT_VISUAL_TEST_MODE;
  const defaultKeywords = getDefaultKeywordsForMode(visualTestMode);
  const visualKeywords = parseEnvList(
    process.env.STORY_VISUAL_KEYWORDS || defaultKeywords
  );
  
  const matchesPathFilters = (entry) => {
    if (includeStoryPaths.length === 0) {
      return true;
    }
    const importPath = entry.importPath ?? '';
    return includeStoryPaths.some((segment) => importPath.includes(segment));
  };
  
  const matchesStoryIdFilters = (entry) => {
    if (includeStoryIds.length === 0) {
      return true;
    }
    return includeStoryIds.includes(entry.id);
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
    
    // Check for _visual or -visual suffix
    if (storySegment.endsWith('_visual') || storySegment.endsWith('-visual')) {
      return true;
    }
    
    // In lite mode, only _visual stories
    if (visualTestMode === 'lite') {
      return false;
    }
    
    // In full mode, check keywords
    if (visualKeywords.length > 0) {
      return visualKeywords.some((keyword) =>
        storySegment.includes(keyword.toLowerCase())
      );
    }
    
    return false;
  };
  
  try {
    const response = await fetch(indexUrl);
    if (!response.ok) {
      throw new Error(`Unable to load Storybook index (${response.status} ${response.statusText})`);
    }
    
    const indexJson = await response.json();
    const entries = Object.values(indexJson.entries ?? {});
    let filtered = entries
      .filter((entry) => entry.type === 'story' && entry.id)
      .filter((entry) => !matchesExclusionPatterns(entry)) // Exclude stories matching exclusion patterns
      .filter(matchesVisualCriteria)
      .filter(matchesPathFilters)
      .filter(matchesStoryIdFilters);
    
    // If includeAllMatching is false, filter to only stories with snapshots (verify mode)
    if (!includeAllMatching) {
      filtered = filtered.filter((entry) => hasReferenceSnapshot(entry.id));
    }
    
    return filtered.sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    throw new Error(`Failed to fetch stories: ${error.message}`);
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper functions
const getFailuresFile = () =>
  path.join(process.cwd(), 'logs', 'visual-test-failures.jsonl');
const getPassedFile = () =>
  path.join(process.cwd(), 'logs', 'visual-test-passed.jsonl');
const getIgnoredFile = () =>
  path.join(process.cwd(), 'logs', 'visual-test-ignored.jsonl');
const getSkippedFile = () =>
  path.join(process.cwd(), 'logs', 'visual-test-skipped.jsonl');

const sanitizeSnapshotName = (storyId) => storyId.replace(/[^a-z0-9]+/gi, '-');

// Helper to check if reference snapshot exists for a story
// Returns true if either an image snapshot (.png) or a position snapshot (.positions.json) exists
const hasReferenceSnapshot = (storyId) => {
  const snapshotDir = path.join(
    process.cwd(),
    'playwright',
    'storybook-visual',
    '__visual_snapshots__',
  );
  const sanitizedId = sanitizeSnapshotName(storyId);
  const imageSnapshotPath = path.join(snapshotDir, `${sanitizedId}.png`);
  const positionSnapshotPath = path.join(snapshotDir, `${sanitizedId}.positions.json`);
  // Story is considered to have a reference snapshot if either image or position snapshot exists
  return fs.existsSync(imageSnapshotPath) || fs.existsSync(positionSnapshotPath);
};

const escapeHtml = (text) => {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

// Read all results from JSONL files
const readAllFailuresFromFile = async () => {
  try {
    const failuresFile = getFailuresFile();
    if (!fs.existsSync(failuresFile)) {
      return [];
    }
    const content = await fsPromises.readFile(failuresFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const failures = lines.map((line) => JSON.parse(line));
    // Deduplicate by story ID
    return Array.from(new Map(failures.map((f) => [f.id, f])).values());
  } catch (error) {
    console.warn(
      `[visual-tests] Failed to read failures from file: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
};

const readAllPassedFromFile = async () => {
  try {
    const passedFile = getPassedFile();
    if (!fs.existsSync(passedFile)) {
      return [];
    }
    const content = await fsPromises.readFile(passedFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const passed = lines.map((line) => JSON.parse(line));
    // Deduplicate
    return Array.from(new Set(passed.map((p) => p.id)));
  } catch (error) {
    return [];
  }
};

const readAllIgnoredFromFile = async () => {
  try {
    const ignoredFile = getIgnoredFile();
    if (!fs.existsSync(ignoredFile)) {
      return [];
    }
    const content = await fsPromises.readFile(ignoredFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const ignored = lines.map((line) => JSON.parse(line));
    // Deduplicate by story ID
    return Array.from(new Map(ignored.map((i) => [i.id, i])).values());
  } catch (error) {
    return [];
  }
};

const readAllSkippedFromFile = async () => {
  try {
    const skippedFile = getSkippedFile();
    if (!fs.existsSync(skippedFile)) {
      return [];
    }
    const content = await fsPromises.readFile(skippedFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const skipped = lines.map((line) => JSON.parse(line));
    // Deduplicate by story ID
    return Array.from(new Map(skipped.map((s) => [s.id, s])).values());
  } catch (error) {
    return [];
  }
};

// Save JSON results
const saveResultsJSON = async (failures, passed, ignored, skipped, totalStories) => {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    await fsPromises.mkdir(logDir, { recursive: true });

    const results = {
      timestamp: new Date().toISOString(),
      totalStories: totalStories,
      failures: failures.map((f) => ({
        id: f.id,
        importPath: f.importPath,
        message: f.message,
        screenshotPath: f.screenshotPath,
        positionDiffs: f.positionDiffs,
        importPath: f.importPath,
        message: f.message,
        screenshotPath: f.screenshotPath,
      })),
      passed: passed,
      ignored: ignored.map((i) => ({
        id: i.id,
        importPath: i.importPath,
        message: i.message,
        pattern: i.pattern,
      })),
      skipped: skipped.map((s) => ({
        id: s.id,
        importPath: s.importPath,
        message: s.message,
        reason: s.reason,
      })),
    };

    const jsonPath = path.join(logDir, 'visual-test-results.json');
    await fsPromises.writeFile(jsonPath, JSON.stringify(results, null, 2), {
      encoding: 'utf8',
    });
    return jsonPath;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[visual-tests] Failed to save JSON results: ${errorMsg}`);
    return null;
  }
};

// Generate HTML report
const generateHTMLReport = async (failures) => {
  if (failures.length === 0) {
    return null;
  }

  try {
    const logDir = path.join(process.cwd(), 'logs');
    const snapshotDir = path.join(
      process.cwd(),
      'playwright',
      'storybook-visual',
      '__visual_snapshots__',
    );

    const reportPath = path.join(logDir, 'visual-test-report.html');

    // Deduplicate failures by story ID (keep the first occurrence)
    const uniqueFailures = Array.from(
      new Map(failures.map((f) => [f.id, f])).values(),
    );

    // Filter out failures where reference snapshot doesn't exist
    // These tests should have been skipped, so they shouldn't appear in the failure report
    const failuresWithSnapshots = uniqueFailures.filter((failure) => {
      const sanitizedId = sanitizeSnapshotName(failure.id);
      const referenceSnapshotPath = path.join(
        snapshotDir,
        `${sanitizedId}.png`,
      );
      return fs.existsSync(referenceSnapshotPath);
    });

    // If all failures were filtered out, return early
    if (failuresWithSnapshots.length === 0) {
      return null;
    }

    const rows = failuresWithSnapshots.map((failure) => {
      const sanitizedId = sanitizeSnapshotName(failure.id);
      const referenceSnapshotPath = path.join(
        snapshotDir,
        `${sanitizedId}.png`,
      );
      const referenceSnapshotExists = fs.existsSync(referenceSnapshotPath);

      // Get relative paths for HTML (normalize to forward slashes for cross-platform compatibility)
      const referenceSnapshotRelative = referenceSnapshotExists
        ? path.relative(logDir, referenceSnapshotPath).replace(/\\/g, '/')
        : null;
      const errorScreenshotRelative = failure.screenshotPath
        ? path.relative(logDir, failure.screenshotPath).replace(/\\/g, '/')
        : null;

      return {
        storyId: failure.id,
        importPath: failure.importPath || 'unknown',
        message: failure.message,
        referenceSnapshot: referenceSnapshotRelative,
        errorScreenshot: errorScreenshotRelative,
        hasReference: referenceSnapshotExists,
        hasError: !!errorScreenshotRelative,
        positionDiffs: failure.positionDiffs || [],
      };
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual Test Failures Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      color: #333;
    }
    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #d32f2f;
      margin-bottom: 10px;
    }
    .summary {
      color: #666;
      font-size: 14px;
    }
    .failure {
      background: white;
      margin-bottom: 20px;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .failure-header {
      background: #fff3cd;
      padding: 15px 20px;
      border-bottom: 1px solid #ffc107;
    }
    .failure-title {
      font-weight: 600;
      color: #856404;
      margin-bottom: 5px;
    }
    .failure-path {
      font-size: 12px;
      color: #856404;
      font-family: monospace;
      margin-bottom: 5px;
    }
    .failure-message {
      font-size: 13px;
      color: #856404;
      margin-top: 5px;
    }
    .comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
    }
    .image-container {
      padding: 20px;
      text-align: center;
      background: #fafafa;
    }
    .image-container:first-child {
      border-right: 1px solid #e0e0e0;
    }
    .image-label {
      font-weight: 600;
      margin-bottom: 10px;
      color: #333;
      font-size: 14px;
    }
    .image-container img {
      max-width: 100%;
      height: auto;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .missing {
      color: #999;
      font-style: italic;
      padding: 40px;
    }
    .single-image {
      grid-column: 1 / -1;
    }
    .position-diffs {
      margin-top: 20px;
      padding: 20px;
      background: #fff3cd;
      border-top: 1px solid #ffc107;
    }
    .position-diffs-title {
      font-weight: 600;
      color: #856404;
      margin-bottom: 15px;
      font-size: 14px;
    }
    .position-diffs-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .position-diffs-table th {
      background: #ffc107;
      color: #856404;
      padding: 8px;
      text-align: left;
      font-weight: 600;
      border: 1px solid #ffc107;
    }
    .position-diffs-table td {
      padding: 8px;
      border: 1px solid #ffc107;
      background: white;
    }
    .position-diffs-table tr:nth-child(even) td {
      background: #fffbf0;
    }
    .delta-positive {
      color: #d32f2f;
      font-weight: 600;
    }
    .delta-negative {
      color: #1976d2;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Visual Test Failures Report</h1>
    <div class="summary">Generated: ${new Date().toLocaleString()}</div>
    <div class="summary">Total Failures: ${failuresWithSnapshots.length}${failures.length !== uniqueFailures.length ? ` (${failures.length} entries, ${failures.length - uniqueFailures.length} duplicates removed)` : ''}${uniqueFailures.length !== failuresWithSnapshots.length ? ` (${uniqueFailures.length - failuresWithSnapshots.length} failures without reference snapshots excluded)` : ''}</div>
  </div>

  ${rows
    .map(
      (row) => `
    <div class="failure">
      <div class="failure-header">
        <div class="failure-title">${escapeHtml(row.storyId)}</div>
        <div class="failure-path">${escapeHtml(row.importPath)}</div>
        <div class="failure-message">${escapeHtml(row.message)}</div>
      </div>
      <div class="comparison ${!row.hasReference || !row.hasError ? 'single-image' : ''}">
        <div class="image-container">
          <div class="image-label">Reference Snapshot</div>
          ${
            row.hasReference && row.referenceSnapshot
              ? `<img src="${escapeHtml(row.referenceSnapshot)}" alt="Reference snapshot" />`
              : `<div class="missing">Reference snapshot not found</div>`
          }
        </div>
        ${
          row.hasReference && row.hasError
            ? `
        <div class="image-container">
          <div class="image-label">Error Screenshot</div>
          ${
            row.errorScreenshot
              ? `<img src="${escapeHtml(row.errorScreenshot)}" alt="Error screenshot" />`
              : `<div class="missing">Error screenshot not available</div>`
          }
        </div>
        `
            : row.hasError && row.errorScreenshot
              ? `
        <div class="image-container">
          <div class="image-label">Error Screenshot</div>
          <img src="${escapeHtml(row.errorScreenshot)}" alt="Error screenshot" />
        </div>
        `
              : ''
        }
      </div>
      ${
        row.positionDiffs && row.positionDiffs.length > 0
          ? `
      <div class="position-diffs">
        <div class="position-diffs-title">Element Position Differences (${row.positionDiffs.length} element(s) moved)</div>
        <table class="position-diffs-table">
          <thead>
            <tr>
              <th>Element (testId)</th>
              <th>Expected Position</th>
              <th>Actual Position</th>
              <th>Delta (X, Y)</th>
              <th>Size Change</th>
            </tr>
          </thead>
          <tbody>
            ${row.positionDiffs
              .map(
                (diff) => `
            <tr>
              <td><code>${escapeHtml(diff.testId)}</code></td>
              <td>
                ${
                  diff.expected.visible
                    ? `(${diff.expected.x}, ${diff.expected.y})`
                    : '<em>Element was removed</em>'
                }
              </td>
              <td>
                ${
                  diff.actual.visible
                    ? `(${diff.actual.x}, ${diff.actual.y})`
                    : '<em>Element was added</em>'
                }
              </td>
              <td>
                ${
                  diff.expected.visible && diff.actual.visible
                    ? `<span class="delta-positive">+${diff.deltaX}px, +${diff.deltaY}px</span>`
                    : '<em>N/A</em>'
                }
              </td>
              <td>
                ${
                  diff.expected.visible && diff.actual.visible
                    ? `W: ${diff.deltaWidth > 0 ? '+' : ''}${diff.deltaWidth}px, H: ${diff.deltaHeight > 0 ? '+' : ''}${diff.deltaHeight}px`
                    : '<em>N/A</em>'
                }
              </td>
            </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
      `
          : ''
      }
    </div>
  `,
    )
    .join('')}
</body>
</html>`;

    await fsPromises.writeFile(reportPath, html, { encoding: 'utf8' });
    return reportPath;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[visual-tests] Failed to generate HTML report: ${errorMsg}`);
    return null;
  }
};

// Main function to generate reports
export const generateReports = async (testedStoryIds = null) => {
  try {
    // Wait a bit to ensure all workers have finished writing their results to files
    // This gives other workers time to complete their tests and write results
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Read all results from files
    const fileFailures = await readAllFailuresFromFile();
    const filePassed = await readAllPassedFromFile();
    const fileIgnored = await readAllIgnoredFromFile();
    const fileSkipped = await readAllSkippedFromFile();

    // Filter to only include stories that were tested in this run (if provided)
    let filteredFailures = fileFailures;
    let filteredPassed = filePassed;
    let filteredIgnored = fileIgnored;
    let filteredSkipped = fileSkipped;
    let totalStories = fileFailures.length + filePassed.length + fileIgnored.length + fileSkipped.length;

    if (testedStoryIds && testedStoryIds.length > 0) {
      const testedStoryIdsSet = new Set(testedStoryIds);
      filteredFailures = fileFailures.filter((f) => testedStoryIdsSet.has(f.id));
      filteredPassed = filePassed.filter((id) => testedStoryIdsSet.has(id));
      filteredIgnored = fileIgnored.filter((i) => testedStoryIdsSet.has(i.id));
      filteredSkipped = fileSkipped.filter((s) => testedStoryIdsSet.has(s.id));
      
      // Get total stories count from Storybook if available (all matching stories, not just with snapshots)
      try {
        const allMatchingStories = await fetchStories(true);
        totalStories = allMatchingStories.length;
      } catch (error) {
        // If we can't fetch, use the count from results
        totalStories = filteredFailures.length + filteredPassed.length + filteredIgnored.length + filteredSkipped.length;
      }
    } else {
      // If no tested story IDs provided, filter failures based on currently discoverable stories
      // This ensures we only report failures for stories that would be tested now
      try {
        // Get all matching stories (including those without snapshots) for total count
        const allMatchingStories = await fetchStories(true);
        totalStories = allMatchingStories.length;
        
        // Get stories with snapshots (what would actually be tested in verify mode)
        const storiesWithSnapshots = await fetchStories(false);
        const discoverableStoryIds = new Set(storiesWithSnapshots.map((s) => s.id));
        // Only include failures for stories that would currently be discovered
        filteredFailures = fileFailures.filter((f) => discoverableStoryIds.has(f.id));
        filteredPassed = filePassed.filter((id) => discoverableStoryIds.has(id));
        filteredIgnored = fileIgnored.filter((i) => discoverableStoryIds.has(i.id));
        filteredSkipped = fileSkipped.filter((s) => discoverableStoryIds.has(s.id));
      } catch (error) {
        // If we can't fetch stories from Storybook, filter based on current visual criteria configuration
        // This ensures we still filter out old failures even if Storybook isn't available
        const visualTestMode = process.env.VISUAL_TEST_MODE || DEFAULT_VISUAL_TEST_MODE;
        const defaultKeywords = getDefaultKeywordsForMode(visualTestMode);
        const visualKeywords = parseEnvList(
          process.env.STORY_VISUAL_KEYWORDS || defaultKeywords
        ).map((k) => k.toLowerCase());

        // Filter based on visual criteria matching
        const matchesVisualCriteria = (storyId) => {
          const id = storyId.toLowerCase();
          const storySegment = id.split('--').pop() ?? '';
          
          // Check for _visual or -visual suffix
          if (storySegment.endsWith('_visual') || storySegment.endsWith('-visual')) {
            return true;
          }
          
          // In lite mode, only _visual stories
          if (visualTestMode === 'lite') {
            return false;
          }
          
          // In full mode, check keywords
          if (visualKeywords.length > 0) {
            return visualKeywords.some((keyword) => storySegment.includes(keyword));
          }
          
          return false;
        };

        filteredFailures = fileFailures.filter((f) => matchesVisualCriteria(f.id));
        filteredPassed = filePassed.filter((id) => matchesVisualCriteria(id));
        filteredIgnored = fileIgnored.filter((i) => matchesVisualCriteria(i.id));
        filteredSkipped = fileSkipped.filter((s) => matchesVisualCriteria(s.id));
        totalStories = filteredFailures.length + filteredPassed.length + filteredIgnored.length + filteredSkipped.length;
        
        console.warn(
          `[visual-tests] Could not fetch stories from Storybook, filtering based on current configuration (mode: ${visualTestMode}, keywords: ${visualKeywords.join(',') || 'none'})`,
        );
      }
    }

    // Deduplicate failures by story ID
    const allFailures = Array.from(
      new Map(filteredFailures.map((f) => [f.id, f])).values(),
    );

    // Filter out failures where reference snapshot doesn't exist
    // These tests should have been skipped, so they shouldn't appear in reports
    const failuresWithSnapshots = allFailures.filter((failure) =>
      hasReferenceSnapshot(failure.id),
    );

    const excludedCount = allFailures.length - failuresWithSnapshots.length;
    if (excludedCount > 0) {
      console.log(
        `[visual-tests] Excluded ${excludedCount} failure(s) without reference snapshots (tests should have been skipped)`,
      );
    }

    // Identify stories that match visual criteria but don't have snapshots
    // These were filtered out by storyDiscovery.ts and never tested
    // Only do this if we're not in update mode (in update mode, all matching stories are tested)
    const isUpdateMode = process.env.UPDATE_SNAPSHOTS === '1' || 
                         process.env.UPDATE_SNAPSHOTS === 'true' ||
                         process.argv.includes('--update-snapshots');
    
    if (!isUpdateMode) {
      try {
        // Fetch all stories matching visual criteria (regardless of snapshot existence)
        const allMatchingStories = await fetchStories(true);
        
        // Get set of stories that were actually tested
        const testedStoryIds = new Set([
          ...filteredPassed,
          ...filteredFailures.map((f) => f.id),
          ...filteredIgnored.map((i) => i.id),
          ...filteredSkipped.map((s) => s.id),
        ]);
        
        // Find stories that match criteria but weren't tested (because they don't have snapshots)
        const missingSnapshotStories = allMatchingStories.filter((story) => {
          // Story matches criteria but wasn't tested
          if (testedStoryIds.has(story.id)) {
            return false; // Already tested
          }
          // Story doesn't have a snapshot (that's why it wasn't tested)
          return !hasReferenceSnapshot(story.id);
        });
        
        // Add missing snapshot stories to skipped list
        if (missingSnapshotStories.length > 0) {
          const missingSnapshotSkipped = missingSnapshotStories.map((story) => ({
            id: story.id,
            importPath: story.importPath,
            message: `Snapshot not found: ${sanitizeSnapshotName(story.id)}.png`,
            reason: 'snapshot_not_found',
          }));
          
          // Merge with existing skipped stories (avoid duplicates)
          const existingSkippedIds = new Set(filteredSkipped.map((s) => s.id));
          const newSkipped = missingSnapshotSkipped.filter((s) => !existingSkippedIds.has(s.id));
          filteredSkipped = [...filteredSkipped, ...newSkipped];
          
          // Update totalStories to include the newly identified skipped stories
          // totalStories should reflect all matching stories (including those without snapshots)
          totalStories = allMatchingStories.length;
          
          if (newSkipped.length > 0) {
            console.log(
              `[visual-tests] Found ${newSkipped.length} story/stories matching visual criteria but missing snapshots (added to skipped list)`,
            );
          }
        }
      } catch (error) {
        // If we can't fetch stories, log a warning but continue
        console.warn(
          `[visual-tests] Could not identify stories missing snapshots: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Save JSON results
    const jsonPath = await saveResultsJSON(
      failuresWithSnapshots,
      filteredPassed,
      filteredIgnored,
      filteredSkipped,
      totalStories,
    );
    if (jsonPath) {
      console.log(`[visual-tests] JSON results saved: ${jsonPath}`);
    }

    // Generate HTML report
    const reportPath = await generateHTMLReport(failuresWithSnapshots);
    if (reportPath) {
      console.log(`[visual-tests] HTML report generated: ${reportPath}`);
    }

    // Print test summary counts
    const failedCount = failuresWithSnapshots.length;
    const passedCount = filteredPassed.length;
    const ignoredCount = filteredIgnored.length;
    const skippedCount = filteredSkipped.length;
    
    console.log('\n[visual-tests] Test Summary:');
    console.log(`  Failed:  ${failedCount}`);
    console.log(`  Passed: ${passedCount}`);
    console.log(`  Ignored: ${ignoredCount}`);
    console.log(`  Skipped: ${skippedCount}`);
    console.log(`  Total:   ${totalStories}`);

    // Log summaries
    if (filteredIgnored.length > 0) {
      const ignoredLines = filteredIgnored.map((ignored) => {
        const pathInfo = ignored.importPath ? ` (${ignored.importPath})` : '';
        return `${ignored.id}${pathInfo}: ${ignored.message} [pattern: ${ignored.pattern}]`;
      });
      console.warn(
        `[visual-tests] Ignored ${filteredIgnored.length} stories:\n${ignoredLines.join('\n')}`,
      );
    }

    if (filteredSkipped.length > 0) {
      const skippedLines = filteredSkipped.map((skipped) => {
        const pathInfo = skipped.importPath ? ` (${skipped.importPath})` : '';
        return `${skipped.id}${pathInfo}: ${skipped.message} [reason: ${skipped.reason}]`;
      });
      console.log(
        `[visual-tests] Skipped ${filteredSkipped.length} stories:\n${skippedLines.join('\n')}`,
      );
    }

    if (failuresWithSnapshots.length === 0) {
      const ignoredCount =
        filteredIgnored.length > 0 ? ` (${filteredIgnored.length} ignored)` : '';
      const skippedCount =
        filteredSkipped.length > 0 ? ` (${filteredSkipped.length} skipped)` : '';
      // Note: This message only reflects failures recorded in JSONL files.
      // If Playwright exited with code 1, there may be other errors (e.g., "Test not found")
      // that aren't captured here. Always check Playwright's exit code.
      console.log(`[visual-tests] All stories passed ✅${ignoredCount}${skippedCount}`);
    } else {
      const uniqueFailures = Array.from(
        new Map(failuresWithSnapshots.map((f) => [f.id, f])).values(),
      );
      const summaryLines = uniqueFailures.map((failure) => {
        const pathInfo = failure.importPath ? ` (${failure.importPath})` : '';
        return `${failure.id}${pathInfo}: ${failure.message}`;
      });
      console.error(
        `[visual-tests] ${uniqueFailures.length} failing stories:\n${summaryLines.join('\n')}`,
      );
    }

    return {
      failures: failuresWithSnapshots,
      passed: filteredPassed,
      ignored: filteredIgnored,
      skipped: filteredSkipped,
      totalStories,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[visual-tests] Failed to generate reports: ${errorMsg}`);
    throw error;
  }
};

// If run directly, execute report generation
const isMainModule = process.argv[1] && process.argv[1].endsWith('generate-visual-test-reports.js');
if (isMainModule) {
  // Get tested story IDs from command line args or fetch from Storybook
  const testedStoryIds = process.argv.slice(2).filter(Boolean);
  
  generateReports(testedStoryIds.length > 0 ? testedStoryIds : null)
    .catch((error) => {
      console.error('Error generating reports:', error);
      process.exit(1);
    });
}

