#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join } from 'path';

const packageJson = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
);
const currentVersion = packageJson.version;

console.log('Checking version consistency...');

// Check if version follows semantic versioning
const semverRegex = /^\d+\.\d+\.\d+$/;
if (!semverRegex.test(currentVersion)) {
  console.error(
    '❌ Version does not follow semantic versioning format (X.Y.Z)',
  );
  process.exit(1);
}

// Check if version in CHANGELOG.md matches
try {
  const changelog = readFileSync(join(process.cwd(), 'CHANGELOG.md'), 'utf8');
  const latestVersionMatch = changelog.match(/\[(\d+\.\d+\.\d+)\]/);

  if (!latestVersionMatch || latestVersionMatch[1] !== currentVersion) {
    console.error('❌ Version in CHANGELOG.md does not match package.json');
    console.error(
      `CHANGELOG.md: ${latestVersionMatch ? latestVersionMatch[1] : 'not found'}`,
    );
    console.error(`package.json: ${currentVersion}`);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Could not read CHANGELOG.md');
  process.exit(1);
}

console.log('✅ Version consistency check passed');
console.log(`Current version: ${currentVersion}`);
