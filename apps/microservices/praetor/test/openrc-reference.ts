import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

interface OpenRcEnvelope {
  schemaVersion: string;
  request: { methodType: string; configText: string; metFileText?: string };
}

interface OpenRcReferenceError {
  type: string;
  message: string;
}

interface OpenRcReferenceCase {
  name: string;
  configText: string;
  metFileText: string | undefined;
  request: OpenRcEnvelope;
  expectedConsole: string;
  expectedResults: Json | undefined;
  nonFiniteCount: number;
  expectedError: OpenRcReferenceError | undefined;
}

interface NumberTally {
  compared: number;
  identical: number;
  nulls: number;
}

const referenceDirectory = resolve(__dirname, "../../../solvers/openrc/tests/data/python_reference");
const OPENRC_METHOD = "RADIOLOGICAL_CONSEQUENCE";
const TOLERANCE = 1e-10;
const exactRequired = process.env["OPENRC_EXACT"] === "1";
const DATA_FILE_CASES = ["BadDataFile"];
const FAILS_WHILE_COMPUTING = ["PolarNegativeSectors", "PolarZeroRing", "PolarNanRing", "PolarInfiniteRing"];
const FAILS_ONLY_WHEN_RESULTS_ARE_BUILT = ["PolarNanRingNoResults"];

const CODES_BY_PYTHON_TYPE: Record<string, string> = {
  ValueError: "OPENRC_INVALID_VALUE",
  OverflowError: "OPENRC_INVALID_VALUE",
  FileNotFoundError: "OPENRC_FILE_NOT_FOUND",
  KeyError: "OPENRC_MISSING_KEY",
  ZeroDivisionError: "OPENRC_ZERO_DIVISION",
  IndexError: "OPENRC_OUT_OF_RANGE",
};

function codeForPythonType(pythonType: string): string {
  const code = CODES_BY_PYTHON_TYPE[pythonType];
  if (code === undefined) throw new Error(`no solver code for ${pythonType}`);
  return code;
}

function consequenceRequest(configText: string, metFileText?: string): OpenRcEnvelope {
  return {
    schemaVersion: "1.0.0",
    request: { methodType: OPENRC_METHOD, configText, ...(metFileText === undefined ? {} : { metFileText }) },
  };
}

function unixLines(text: string): string {
  return text.replaceAll("\r\n", "\n");
}

function portable(text: string): string {
  return text.replaceAll("\\", "/");
}

function consoleWithoutFiles(consoleText: string): string {
  const text = unixLines(consoleText);
  const firstBreak = text.indexOf("\n");
  const body = firstBreak === -1 ? "" : text.slice(firstBreak + 1);
  const written = body.lastIndexOf("\nResults written to: ");
  return portable(written === -1 ? body : body.slice(0, written));
}

