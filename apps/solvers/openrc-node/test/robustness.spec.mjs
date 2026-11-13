import assert from "node:assert/strict";
import test from "node:test";

import {
  addon,
  caseNames,
  consequenceRequest,
  parseNativeResponse,
  readCase,
  unixLines,
} from "./reference-helpers.mjs";

const VALUE_TOKENS = [
  "",
  "0",
  "-1",
  "nan",
  "inf",
  "-inf",
  "1e400",
  "1e-400",
  "abc",
  "%",
  "%(x)s",
  "%%",
  "1,2",
  "1,,2",
  "[",
  "=",
  ":",
  "true",
  "none",
  "9".repeat(40),
  "0x10",
  "1_0",
  "éχ",
  "A",
  "polar",
  "epz",
  "most",
  "0.0",
  "-0.0",
  "1e308",
  "5e-324",
];
const MET_TOKENS = ["", "nan", "inf", "-inf", "0", "-1", "x", "1e400", "D", "#", "400", "-0.0"];
const GARBAGE_LINES = [
  "[",
  "]",
  "[run",
  "[run]",
  "[DEFAULT]",
  "= value",
  "key",
  "key = %(key)s",
  "  continued",
  "\t",
  "geometry = polar",
  "wind_shift = true",
  "met_period_s = 0",
  "sigma_model = most",
  "mode = epz",
  "plume_segments = 3",
  "sector_count = -12",
  "ring_distances_m = 0, nan, inf",
  "\u0000",
  " ",
];

function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

function withValue(line, value) {
  const equals = line.indexOf("=");
  const colon = line.indexOf(":");
  const cut = equals === -1 ? colon : colon === -1 ? equals : Math.min(equals, colon);
  return cut === -1 ? line : `${line.slice(0, cut + 1)} ${value}`;
}

function mutateConfig(random, configText) {
  const lines = unixLines(configText).split("\n");
  const position = Math.floor(random() * lines.length);
  const other = Math.floor(random() * lines.length);
  switch (Math.floor(random() * 9)) {
    case 0:
      lines.splice(position, 1);
      break;
    case 1:
      lines.splice(position, 0, lines[other]);
      break;
    case 2:
      [lines[position], lines[other]] = [lines[other], lines[position]];
      break;
    case 3:
    case 4:
    case 5:
      lines[position] = withValue(lines[position], pick(random, VALUE_TOKENS));
      break;
    case 6:
      lines.splice(position, 0, pick(random, GARBAGE_LINES));
      break;
    case 7:
      return lines.join("\n").slice(0, Math.floor(random() * configText.length));
    default:
      lines[position] = lines[position].toUpperCase();
      break;
  }
  return lines.join("\n");
}

function mutateMet(random, metFileText) {
  const lines = unixLines(metFileText).split("\n");
  const position = Math.floor(random() * lines.length);
  switch (Math.floor(random() * 5)) {
    case 0:
      lines.splice(position, 1);
      break;
    case 1: {
      const fields = lines[position].split(",");
      fields[Math.floor(random() * fields.length)] = pick(random, MET_TOKENS);
      lines[position] = fields.join(",");
      break;
    }
    case 2:
      lines[position] = lines[position].split(",").slice(0, 1 + Math.floor(random() * 2)).join(",");
      break;
    case 3:
      return lines.join("\n").slice(0, Math.floor(random() * metFileText.length));
    default:
      lines.splice(position, 0, pick(random, MET_TOKENS));
      break;
  }
  return lines.join("\n");
}

function assertConsistent(requestJson, context, tally) {
  const validationText = addon.validate(requestJson);
  const executionText = addon.execute(requestJson);
  const validation = parseNativeResponse(JSON.parse(validationText));
  const execution = parseNativeResponse(JSON.parse(executionText));

  assert.equal(addon.execute(requestJson), executionText, `${context}: a repeat differs`);
  assert.equal(addon.validate(requestJson), validationText, `${context}: a repeat differs`);
  for (const output of [validation, execution]) {
    if (output.error === undefined) continue;
    assert.equal(output.error.kind, "SOLVER_ERROR", context);
    assert.notEqual(output.error.code, "OPENRC_PANIC", `${context}: ${output.error.message}`);
    assert.ok(output.error.code.startsWith("OPENRC_"), context);
    tally.codes.add(output.error.code);
  }

  if (validation.error !== undefined) {
    assert.deepEqual(execution, validation, `${context}: execute must fail as validate does`);
    tally.rejected += 1;
    return;
  }
  assert.equal(validation.result.valid, true, context);
  if (execution.error !== undefined) {
    tally.failedWhileComputing += 1;
    return;
  }
  assert.equal(execution.result.results.case_name, validation.result.caseName, context);
  assert.equal(execution.result.results.geometry, validation.result.geometry, context);
  assert.equal(execution.result.results.mode, validation.result.mode, context);
  assert.equal(typeof execution.result.console, "string", context);
  assert.equal(execution.result.console.includes("\r\n"), false, context);
  tally.completed += 1;
}

