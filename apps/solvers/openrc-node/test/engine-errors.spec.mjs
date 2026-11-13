import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  call,
  consequenceRequest,
  exampleConfig,
  parseNativeResponse,
  referenceConfig,
  replaceOnce,
} from "./reference-helpers.mjs";

const example = exampleConfig();
const polar = referenceConfig("Polar");
const withMetFile = replaceOnce(referenceConfig("StressTest_met"), "data/example.met", "data/crafted.met");
const polarWithMetFile = replaceOnce(polar, "data/single.met", "data/crafted.met");
const craftedMetFile = path.join("data", "crafted.met");

const configCases = [
  {
    name: "a config without a section header",
    configText: "case_name = x\n",
    code: "OPENRC_CONFIG_SYNTAX",
    message: "File contains no section headers.\nfile: '<string>', line: 1\n'case_name = x\\n'",
  },
  {
    name: "a section that appears twice",
    configText: `${example}\n[run]\ncase_name = again\n`,
    code: "OPENRC_CONFIG_SYNTAX",
    message: "While reading from '<string>' [line 48]: section 'run' already exists",
  },
  {
    name: "an option that appears twice",
    configText: replaceOnce(example, "mode      = lmp", "mode      = lmp\nmode = epz"),
    code: "OPENRC_CONFIG_SYNTAX",
    message: "While reading from '<string>' [line  4]: option 'mode' in section 'run' already exists",
  },
  {
    name: "a lone percent sign",
    configText: replaceOnce(example, "case_name = test_case_001", "case_name = 100%"),
    code: "OPENRC_CONFIG_SYNTAX",
    message: "'%' must be followed by '%' or '(', found: '%'",
  },
  {
    name: "a substitution that names no option",
    configText: replaceOnce(example, "case_name = test_case_001", "case_name = %(absent)s"),
    code: "OPENRC_CONFIG_SYNTAX",
    message:
      "Bad value substitution: option 'case_name' in section 'run' contains an interpolation key " +
      "'absent' which is not a valid option name. Raw value: '%(absent)s'",
  },
  {
    name: "a line without a key",
    configText: replaceOnce(example, "case_name = test_case_001", "case_name = a\njust words"),
    code: "OPENRC_CONFIG_SYNTAX",
    message: "Source contains parsing errors: '<string>'\n\t[line  3]: 'just words\\n'",
  },
  {
    name: "a missing case name",
    configText: replaceOnce(example, "case_name = test_case_001\n", ""),
    code: "OPENRC_MISSING_KEY",
    message: "[run] is missing the option 'case_name'",
  },
  {
    name: "an unknown mode",
    configText: replaceOnce(example, "mode      = lmp", "mode      = fast"),
    code: "OPENRC_INVALID_VALUE",
    message: "[run] mode must be 'lmp' or 'epz', got 'fast'",
  },
  {
    name: "an unknown geometry",
    configText: replaceOnce(example, "mode      = lmp", "mode      = lmp\ngeometry = sphere"),
    code: "OPENRC_INVALID_VALUE",
    message: "[run] geometry must be 'centerline' or 'polar', got 'sphere'",
  },
  {
    name: "a receptor distance that is not a number",
    configText: replaceOnce(example, "x_m = 1000.0", "x_m = far"),
    code: "OPENRC_INVALID_VALUE",
    message: "[receptor] invalid or missing value for 'x_m'",
  },
  {
    name: "an activity that is not a number",
    configText: replaceOnce(example, "Cs-137 = 1.0E12", "Cs-137 = lots"),
    code: "OPENRC_INVALID_VALUE",
    message: "[source_term] invalid value for 'Cs-137': 'lots'",
  },
  {
    name: "a wind speed of zero",
    configText: replaceOnce(example, "wind_speed_m_s = 3.0", "wind_speed_m_s = 0"),
    code: "OPENRC_INVALID_VALUE",
    message: "[meteorology] wind_speed_m_s must be > 0",
  },
  {
    name: "an unknown stability class",
    configText: replaceOnce(example, "stability_class = D", "stability_class = Z"),
    code: "OPENRC_INVALID_VALUE",
    message: "[meteorology] stability_class must be A–F, got 'Z'",
  },
  {
    name: "an integration time of zero",
    configText: replaceOnce(example, "integration_time_s = 86400", "integration_time_s = 0"),
    code: "OPENRC_INVALID_VALUE",
    message: "[release] integration_time_s must be > 0",
  },
  {
    name: "nine deposition velocities",
    configText: replaceOnce(
      example,
      "deposition_velocities_by_group = 0,0.003,0.003,0.003,0.003,0.003,0.003,0.003,0,0.003",
      "deposition_velocities_by_group = 0,0.003,0.003,0.003,0.003,0.003,0.003,0.003,0",
    ),
    code: "OPENRC_INVALID_VALUE",
    message:
      "[deposition] deposition_velocities_by_group must have exactly 10 values " +
      "(one per chemical group), got 9",
  },
  {
    name: "a declared segment without its section",
    configText: replaceOnce(example, "plume_segments = 1", "plume_segments = 2"),
    code: "OPENRC_INVALID_VALUE",
    message: "Config declares 2 segment(s) but [release.segment_2] is missing",
  },
  {
    name: "a centerline run without a receptor section",
    configText: replaceOnce(example, "[receptor]\nx_m = 1000.0\ny_m = 0.0\nz_m = 0.0\n", ""),
    code: "OPENRC_INVALID_VALUE",
    message: "Config is missing required section(s): ['receptor']",
  },
  {
    name: "a release without segments",
    configText: replaceOnce(example, "plume_segments = 1", "plume_segments = 0"),
    code: "OPENRC_OUT_OF_RANGE",
    message: "list index out of range",
  },
  {
    name: "a polar grid with zero sectors",
    configText: replaceOnce(polar, "sector_count = 12", "sector_count = 0"),
    metFileText: "D,3.0,270\n",
    code: "OPENRC_ZERO_DIVISION",
    message: "integer modulo by zero",
  },
  {
    name: "a polar grid with seven sectors",
    configText: replaceOnce(polar, "sector_count = 12", "sector_count = 7"),
    metFileText: "D,3.0,270\n",
    code: "OPENRC_INVALID_VALUE",
    message: "[polar_grid] sector_count must evenly divide 360, got 7",
  },
  {
    name: "a polar grid without rings",
    configText: replaceOnce(polar, "ring_distances_m = 100, 500, 1000, 5000", "ring_distances_m = ,"),
    metFileText: "D,3.0,270\n",
    code: "OPENRC_INVALID_VALUE",
    message: "[polar_grid] ring_distances_m must list at least one distance",
  },
  {
    name: "a met row with one column",
    configText: withMetFile,
    metFileText: "D\n",
    code: "OPENRC_OUT_OF_RANGE",
    message: "list index out of range",
  },
  {
    name: "a met row with a speed that is not a number",
    configText: withMetFile,
    metFileText: "D,fast\n",
    code: "OPENRC_INVALID_VALUE",
    message: "could not convert string to float: 'fast'",
  },
  {
    name: "an empty met file text",
    configText: withMetFile,
    metFileText: "",
    code: "OPENRC_INVALID_VALUE",
    message: `Met file contains no data rows: ${craftedMetFile}`,
  },
  {
    name: "a met file text with comments only",
    configText: withMetFile,
    metFileText: "# nothing\n",
    code: "OPENRC_INVALID_VALUE",
    message: `Met file contains no data rows: ${craftedMetFile}`,
  },
  {
    name: "a polar run whose met rows have no wind direction",
    configText: polarWithMetFile,
    metFileText: "D,3.0\n",
    code: "OPENRC_INVALID_VALUE",
    message:
      "Polar grid mode requires wind_dir_deg in every met record (record 0 is missing it).  " +
      "Add wind_dir_deg to your met file or supply it in the single-trial [meteorology] section.",
  },
  {
    name: "a met file that the request does not carry",
    configText: withMetFile,
    code: "OPENRC_FILE_NOT_FOUND",
    message: `Met file not found: ${craftedMetFile}`,
  },
  {
    name: "a met file text that the config does not name",
    configText: example,
    metFileText: "D,3.0\n",
    code: "OPENRC_INVALID_VALUE",
    message: "met file text was given but [meteorology] met_file is not set",
  },
];

