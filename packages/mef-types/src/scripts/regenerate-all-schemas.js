#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
const elements = [
  "core",
  "systems-analysis",
  "event-sequence-analysis",
  "data-analysis",
  "plant-operating-states-analysis",
  "initiating-event-analysis",
  "risk-integration",
  "success-criteria",
  "event-sequence-quantification",
  "mechanistic-source-term",
  "radiological-consequence-analysis",
  "integration",
];
const outputDir = path.join(process.cwd(), "docs", "json-schemas");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
function isSchemaEmpty(schemaPath) {
  if (!fs.existsSync(schemaPath)) return true;
  try {
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    return !schema.definitions || Object.keys(schema.definitions).length === 0;
  } catch (e) {
    console.error(`Error reading schema ${schemaPath}:`, e);
    return true;
  }
}
let regeneratedCount = 0;
let failedCount = 0;
let skippedCount = 0;
for (const element of elements) {
  const schemaPath = path.join(outputDir, `${element}.json`);
  if (process.argv.includes("--force") || isSchemaEmpty(schemaPath)) {
    console.log(
      `Schema for ${element} ${isSchemaEmpty(schemaPath) ? "is empty or missing" : "force regeneration requested"}, regenerating...`,
    );
    try {
      execSync(`node scripts/generate-element-schema.js ${element}`, { stdio: "inherit" });
      if (isSchemaEmpty(schemaPath)) {
        console.error(`Failed to generate schema for ${element} - schema is still empty after generation.`);
        failedCount++;
      } else {
        regeneratedCount++;
      }
    } catch (error) {
      console.error(`Error generating schema for ${element}:`, error);
      failedCount++;
    }
  } else {
    console.log(`Schema for ${element} already exists and is not empty, skipping.`);
    skippedCount++;
  }
}
console.log(`\nSummary:`);
console.log(`  - Successfully regenerated: ${regeneratedCount} schemas`);
console.log(`  - Failed: ${failedCount} schemas`);
console.log(`  - Skipped (already populated): ${skippedCount} schemas`);
console.log(`  - Total: ${elements.length} schemas`);