test("answers every damaged config with a well-formed response", () => {
  const random = generator(20261112);
  const tally = { rejected: 0, failedWhileComputing: 0, completed: 0, codes: new Set() };
  let requests = 0;
  for (const name of caseNames()) {
    const reference = readCase(name);
    for (let round = 0; round < 12; round += 1) {
      let configText = reference.configText;
      const changes = 1 + Math.floor(random() * 3);
      for (let change = 0; change < changes; change += 1) configText = mutateConfig(random, configText);
      const requestJson = JSON.stringify(consequenceRequest(configText, reference.metFileText));
      assertConsistent(requestJson, `${name} round ${round}`, tally);
      requests += 1;
    }
  }
  assert.ok(requests >= 600, `${requests} requests`);
  assert.ok(tally.rejected >= 150, `${tally.rejected} rejected`);
  assert.ok(tally.completed >= 100, `${tally.completed} completed`);
  for (const code of [
    "OPENRC_CONFIG_SYNTAX",
    "OPENRC_INVALID_VALUE",
    "OPENRC_MISSING_KEY",
    "OPENRC_FILE_NOT_FOUND",
  ]) {
    assert.ok(tally.codes.has(code), `no damaged config gave ${code}`);
  }
});

test("answers every damaged weather file with a well-formed response", () => {
  const random = generator(977);
  const tally = { rejected: 0, failedWhileComputing: 0, completed: 0, codes: new Set() };
  let requests = 0;
  for (const name of caseNames()) {
    const reference = readCase(name);
    if (reference.metFileText === undefined) continue;
    for (let round = 0; round < 16; round += 1) {
      let metFileText = reference.metFileText;
      const changes = 1 + Math.floor(random() * 3);
      for (let change = 0; change < changes; change += 1) metFileText = mutateMet(random, metFileText);
      const requestJson = JSON.stringify(consequenceRequest(reference.configText, metFileText));
      assertConsistent(requestJson, `${name} round ${round}`, tally);
      requests += 1;
    }
  }
  assert.ok(requests >= 300, `${requests} requests`);
  assert.ok(tally.rejected >= 60, `${tally.rejected} rejected`);
  assert.ok(tally.completed >= 60, `${tally.completed} completed`);
  assert.ok(tally.codes.has("OPENRC_INVALID_VALUE"));
  assert.ok(tally.codes.has("OPENRC_OUT_OF_RANGE"));
});

test("answers arbitrary request text with a well-formed response", () => {
  const random = generator(31337);
  const alphabet = '{}[]",:\\ \n\t0123456789.-+eEtrufalsnéχschemaVersionrequestmethodTypeconfigText';
  for (let round = 0; round < 2000; round += 1) {
    const length = Math.floor(random() * 120);
    let text = "";
    for (let index = 0; index < length; index += 1) text += alphabet[Math.floor(random() * alphabet.length)];
    for (const operation of ["validate", "execute"]) {
      const output = parseNativeResponse(JSON.parse(addon[operation](text)));
      assert.equal(output.result, undefined, text);
      assert.equal(output.error.kind, "VALIDATION_ERROR", text);
    }
  }
});

test("answers arbitrary config text with a well-formed response", () => {
  const random = generator(4242);
  const pieces = [
    "[run]",
    "[source_term]",
    "[receptor]",
    "[meteorology]",
    "[release]",
    "[release.segment_1]",
    "[dcf]",
    "[decay]",
    "[deposition]",
    "[outputs]",
    "[polar_grid]",
    "[DEFAULT]",
    "case_name = x",
    "mode = lmp",
    "modules = a",
    "geometry = polar",
    "Cs-137 = 1e12",
    "x_m = 1",
    "y_m = 0",
    "z_m = 0",
    "stability_class = D",
    "wind_speed_m_s = 3",
    "mixing_height_m = none",
    "met_file = a.met",
    "integration_time_s = 10",
    "plume_segments = 1",
    "delay_s = 0",
    "duration_s = 1",
    "height_m = 0",
    "release_fractions_by_group = 1,1,1,1,1,1,1,1,1,1",
    "organ = ICRP60ED",
    "path = a",
    "include_ingrowth = true",
    "simple_decay_at_receptor = true",
    "collapse_half_life_sec = 1",
    "dry_deposition_velocity_m_s = 0",
    "deposition_velocities_by_group = 0,0,0,0,0,0,0,0,0,0",
    "write_csv = true",
    "output_dir = a",
    "sector_count = 4",
    "ring_distances_m = 100",
    "",
    "# comment",
    "; comment",
    "  indented = 1",
    "%",
    "key: %(case_name)s",
  ];
  const tally = { rejected: 0, failedWhileComputing: 0, completed: 0, codes: new Set() };
  for (let round = 0; round < 1500; round += 1) {
    const count = Math.floor(random() * 60);
    const lines = [];
    for (let index = 0; index < count; index += 1) lines.push(pick(random, pieces));
    const metFileText = random() < 0.3 ? "D,3.0,270\nF,1.0,90\n" : undefined;
    const requestJson = JSON.stringify(consequenceRequest(lines.join("\n"), metFileText));
    assertConsistent(requestJson, `round ${round}`, tally);
  }
  assert.ok(tally.rejected >= 1400, `${tally.rejected} rejected`);
});
