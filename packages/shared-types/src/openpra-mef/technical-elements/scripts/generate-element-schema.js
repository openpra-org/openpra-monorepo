#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Get the element name from command line arguments
const element = process.argv[2];

if (!element) {
    console.error('Please specify a technical element name');
    process.exit(1);
}

// Validate element name against known elements
const validElements = [
    'core',
    'systems-analysis',
    'event-sequence-analysis',
    'data-analysis',
    'plant-operating-states-analysis',
    'initiating-event-analysis',
    'risk-integration',
    'success-criteria',
    'event-sequence-quantification',
    'mechanistic-source-term',
    'radiological-consequence-analysis',
    'integration'
];

if (!validElements.includes(element)) {
    console.error(`Invalid element name. Valid elements are: ${validElements.join(', ')}`);
    process.exit(1);
}

// Create output directory if it doesn't exist
const outputDir = path.join(process.cwd(), 'docs', 'json-schemas');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Generate schema for the specified element
try {
    const outputFile = path.join(outputDir, `${element}.json`);
    
    // The correct format for typescript-json-schema:
    // First arg: tsconfig path or source files
    // Second arg: type name (* for all types)
    // The --include option limits which files are parsed
    const command = `npx typescript-json-schema tsconfig.json "*" --include "${element}/**/*.ts" --out ${outputFile} --required --strictNullChecks --refs`;
    
    console.log(`Generating schema for ${element}...`);
    execSync(command, { stdio: 'inherit' });
    console.log(`Schema generated successfully for ${element}`);
} catch (error) {
    console.error(`Error generating schema for ${element}:`, error);
    process.exit(1);
} 