function metFileName(configText: string): string {
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

function nonFiniteAsNull(json: string): { json: string; replaced: number } {
  const tokens = ["-Infinity", "Infinity", "NaN"];
  const pieces: string[] = [];
  let index = 0;
  let inString = false;
  let replaced = 0;
  while (index < json.length) {
    const character = json.charAt(index);
    if (inString) {
      pieces.push(character);
      index += 1;
      if (character === "\\") {
        pieces.push(json.charAt(index));
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

function caseNames(): string[] {
  return readdirSync(join(referenceDirectory, "input"))
    .filter((name) => name.endsWith(".txt"))
    .map((name) => name.slice(0, -4))
    .sort();
}

function expectedFile(name: string, suffix: string): string | undefined {
  const file = join(referenceDirectory, "expected", `${name}${suffix}`);
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

function parseJson(text: string): Json {
  const value: Json = JSON.parse(text);
  return value;
}

function readCase(name: string): OpenRcReferenceCase {
  const configText = readFileSync(join(referenceDirectory, "input", `${name}.txt`), "utf8");
  const metName = metFileName(configText);
  const metPath = metName === "" ? undefined : join(referenceDirectory, metName);
  const metFileText = metPath !== undefined && existsSync(metPath) ? readFileSync(metPath, "utf8") : undefined;
  const consoleText = expectedFile(name, ".console.txt");
  const resultsText = expectedFile(name, ".json");
  const errorText = expectedFile(name, ".error.json");
  if (consoleText === undefined) throw new Error(`${name}: the reference has no console text`);
  const finite = resultsText === undefined ? undefined : nonFiniteAsNull(unixLines(resultsText));
  const expectedError: OpenRcReferenceError | undefined = errorText === undefined ? undefined : JSON.parse(errorText);
  return {
    name,
    configText,
    metFileText,
    request: consequenceRequest(configText, metFileText),
    expectedConsole: consoleWithoutFiles(consoleText),
    expectedResults: finite === undefined ? undefined : parseJson(finite.json),
    nonFiniteCount: finite === undefined ? 0 : finite.replaced,
    expectedError,
  };
}

function isRecord(value: Json | undefined): value is { [key: string]: Json } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareJson(actual: Json | undefined, expected: Json, floor: number, location: string, tally: NumberTally): void {
  if (typeof expected === "number") {
    if (typeof actual !== "number") throw new Error(`${location}: got ${JSON.stringify(actual)}`);
    tally.compared += 1;
    if (Object.is(actual, expected)) {
      tally.identical += 1;
      return;
    }
    const difference = Math.abs(actual - expected);
    const scale = Math.max(Math.abs(actual), Math.abs(expected));
    assert.ok(difference <= TOLERANCE * scale + floor, `${location}: got ${actual}, expected ${expected}`);
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) throw new Error(`${location}: got ${JSON.stringify(actual)}`);
    assert.equal(actual.length, expected.length, `${location}: length`);
    let peak = 0;
    let isGrid = expected.length > 0;
    for (const row of expected) {
      if (!Array.isArray(row)) {
        isGrid = false;
        break;
      }
      for (const cell of row) {
        if (typeof cell !== "number") isGrid = false;
        else peak = Math.max(peak, Math.abs(cell));
      }
    }
    const gridFloor = isGrid ? 1e-12 * peak : floor;
    expected.forEach((item, index) => compareJson(actual[index], item, gridFloor, `${location}[${index}]`, tally));
    return;
  }
  if (isRecord(expected)) {
    if (!isRecord(actual)) throw new Error(`${location}: got ${JSON.stringify(actual)}`);
    assert.deepEqual(Object.keys(actual), Object.keys(expected), `${location}: keys`);
    for (const key of Object.keys(expected)) {
      const item = expected[key];
      if (item !== undefined) compareJson(actual[key], item, floor, `${location}.${key}`, tally);
    }
    return;
  }
  if (expected === null) tally.nulls += 1;
  assert.equal(actual, expected, location);
}

function replaceOnce(text: string, search: string, replacement: string): string {
  const first = text.indexOf(search);
  if (first === -1) throw new Error(`${JSON.stringify(search)} is not in the text`);
  if (text.indexOf(search, first + 1) !== -1) throw new Error(`${JSON.stringify(search)} is in the text twice`);
  return text.slice(0, first) + replacement + text.slice(first + search.length);
}

function referenceConfig(name: string): string {
  return unixLines(readFileSync(join(referenceDirectory, "input", `${name}.txt`), "utf8"));
}

export {
  DATA_FILE_CASES,
  FAILS_ONLY_WHEN_RESULTS_ARE_BUILT,
  FAILS_WHILE_COMPUTING,
  OPENRC_METHOD,
  caseNames,
  codeForPythonType,
  compareJson,
  consequenceRequest,
  exactRequired,
  portable,
  readCase,
  referenceConfig,
  referenceDirectory,
  replaceOnce,
};
export type { Json, NumberTally, OpenRcEnvelope, OpenRcReferenceCase, OpenRcReferenceError };