for (const { name, configText, metFileText, code, message } of configCases) {
  test(`reports ${name} as ${code}`, () => {
    const request = consequenceRequest(configText, metFileText);
    for (const operation of ["validate", "execute"]) {
      const output = parseNativeResponse(call(operation, request));
      assert.deepEqual(Object.keys(output), ["schemaVersion", "error"], operation);
      assert.equal(output.schemaVersion, "1.0.0", operation);
      assert.equal(output.error.kind, "SOLVER_ERROR", operation);
      assert.equal(output.error.code, code, `${operation}: ${output.error.message}`);
      assert.equal(output.error.message, message, operation);
      assert.deepEqual(output.error.details, {}, operation);
    }
  });
}

test("reports a failure inside the dose calculation at execution only", () => {
  const zeroRing = replaceOnce(polar, "ring_distances_m = 100, 500, 1000, 5000", "ring_distances_m = 0, 500");
  const request = consequenceRequest(zeroRing, "D,3.0,270\n");

  const validation = call("validate", request);
  assert.equal(validation.error, undefined);
  assert.equal(validation.result.valid, true);

  const execution = call("execute", request);
  assert.equal(execution.result, undefined);
  assert.equal(execution.error.kind, "SOLVER_ERROR");
  assert.equal(execution.error.code, "OPENRC_ZERO_DIVISION");
  assert.equal(execution.error.message, "float division by zero");
});

test("keeps working after any number of failed requests", () => {
  for (let round = 0; round < 200; round += 1) {
    const { configText, metFileText, code } = configCases[round % configCases.length];
    assert.equal(call("execute", consequenceRequest(configText, metFileText)).error.code, code);
  }
  const output = call("execute", consequenceRequest(example));
  assert.equal(output.error, undefined);
  assert.equal(output.result.results.case_name, "test_case_001");
});
