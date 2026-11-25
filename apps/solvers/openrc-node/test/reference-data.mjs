import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

export const { parseNativeResponse } = require("../protocol.js");
export const packageDirectory = fileURLToPath(new URL("..", import.meta.url));
export const referenceDirectory = fileURLToPath(
  new URL("../../openrc/tests/data/python_reference/", import.meta.url),
);
export const METHOD_TYPE = "RADIOLOGICAL_CONSEQUENCE";
export const TOLERANCE = 1e-10;
export const exactRequired = process.env.OPENRC_EXACT === "1";

export const DATA_FILE_CASES = ["BadDataFile"];
export const FAILS_WHILE_COMPUTING = [
  "PolarNegativeSectors",
  "PolarZeroRing",
  "PolarNanRing",
  "PolarInfiniteRing",
];
export const FAILS_ONLY_WHEN_RESULTS_ARE_BUILT = ["PolarNanRingNoResults"];

const CODES_BY_PYTHON_TYPE = {
  ValueError: "OPENRC_INVALID_VALUE",
  OverflowError: "OPENRC_INVALID_VALUE",
  FileNotFoundError: "OPENRC_FILE_NOT_FOUND",
  KeyError: "OPENRC_MISSING_KEY",
  ZeroDivisionError: "OPENRC_ZERO_DIVISION",
  IndexError: "OPENRC_OUT_OF_RANGE",
};

export function codeForPythonType(pythonType) {
  const code = CODES_BY_PYTHON_TYPE[pythonType];
  assert.notEqual(code, undefined, `no solver code for ${pythonType}`);
  return code;
}

export function consequenceRequest(configText, metFileText) {
  const request = { methodType: METHOD_TYPE, configText };
  if (metFileText !== undefined) request.metFileText = metFileText;
  return { schemaVersion: "1.0.0", request };
}

export function unixLines(text) {
  return text.replaceAll("\r\n", "\n");
}

export function portable(text) {
  return text.replaceAll("\\", "/");
}

export function consoleWithoutFiles(consoleText) {
  const text = unixLines(consoleText);
  const firstBreak = text.indexOf("\n");
  const body = firstBreak === -1 ? "" : text.slice(firstBreak + 1);
  const written = body.lastIndexOf("\nResults written to: ");
  return portable(written === -1 ? body : body.slice(0, written));
}

export function consoleValue(consoleText, label) {
  const line = consoleText.split("\n").find((candidate) => candidate.startsWith(label));
  assert.notEqual(line, undefined, `no console line starts with ${JSON.stringify(label)}`);
  return line.slice(label.length);
}

export function consoleMetRecords(consoleText) {
  const line = consoleText.split("\n").find((candidate) => candidate.startsWith("  met file  : "));
  if (line === undefined) return 1;
  return Number(line.slice(line.lastIndexOf("(") + 1, line.lastIndexOf(" realizations)")));
}

export function metFileName(configText) {
  let section = "";
  for (const raw of configText.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("[") && line.endsWith("]")) {
      section = line.slice(1, -1);
      continue;
    }
    if (section !== "meteorology" || line.startsWith("#") || line.startsWith(";")) continue;
    const equals = line.indexOf("=");
    const colon = line.indexOf(":");
    const cut = equals === -1 ? colon : colon === -1 ? equals : Math.min(equals, colon);
    if (cut === -1) continue;
    if (line.slice(0, cut).trim() === "met_file") return line.slice(cut + 1).trim();
  }
  return "";
}

