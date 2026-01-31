#!/usr/bin/env node

/**
 * Central cleanup script for visual test result files
 * Clears all intermediate files, logs, and reports from previous test runs
 * Aborts if unable to cleanup
 * 
 * Usage:
 *   node scripts/visual-tests/clear-visual-test-results.js
 */

import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Clear all result files from previous test runs
// Aborts if unable to cleanup
const clearResultFiles = async () => {
  const logDir = path.join(process.cwd(), 'logs');
  
  const filesToDelete = [
    'visual-test-failures.jsonl',
    'visual-test-passed.jsonl',
    'visual-test-ignored.jsonl',
    'visual-test-skipped.jsonl',
    'storybook-visual-results.log',
    'visual-test-results.json',
    'visual-test-report.html',
  ];
  
  const lockFiles = [
    '.visual-test-lock',
    '.visual-test-lock-complete',
    '.visual-test-report-lock',
  ];
  
  const dirsToDelete = [
    'screenshots',
  ];
  
  try {
    // Ensure logs directory exists
    await fsPromises.mkdir(logDir, { recursive: true });
    
    // Delete files
    for (const file of filesToDelete) {
      const filePath = path.join(logDir, file);
      try {
        if (fs.existsSync(filePath)) {
          await fsPromises.rm(filePath, { force: true });
        }
      } catch (error) {
        throw new Error(`Failed to delete ${file}: ${error.message}`);
      }
    }
    
    // Delete lock files
    for (const lockFile of lockFiles) {
      const lockFilePath = path.join(logDir, lockFile);
      try {
        if (fs.existsSync(lockFilePath)) {
          await fsPromises.rm(lockFilePath, { force: true });
        }
      } catch (error) {
        throw new Error(`Failed to delete lock file ${lockFile}: ${error.message}`);
      }
    }
    
    // Delete directories
    for (const dir of dirsToDelete) {
      const dirPath = path.join(logDir, dir);
      try {
        if (fs.existsSync(dirPath)) {
          await fsPromises.rm(dirPath, { recursive: true, force: true });
        }
      } catch (error) {
        throw new Error(`Failed to delete directory ${dir}: ${error.message}`);
      }
    }
    
    console.log('✅ Cleared all result files from previous runs');
  } catch (error) {
    console.error('❌ Failed to clear result files:', error.message);
    console.error('Aborting to prevent mixing results from different runs');
    process.exit(1);
  }
};

// If run directly (not imported), execute cleanup
// Check if this file is being executed directly vs imported
const isMainModule = process.argv[1] && process.argv[1].endsWith('clear-visual-test-results.js');
if (isMainModule) {
  clearResultFiles().catch((error) => {
    console.error('Error clearing result files:', error);
    process.exit(1);
  });
}

// Export for use in other scripts
export { clearResultFiles };