export function nonFiniteAsNull(json) {
  const tokens = ["-Infinity", "Infinity", "NaN"];
  const pieces = [];
  let index = 0;
  let inString = false;
  let replaced = 0;
  while (index < json.length) {
    const character = json[index];
    if (inString) {
      pieces.push(character);
      index += 1;
      if (character === "\\") {
        pieces.push(json[index]);
        index += 1;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    const token = tokens.find((candidate) => json.startsWith(candidate, index));
    if (token !== undefined) {
      pieces.push("null");
      index += token.length;
      replaced += 1;
      continue;
    }
    if (character === '"') inString = true;
    pieces.push(character);
    index += 1;
  }
  return { json: pieces.join(""), replaced };
}

export function caseNames() {
  return readdirSync(path.join(referenceDirectory, "input"))
    .filter((name) => name.endsWith(".txt"))
    .map((name) => name.slice(0, -4))
    .sort();
}

function expectedFile(name, suffix) {
  const file = path.join(referenceDirectory, "expected", `${name}${suffix}`);
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

export function readCase(name) {
  const configText = readFileSync(path.join(referenceDirectory, "input", `${name}.txt`), "utf8");
  const metName = metFileName(configText);
  const metPath = metName === "" ? undefined : path.join(referenceDirectory, metName);
  const metFileText =
    metPath !== undefined && existsSync(metPath) ? readFileSync(metPath, "utf8") : undefined;
  const consoleText = expectedFile(name, ".console.txt");
  const resultsText = expectedFile(name, ".json");
  const errorText = expectedFile(name, ".error.json");
  assert.notEqual(consoleText, undefined, `${name}: the reference has no console text`);
  const finite = resultsText === undefined ? undefined : nonFiniteAsNull(unixLines(resultsText));
  return {
    name,
    configText,
    metFileText,
    request: consequenceRequest(configText, metFileText),
    expectedConsole: consoleWithoutFiles(consoleText),
    expectedResults: finite === undefined ? undefined : JSON.parse(finite.json),
    nonFiniteCount: finite === undefined ? 0 : finite.replaced,
    expectedError: errorText === undefined ? undefined : JSON.parse(errorText),
  };
}

export class Tally {
  constructor() {
    this.compared = 0;
    this.identical = 0;
    this.nulls = 0;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function compareJson(actual, expected, floor, location, tally) {
  if (typeof expected === "number") {
    assert.equal(typeof actual, "number", `${location}: got ${JSON.stringify(actual)}`);
    tally.compared += 1;
    if (Object.is(actual, expected)) {
      tally.identical += 1;
      return;
    }
    const difference = Math.abs(actual - expected);
    const scale = Math.max(Math.abs(actual), Math.abs(expected));
    assert.ok(
      difference <= TOLERANCE * scale + floor,
      `${location}: got ${actual}, expected ${expected}`,
    );
    return;
  }
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${location}: got ${JSON.stringify(actual)}`);
    assert.equal(actual.length, expected.length, `${location}: length`);
    const isGrid =
      expected.length > 0 &&
      expected.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "number"));
    let gridFloor = floor;
    if (isGrid) {
      let peak = 0;
      for (const row of expected) for (const cell of row) peak = Math.max(peak, Math.abs(cell));
      gridFloor = 1e-12 * peak;
    }
    expected.forEach((item, index) =>
      compareJson(actual[index], item, gridFloor, `${location}[${index}]`, tally),
    );
    return;
  }
  if (isRecord(expected)) {
    assert.ok(isRecord(actual), `${location}: got ${JSON.stringify(actual)}`);
    assert.deepEqual(Object.keys(actual), Object.keys(expected), `${location}: keys`);
    for (const key of Object.keys(expected)) {
      compareJson(actual[key], expected[key], floor, `${location}.${key}`, tally);
    }
    return;
  }
  if (expected === null) tally.nulls += 1;
  assert.equal(actual, expected, location);
}

export function replaceOnce(text, search, replacement) {
  const first = text.indexOf(search);
  assert.notEqual(first, -1, `${JSON.stringify(search)} is not in the text`);
  assert.equal(text.indexOf(search, first + 1), -1, `${JSON.stringify(search)} is in the text twice`);
  return text.slice(0, first) + replacement + text.slice(first + search.length);
}

export function referenceConfig(name) {
  return unixLines(readFileSync(path.join(referenceDirectory, "input", `${name}.txt`), "utf8"));
}

export function exampleConfig() {
  return referenceConfig("Example");
}
