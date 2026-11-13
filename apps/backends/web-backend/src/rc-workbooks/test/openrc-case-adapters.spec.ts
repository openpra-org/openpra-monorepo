import { readFileSync } from "fs";
import { join } from "path";
import { execute, validate } from "openrc-node";
import type { RcCaseData } from "interfaces-mef-types/rc/case-records";
import type { RcSourceTermValues } from "interfaces-mef-types/rc/source-term";
import type { RcTransportSettings } from "interfaces-mef-types/rc/transport";
import type { RcWeatherTrial } from "interfaces-mef-types/rc/weather";
import { RcResultStatisticsSchema } from "interfaces-mef-types/zod/rc/case-records";
import { currentRcCase } from "interfaces-shared-types/rc-workbooks/case-records";
import { RC_ANALYSIS } from "../../example-workbooks/seeds/rc-seed";
import { RC_ANALYSIS_HTGR } from "../../example-workbooks/seeds/rc-seed-htgr";
import {
  WorkbookOpenRcAdapterError,
  adaptOpenRcMissingDoseCoefficients,
  adaptOpenRcStatistics,
  adaptOpenRcTrialDoses,
  adaptRcCaseRequests,
  openRcChemicalGroup,
  type AdaptedOpenRcCase,
  type OpenRcJsonObject,
  type OpenRcRequestEnvelope,
} from "../openrc-case-adapters";
import {
  EPZ,
  FOUR_TRIALS,
  LMP,
  ONE_TRIAL,
  QHO,
  RECEPTOR,
  caseOf,
  delayedSource,
  exampleSettings,
  exampleSource,
  openRcReferenceCases,
  publishedCase,
  splitSettings,
  splitSource,
  trial,
  type PublishedOpenRcCase,
} from "./openrc-test-cases";

interface ReferenceDoses {
  tede_sv?: number;
  missing_dcfs?: string[];
  tede_msv?: number[];
  percentiles_msv?: { p05: number; p50: number; p95: number };
}

interface ReferenceCase {
  name: string;
  requests: OpenRcRequestEnvelope["request"][];
  doses: ReferenceDoses[];
}

interface ReferenceFile {
  reference: string;
  engine: string;
  python: string;
  platform: string;
  cases: ReferenceCase[];
}

interface EngineError {
  kind: string;
  code: string;
  message: string;
}

interface EngineAnswer {
  schemaVersion: string;
  result?: OpenRcJsonObject;
  error?: EngineError;
}

interface Realization {
  index: number;
  stability_class: string;
  wind_speed_m_s: number;
  wind_dir_deg: number | null;
  tede_msv: number;
}

interface SeriesSummary {
  case_name: string;
  mode: string;
  receptor_x_m: number;
  n_realizations: number;
  tede_msv: { p05: number; p50: number; p95: number; max: number; min: number };
  realizations: Realization[];
}

interface SingleSummary {
  case_name: string;
  mode: string;
  receptor_x_m: number;
  stability_class: string;
  wind_speed_m_s: number;
  tede_sv: number;
  lmp_tede_sv: number;
  epz_distance_m: number;
  missing_dcfs: string[];
}

const SUMMATION_TOLERANCE = 1e-12;
const REFERENCE_TOLERANCE = 1e-10;
const EXACT_REFERENCE = process.env["OPENRC_EXACT"] === "1";
const ELEMENTS = [
  "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca",
  "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn", "Ga", "Ge", "As", "Se", "Br", "Kr", "Rb", "Sr", "Y", "Zr",
  "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn", "Sb", "Te", "I", "Xe", "Cs", "Ba", "La", "Ce", "Pr", "Nd",
  "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb", "Lu", "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg",
  "Tl", "Pb", "Bi", "Po", "At", "Rn", "Fr", "Ra", "Ac", "Th", "Pa", "U", "Np", "Pu", "Am", "Cm", "Bk", "Cf", "Es", "Fm",
  "Md", "No", "Lr", "Rf", "Db", "Sg", "Bh", "Hs", "Mt", "Ds", "Rg", "Cn", "Nh", "Fl", "Mc", "Lv", "Ts", "Og",
];

function sameAsReference(actual: number, expected: number): boolean {
  return EXACT_REFERENCE ? Object.is(actual, expected) : closeTo(actual, expected, REFERENCE_TOLERANCE);
}

function adapt(caseData: RcCaseData = caseOf(), trials: readonly RcWeatherTrial[] = ONE_TRIAL, metricId = "RCM-01", receptor = RECEPTOR): AdaptedOpenRcCase {
  return adaptRcCaseRequests({ caseData, metricId, receptor, trials });
}

function refusal(work: () => object): WorkbookOpenRcAdapterError {
  try {
    work();
  } catch (error) {
    if (error instanceof WorkbookOpenRcAdapterError) return error;
    throw error;
  }
  throw new Error("The adapter accepted the input");
}

function run(request: OpenRcRequestEnvelope): EngineAnswer {
  const answer: EngineAnswer = JSON.parse(execute(JSON.stringify(request)));
  return answer;
}

function check(request: OpenRcRequestEnvelope): EngineAnswer {
  const answer: EngineAnswer = JSON.parse(validate(JSON.stringify(request)));
  return answer;
}

function resultOf(answer: EngineAnswer): OpenRcJsonObject {
  if (answer.result === undefined) throw new Error(answer.error?.message ?? "The engine returned no result");
  return answer.result;
}

function results(adapted: AdaptedOpenRcCase): OpenRcJsonObject[] {
  return adapted.requests.map((request) => resultOf(run(request)));
}

function seriesOf(result: OpenRcJsonObject): SeriesSummary {
  const summary: SeriesSummary = JSON.parse(JSON.stringify(result["results"]));
  return summary;
}

function singleOf(result: OpenRcJsonObject): SingleSummary {
  const summary: SingleSummary = JSON.parse(JSON.stringify(result["results"]));
  return summary;
}

function consoleOf(result: OpenRcJsonObject): string {
  const text = result["console"];
  return typeof text === "string" ? text : "";
}

function lineOf(text: string, key: string): string {
  const prefix = `${key} = `;
  const found = text.split("\n").find((line) => line.startsWith(prefix));
  if (found === undefined) throw new Error(`The config has no ${key}`);
  return found.slice(prefix.length);
}

function sectionOf(text: string, name: string): string[] {
  const lines = text.split("\n");
  const start = lines.indexOf(`[${name}]`);
  if (start < 0) throw new Error(`The config has no section ${name}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.length === 0);
  return end < 0 ? rest : rest.slice(0, end);
}

function closeTo(actual: number, expected: number, tolerance: number): boolean {
  return actual === expected || Math.abs(actual - expected) <= tolerance * Math.abs(expected);
}

interface HandDeck {
  name: string;
  mode: string;
  source: readonly (readonly [string, number])[];
  distance: number;
  height: number;
  meteorology: readonly string[];
  integration: number;
  segments: readonly { delay: number; duration: number; height: number; fractions: readonly number[] }[];
  velocities: readonly number[];
  ingrowth: boolean;
  parentDecay: boolean;
}

function handDeck(deck: HandDeck): string {
  const lines = [
    "[run]",
    `case_name = ${deck.name}`,
    `mode = ${deck.mode}`,
    "modules = RC01_ST, RC04_DCF, RC05_RCRE, RC10_RCAD",
    "",
    "[source_term]",
    ...deck.source.map(([name, activity]) => `${name} = ${activity.toExponential()}`),
    "",
    "[receptor]",
    `x_m = ${deck.distance.toFixed(4)}`,
    "y_m = 0.0",
    `z_m = ${deck.height.toFixed(4)}`,
    "",
    "[meteorology]",
    ...deck.meteorology,
    "",
    "[release]",
    `integration_time_s = ${deck.integration.toExponential()}`,
    `plume_segments = ${deck.segments.length}`,
    "",
    ...deck.segments.flatMap((segment, index) => [
      `[release.segment_${index + 1}]`,
      `delay_s = ${segment.delay.toExponential()}`,
      `duration_s = ${segment.duration.toExponential()}`,
      `height_m = ${segment.height.toExponential()}`,
      `release_fractions_by_group = ${segment.fractions.map((fraction) => fraction.toExponential()).join(",")}`,
      "",
    ]),
    "[dcf]",
    "organ = ICRP60ED",
    "path = data/DCF.json",
    "",
    "[decay]",
    "path = data/Chains.json",
    `include_ingrowth = ${deck.ingrowth ? "true" : "false"}`,
    `simple_decay_at_receptor = ${deck.parentDecay ? "true" : "false"}`,
    "collapse_half_life_sec = 1.0",
    "",
    "[deposition]",
    "dry_deposition_velocity_m_s = 0.003",
    `deposition_velocities_by_group = ${deck.velocities.map((velocity) => velocity.toExponential()).join(",")}`,
    "",
    "[outputs]",
    "write_csv = true",
    "output_dir = outputs",
    "",
  ];
  return lines.join("\n");
}

function handRequest(deck: HandDeck, metFileText?: string): OpenRcRequestEnvelope {
  const request = { methodType: "RADIOLOGICAL_CONSEQUENCE" as const, configText: handDeck(deck) };
  return { schemaVersion: "1.0.0", request: metFileText === undefined ? { ...request, metFileText: "" } : { ...request, metFileText } };
}

function handAnswer(deck: HandDeck, metFileText?: string): EngineAnswer {
  const envelope = handRequest(deck, metFileText);
  const body = metFileText === undefined ? { methodType: envelope.request.methodType, configText: envelope.request.configText } : envelope.request;
  const answer: EngineAnswer = JSON.parse(execute(JSON.stringify({ schemaVersion: "1.0.0", request: body })));
  return answer;
}

function nuclideByNuclide(caseData: RcCaseData, distance: number, height: number, integration: number, trials: readonly RcWeatherTrial[]): number[] {
  const source = caseData.source?.values;
  const settings = caseData.transport?.categories.find((category) => category.categoryId === caseData.categoryId)?.settings;
  if (source === undefined || settings === undefined) throw new Error("The case is incomplete");
  const weatherText = `${trials.map((entry) => `${entry.stabilityClass},${entry.windSpeedMetresPerSecond.toFixed(3)},${((entry.windTowardDegrees + 180) % 360).toFixed(3)},,${entry.mixingHeightMetres.toFixed(1)}`).join("\n")}\n`;
  const doses = trials.map(() => 0);
  for (const nuclide of source.inventory) {
    const position = source.groups.findIndex((group) => group.id === nuclide.group);
    const velocity = settings.groupVelocities.find((entry) => entry.groupId === nuclide.group)?.velocity ?? Number.NaN;
    const answer = resultOf(
      handAnswer(
        {
          name: nuclide.name,
          mode: "lmp",
          source: [[nuclide.name, nuclide.activityBq]],
          distance,
          height,
          meteorology: ["met_file = hours.met", "mixing_height_m = none"],
          integration,
          segments: source.releases.map((release) => ({
            delay: release.startSeconds ?? Number.NaN,
            duration: release.durationSeconds ?? Number.NaN,
            height: release.heightMetres ?? Number.NaN,
            fractions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(() => release.fractions[position]),
          })),
          velocities: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(() => velocity),
          ingrowth: false,
          parentDecay: true,
        },
        weatherText,
      ),
    );
    if (trials.length === 1) {
      doses[0] += singleOf(answer).tede_sv;
    } else {
      seriesOf(answer).realizations.forEach((entry, index) => {
        doses[index] += entry.tede_msv / 1000;
      });
    }
  }
  return doses;
}

const EXAMPLE_CONFIG = [
  "[run]",
  "case_name = RC-1 RCM-01",
  "mode = lmp",
  "modules = RC01_ST, RC04_DCF, RC05_RCRE, RC10_RCAD",
  "geometry = centerline",
  "",
  "[source_term]",
  "Cs-137 = 1000000000000",
  "I-131 = 1000000000000",
  "Xe-133 = 1000000000000",
  "",
  "[receptor]",
  "x_m = 1000",
  "y_m = 0",
  "z_m = 0",
  "",
  "[meteorology]",
  "met_file = weather-trials.met",
  "mixing_height_m = none",
  "",
  "[release]",
  "integration_time_s = 2592000",
  "plume_segments = 1",
  "",
  "[release.segment_1]",
  "delay_s = 0",
  "duration_s = 3600",
  "height_m = 0",
  "release_fractions_by_group = 1, 1, 0, 1, 0, 0, 0, 0, 0, 0",
  "",
  "[dcf]",
  "organ = ICRP60ED",
  "path = data/DCF.json",
  "",
  "[decay]",
  "path = data/Chains.json",
  "include_ingrowth = false",
  "simple_decay_at_receptor = true",
  "collapse_half_life_sec = 1",
  "",
  "[deposition]",
  "dry_deposition_velocity_m_s = 0.003",
  "deposition_velocities_by_group = 0, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0, 0.003",
  "",
  "[outputs]",
  "write_csv = false",
  "output_dir = outputs",
  "",
].join("\n");

const EXAMPLE_HAND_DECK: HandDeck = {
  name: "written by hand",
  mode: "lmp",
  source: [
    ["Cs-137", 1e12],
    ["I-131", 1e12],
    ["Xe-133", 1e12],
  ],
  distance: 1000,
  height: 0,
  meteorology: ["stability_class = D", "wind_speed_m_s = 3.0", "mixing_height_m = 1000.0"],
  integration: 2592000,
  segments: [{ delay: 0, duration: 3600, height: 0, fractions: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] }],
  velocities: [0, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0, 0.003],
  ingrowth: false,
  parentDecay: true,
};

describe("OpenRC chemical groups", () => {
  it("assigns every chemical element to the group that the engine releases it with", () => {
    const fractions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((group) => group / 16);
    const engineGroups = ELEMENTS.map((element) => {
      const answer = handAnswer({
        ...EXAMPLE_HAND_DECK,
        source: [[`${element}-100`, 16000]],
        segments: [{ delay: 0, duration: 3600, height: 0, fractions }],
      });
      const text = consoleOf(resultOf(answer));
      const marker = "Total released activity : ";
      const start = text.indexOf(marker) + marker.length;
      const released = Number(text.slice(start, text.indexOf(" Bq", start)));
      return released === 16000 ? undefined : released / 1000;
    });
    expect(ELEMENTS.map((element) => openRcChemicalGroup(`${element}-100`))).toEqual(engineGroups);
    expect(engineGroups.filter((group) => group !== undefined)).toHaveLength(32);
    expect(new Set(engineGroups.filter((group) => group !== undefined))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  });

  it("reads the element the way the engine does", () => {
    expect(openRcChemicalGroup("Cs-137")).toBe(2);
    expect(openRcChemicalGroup("Te-129m")).toBe(5);
    expect(openRcChemicalGroup("cs-137")).toBe(2);
    expect(openRcChemicalGroup("XE-133")).toBe(1);
    expect(openRcChemicalGroup("137Cs")).toBe(2);
    expect(openRcChemicalGroup("Co-60")).toBeUndefined();
    expect(openRcChemicalGroup("H-3")).toBeUndefined();
    expect(openRcChemicalGroup("-137")).toBeUndefined();
    expect(openRcChemicalGroup("")).toBeUndefined();
  });
});

describe("adaptRcCaseRequests", () => {
  it("writes one OpenRC request for a case whose chemical groups match the engine's", () => {
    const adapted = adapt();
    expect(adapted.requests).toHaveLength(1);
    expect(adapted.requests[0]).toEqual({
      schemaVersion: "1.0.0",
      request: {
        methodType: "RADIOLOGICAL_CONSEQUENCE",
        configText: EXAMPLE_CONFIG,
        metFileText: "stability_class,wind_speed_m_s,wind_dir_deg,u_star_m_s,mixing_height_m\nD,3,270,,1000\n",
      },
    });
    expect(adapted.trialIds).toEqual(["CONST"]);
    expect(adapted.notes).toEqual([]);
  });

  it("gives the engine a case that it accepts and reads as written", () => {
    const answer = check(adapt().requests[0]);
    expect(answer.error).toBeUndefined();
    expect(answer.result).toEqual({
      scope: "RADIOLOGICAL_CONSEQUENCE",
      valid: true,
      caseName: "RC-1 RCM-01",
      mode: "lmp",
      geometry: "centerline",
      nuclideCount: 3,
      segmentCount: 1,
      metRecordCount: 1,
    });
  });

  it("gives the same dose as the same case written by hand in the engine's own format", () => {
    const adapted = singleOf(resultOf(run(adapt().requests[0])));
    const written = singleOf(resultOf(handAnswer(EXAMPLE_HAND_DECK)));
    expect(adapted.tede_sv).toBeGreaterThan(0);
    expect(adapted.tede_sv).toBe(written.tede_sv);
    expect(adapted.lmp_tede_sv).toBe(written.lmp_tede_sv);
    expect(adapted.stability_class).toBe("D");
    expect(adapted.wind_speed_m_s).toBe(3);
    expect(adapted.receptor_x_m).toBe(1000);
  });

  it("places the receptor on the plume centerline at the given distance and height", () => {
    const config = adapt(caseOf(), ONE_TRIAL, "RCM-01", { distanceMetres: 425.5, heightMetres: 1.5 }).requests[0].request.configText;
    expect(sectionOf(config, "receptor")).toEqual(["x_m = 425.5", "y_m = 0", "z_m = 1.5"]);
    expect(lineOf(config, "geometry")).toBe("centerline");
  });

  it("runs a boundary metric in the engine's boundary mode and a distance metric in its distance mode", () => {
    const sameWindow = { ...EPZ, window: LMP.window };
    const caseData = { ...caseOf(), metrics: [LMP, sameWindow] };
    const boundary = adapt(caseData, ONE_TRIAL, "RCM-01").requests[0];
    const distance = adapt(caseData, ONE_TRIAL, "RCM-02").requests[0];
    expect(lineOf(boundary.request.configText, "mode")).toBe("lmp");
    expect(lineOf(distance.request.configText, "mode")).toBe("epz");
    expect(lineOf(distance.request.configText, "case_name")).toBe("RC-1 RCM-02");
    expect(singleOf(resultOf(run(distance))).tede_sv).toBe(singleOf(resultOf(run(boundary))).tede_sv);
  });

  it("counts the exposure window from the first release and keeps the release times from accident start", () => {
    const source = delayedSource();
    const boundary = adapt(caseOf(source)).requests[0].request.configText;
    const distance = adapt(caseOf(source), ONE_TRIAL, "RCM-02").requests[0].request.configText;
    expect(sectionOf(boundary, "release")).toEqual(["integration_time_s = 2593334.1", "plume_segments = 2"]);
    expect(sectionOf(distance, "release")).toEqual(["integration_time_s = 346934.1", "plume_segments = 2"]);
    expect(sectionOf(boundary, "release.segment_1")).toEqual([
      "delay_s = 1334.1",
      "duration_s = 3600.4",
      "height_m = 10",
      "release_fractions_by_group = 0.5, 0.25, 0, 0.125, 0, 0, 0, 0, 0, 0",
    ]);
    expect(sectionOf(boundary, "release.segment_2")).toEqual([
      "delay_s = 3677.4",
      "duration_s = 3599.3",
      "height_m = 25",
      "release_fractions_by_group = 0.25, 0.125, 0, 0.0000054657, 0, 0, 0, 0, 0, 0",
    ]);
  });

  it("gives the engine the same window whether the release starts at once or after a delay", () => {
    const delayed = exampleSource();
    delayed.releases = [{ id: 1, startSeconds: 7200, durationSeconds: 3600, heightMetres: 0, fractions: [1, 1, 1] }];
    const written = singleOf(
      resultOf(
        handAnswer({
          ...EXAMPLE_HAND_DECK,
          integration: 2592000 + 7200,
          segments: [{ delay: 7200, duration: 3600, height: 0, fractions: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] }],
        }),
      ),
    );
    const adapted = singleOf(resultOf(run(adapt(caseOf(delayed)).requests[0])));
    expect(adapted.tede_sv).toBe(written.tede_sv);
    expect(adapted.tede_sv).toBe(singleOf(resultOf(run(adapt().requests[0]))).tede_sv);
  });

  it("writes parent decay and daughter ingrowth as the engine's two decay switches", () => {
    const parent = adapt().requests[0];
    const ingrowth = adapt(caseOf(exampleSource(), { ...exampleSettings(), decayMode: "ingrowth" })).requests[0];
    expect(sectionOf(parent.request.configText, "decay")).toEqual([
      "path = data/Chains.json",
      "include_ingrowth = false",
      "simple_decay_at_receptor = true",
      "collapse_half_life_sec = 1",
    ]);
    expect(sectionOf(ingrowth.request.configText, "decay")).toEqual([
      "path = data/Chains.json",
      "include_ingrowth = true",
      "simple_decay_at_receptor = false",
      "collapse_half_life_sec = 1",
    ]);
    expect(check(ingrowth).result?.["valid"]).toBe(true);
    expect(singleOf(resultOf(run(ingrowth))).tede_sv).toBeGreaterThan(0);
  });

  it("writes one weather row per trial with the direction the wind comes from", () => {
    const trials = [
      trial("D001P01", "E", 2.2, 84.375, 140, 0.25),
      trial("D001P10", "F", 0.5, 22.5, 100, 0.25),
      trial("D001P22", "C", 4.5, 0, 758, 0.25),
      trial("D001P24", "A", 3.7, 348.75, 843.5, 0.25),
    ];
    const adapted = adapt(caseOf(), trials);
    expect(adapted.requests[0].request.metFileText).toBe(
      ["stability_class,wind_speed_m_s,wind_dir_deg,u_star_m_s,mixing_height_m", "E,2.2,264.375,,140", "F,0.5,202.5,,100", "C,4.5,180,,758", "A,3.7,168.75,,843.5", ""].join("\n"),
    );
    expect(adapted.trialIds).toEqual(["D001P01", "D001P10", "D001P22", "D001P24"]);
    expect(adapted.notes).toEqual([]);
    const summary = seriesOf(resultOf(run(adapted.requests[0])));
    expect(summary.n_realizations).toBe(4);
    expect(summary.realizations.map((entry) => [entry.index, entry.stability_class, entry.wind_speed_m_s, entry.wind_dir_deg])).toEqual([
      [0, "E", 2.2, 264.375],
      [1, "F", 0.5, 202.5],
      [2, "C", 4.5, 180],
      [3, "A", 3.7, 168.75],
    ]);
  });

  it("gives each weather trial the dose of the same weather written by hand", () => {
    const trials = [trial("T1", "E", 2.2, 84.375, 140, 0.5), trial("T2", "B", 1.4, 286.875, 177, 0.5)];
    const adapted = seriesOf(resultOf(run(adapt(caseOf(), trials).requests[0])));
    const written = trials.map((entry) =>
      singleOf(
        resultOf(
          handAnswer({
            ...EXAMPLE_HAND_DECK,
            meteorology: [`stability_class = ${entry.stabilityClass}`, `wind_speed_m_s = ${entry.windSpeedMetresPerSecond}`, `mixing_height_m = ${entry.mixingHeightMetres}`],
          }),
        ),
      ),
    );
    expect(adapted.realizations.map((entry) => entry.tede_msv)).toEqual(written.map((entry) => entry.tede_sv * 1000));
  });

  it("leaves out a nuclide with no activity without changing the dose", () => {
    const source = exampleSource();
    source.groups.push({ id: 4, name: "Tellurium" });
    source.inventory.push({ name: "Te-132", activityBq: 0, group: 4 }, { name: "Rb-88", activityBq: 0, group: 4 });
    source.releases[0].fractions.push(0.5);
    const settings = exampleSettings();
    settings.groupVelocities.push({ groupId: 4, name: "Tellurium", velocity: 0.01, basis: "analyst" });
    const adapted = adapt(caseOf(source, settings));
    expect(adapted.requests).toHaveLength(1);
    expect(adapted.requests[0].request.configText).toBe(EXAMPLE_CONFIG);
    expect(adapted.notes).toEqual([]);
  });

  it("names the nuclides that the engine has no chemical group for and leaves them out", () => {
    const source = exampleSource();
    source.inventory.push({ name: "H-3", activityBq: 5e13, group: 1 }, { name: "Co-60", activityBq: 2e11, group: 2 }, { name: "Ag-110m", activityBq: 3e10, group: 2 });
    const adapted = adapt(caseOf(source));
    expect(adapted.requests[0].request.configText).toBe(EXAMPLE_CONFIG);
    expect(adapted.notes).toEqual([
      {
        code: "NUCLIDES_WITHOUT_CHEMICAL_GROUP",
        message: "OpenRC has no chemical group for H-3, Co-60, Ag-110m and leaves them out of the dose",
        details: { nuclides: ["H-3", "Co-60", "Ag-110m"] },
      },
    ]);
  });

  it("gives the engine no dose for the nuclides it leaves out, so leaving them out changes nothing", () => {
    const withExtras = singleOf(
      resultOf(
        handAnswer({
          ...EXAMPLE_HAND_DECK,
          source: [...EXAMPLE_HAND_DECK.source, ["H-3", 5e13], ["Co-60", 2e11], ["Ag-110m", 3e10]],
        }),
      ),
    );
    expect(withExtras.tede_sv).toBe(singleOf(resultOf(handAnswer(EXAMPLE_HAND_DECK))).tede_sv);
  });

  it("notes rain and boundary weather that the engine does not model", () => {
    const trials = [trial("T1", "D", 3, 90, 1000, 0.25, 2.5), trial("T2", "D", 3, 90, 1000, 0.25), trial("T3", "D", 3, 90, 1000, 0.25, 0.1), trial("T4", "D", 3, 90, 1000, 0.25)];
    const boundary = { enabled: true, startBand: 3, windSpeedMetresPerSecond: 2, stabilityClass: "D" as const, rainMillimetresPerHour: 0, mixingHeightMetres: 1000 };
    const caseData: RcCaseData = { ...caseOf(), weather: { revision: 1, settings: {}, model: { mode: "constant", boundary } } };
    expect(adapt(caseData, trials).notes).toEqual([
      { code: "RAIN_NOT_MODELLED", message: "OpenRC has no wet deposition, so the rain in 2 of 4 weather trials is not used", details: { trials: 2, of: 4 } },
      { code: "BOUNDARY_WEATHER_NOT_MODELLED", message: "OpenRC holds the weather of a trial at every distance, so the boundary weather is not used", details: {} },
    ]);
    expect(adapt({ ...caseOf(), weather: { revision: 1, settings: {}, model: { mode: "constant", boundary: { enabled: false } } } }).notes).toEqual([]);
  });

  it("lists every note of one case in one fixed order and leaves the request as it would be without them", () => {
    const source = exampleSource();
    source.inventory.push({ name: "H-3", activityBq: 5e13, group: 1 });
    const settings = exampleSettings();
    settings.groupVelocities[0] = { groupId: 1, name: "Noble gases", velocity: 0.001, basis: "analyst" };
    const boundary = { enabled: true, startBand: 3, windSpeedMetresPerSecond: 2, stabilityClass: "D" as const, rainMillimetresPerHour: 0, mixingHeightMetres: 1000 };
    const caseData: RcCaseData = {
      ...caseOf(source, settings),
      metrics: [{ ...LMP, window: { seconds: 2592000, start: "PLUME_ARRIVAL" } }],
      weather: { revision: 1, settings: {}, model: { mode: "constant", boundary } },
    };
    const adapted = adapt(caseData, [trial("T1", "G", 3, 90, 1000, 0.75, 2.5), trial("T2", "D", 3, 90, 1000, 0.25)]);
    expect(adapted.notes.map((note) => note.code)).toEqual([
      "NUCLIDES_WITHOUT_CHEMICAL_GROUP",
      "NOBLE_GAS_VELOCITY_NOT_USED",
      "WINDOW_COUNTED_FROM_RELEASE_ONSET",
      "STABILITY_CLASS_G_RUN_AS_D",
      "TRIAL_PROBABILITIES_NOT_USED",
      "RAIN_NOT_MODELLED",
      "BOUNDARY_WEATHER_NOT_MODELLED",
    ]);
    const plain = adapt(caseOf(), [trial("T1", "G", 3, 90, 1000, 0.5), trial("T2", "D", 3, 90, 1000, 0.5)]);
    expect(adapted.requests).toEqual(plain.requests);
    expect(plain.notes.map((note) => note.code)).toEqual(["STABILITY_CLASS_G_RUN_AS_D"]);
    expect(check(adapted.requests[0]).result?.["valid"]).toBe(true);
  });

  it("splits nuclides of one engine group that are released differently into requests whose doses add up", () => {
    const adapted = adapt(caseOf(splitSource(), splitSettings()));
    expect(adapted.requests).toHaveLength(2);
    const [first, second] = adapted.requests.map((request) => request.request.configText);
    expect(lineOf(first, "case_name")).toBe("RC-1 RCM-01 part 1 of 2");
    expect(lineOf(second, "case_name")).toBe("RC-1 RCM-01 part 2 of 2");
    expect(sectionOf(first, "source_term")).toEqual(["Cs-137 = 1000000000000", "I-131 = 1000000000000", "Xe-133 = 1000000000000", "Cs-134 = 2000000000000"]);
    expect(sectionOf(second, "source_term")).toEqual(["Rb-88 = 4000000000000"]);
    expect(lineOf(first, "release_fractions_by_group")).toBe("1, 1, 0, 1, 0, 0, 0, 0, 0, 0");
    expect(lineOf(second, "release_fractions_by_group")).toBe("0, 0.25, 0, 0, 0, 0, 0, 0, 0, 0");
    expect(lineOf(first, "deposition_velocities_by_group")).toBe("0, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0, 0.003");
    expect(lineOf(second, "deposition_velocities_by_group")).toBe("0, 0.01, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0, 0.003");

    const doses = adaptOpenRcTrialDoses(results(adapted), 1);
    const alone = (name: string, activity: number, fraction: number, velocity: number): number =>
      singleOf(
        resultOf(
          handAnswer({
            ...EXAMPLE_HAND_DECK,
            source: [[name, activity]],
            segments: [{ delay: 0, duration: 3600, height: 0, fractions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(() => fraction) }],
            velocities: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(() => velocity),
          }),
        ),
      ).tede_sv;
    const expected = alone("Cs-137", 1e12, 1, 0.003) + alone("I-131", 1e12, 1, 0.003) + alone("Xe-133", 1e12, 1, 0) + alone("Cs-134", 2e12, 1, 0.003) + alone("Rb-88", 4e12, 0.25, 0.01);
    expect(closeTo(doses[0], expected, SUMMATION_TOLERANCE)).toBe(true);
  });

  it("keeps nuclides of one engine group together when they are released alike from different source groups", () => {
    const source = exampleSource();
    source.groups.push({ id: 4, name: "Rubidium" });
    source.inventory.push({ name: "Rb-88", activityBq: 4e12, group: 4 });
    source.releases[0].fractions.push(1);
    const settings = exampleSettings();
    settings.groupVelocities.push({ groupId: 4, name: "Rubidium", velocity: 0.003, basis: "analyst" });
    expect(adapt(caseOf(source, settings)).requests).toHaveLength(1);
  });

  it("brings any wind direction into the range from 0 to 360 degrees", () => {
    const trials = [trial("T1", "D", 3, -90, 1000, 0.25), trial("T2", "D", 3, 540, 1000, 0.25), trial("T3", "D", 3, 180, 1000, 0.25), trial("T4", "D", 3, 359.5, 1000, 0.25)];
    expect(adapt(caseOf(), trials).requests[0].request.metFileText.split("\n").slice(1, 5)).toEqual(["D,3,90,,1000", "D,3,0,,1000", "D,3,0,,1000", "D,3,179.5,,1000"]);
  });

  it("writes requests that the engine accepts and that add up nuclide by nuclide for 60 random source terms", () => {
    const pool = [
      "Kr-85", "Xe-133", "Xe-135", "Cs-134", "Cs-137", "Rb-88", "Ba-140", "Sr-90", "I-131", "I-133", "Te-132", "Ru-103", "Rh-105",
      "Tc-99m", "Mo-99", "Nb-95", "Zr-95", "Y-91", "Ce-144", "Pu-239", "Am-241", "Nd-147", "La-140", "Co-60", "H-3", "Sb-127",
    ];
    const classes = ["A", "B", "C", "D", "E", "F"] as const;
    let state = 20261112;
    const next = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)];
    let split = 0;
    let refused = 0;
    let requests = 0;
    for (let round = 0; round < 60; round += 1) {
      const shuffled = [...pool];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const other = Math.floor(next() * (index + 1));
        [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
      }
      const names = shuffled.slice(0, 1 + Math.floor(next() * 12));
      const keys = names.map((name) => `${openRcChemicalGroup(name) === 1 ? "noble" : "other"} ${Math.floor(next() * 4)}`);
      const distinct = [...new Set(keys)];
      const groups = distinct.map((key, index) => ({ id: index + 1, name: `Group ${key}` }));
      const source: RcSourceTermValues = {
        groups,
        inventory: names.map((name, index) => ({ name, activityBq: pick([0, 1e10, 3.5e12, 7.25e15, 1e18]), group: distinct.indexOf(keys[index]) + 1 })),
        releases: Array.from({ length: 1 + Math.floor(next() * 3) }, (_unused, index) => ({
          id: index + 1,
          startSeconds: index * 7200 + pick([0, 600, 1334.1]),
          durationSeconds: pick([60, 3600, 7200.5]),
          heightMetres: pick([0, 10, 50]),
          fractions: groups.map(() => pick([0, 0.0001, 0.01, 0.25])),
        })),
      };
      const settings: RcTransportSettings = {
        decayMode: "parent",
        groupVelocities: groups.map((group) =>
          group.name.startsWith("Group noble")
            ? { groupId: group.id, name: group.name, velocity: 0, basis: "noble_gas" }
            : { groupId: group.id, name: group.name, velocity: pick([0, 0.001, 0.003, 0.01]), basis: "analyst" },
        ),
      };
      const count = 1 + Math.floor(next() * 3);
      const trials = Array.from({ length: count }, (_unused, index) => trial(`T${index}`, pick(classes), pick([0.5, 1.4, 3, 7.5]), pick([0, 90, 222.5]), pick([100, 500, 1800]), 1 / count));
      const receptor = { distanceMetres: pick([200, 746, 5000, 20000]), heightMetres: pick([0, 1.5]) };
      const caseData = caseOf(source, settings);
      const kept = source.inventory.filter((entry) => entry.activityBq > 0 && openRcChemicalGroup(entry.name) !== undefined).map((entry) => entry.name);
      if (kept.length === 0) {
        expect(refusal(() => adapt(caseData, trials, "RCM-01", receptor)).code).toBe("RC_SOURCE_TERM_NOT_RELEASED");
        refused += 1;
        continue;
      }
      const adapted = adapt(caseData, trials, "RCM-01", receptor);
      expect(adapted.requests.every((request) => check(request).result?.["valid"] === true)).toBe(true);
      const listed = adapted.requests.flatMap((request) => sectionOf(request.request.configText, "source_term").map((line) => line.slice(0, line.indexOf(" = "))));
      expect([...listed].sort()).toEqual([...kept].sort());
      const firstStart = Math.min(...source.releases.map((release) => release.startSeconds ?? 0));
      const expected = nuclideByNuclide(caseData, receptor.distanceMetres, receptor.heightMetres, 2592000 + firstStart, trials);
      const doses = adaptOpenRcTrialDoses(results(adapted), count);
      expect(doses.every((dose, index) => closeTo(dose, expected[index], SUMMATION_TOLERANCE))).toBe(true);
      requests += adapted.requests.length;
      if (adapted.requests.length > 1) split += 1;
    }
    expect(split).toBeGreaterThanOrEqual(10);
    expect(requests).toBeGreaterThan(60 - refused);
  }, 120000);

  it("doubles every dose when every inventory doubles", () => {
    const trials = [trial("T1", "E", 2.2, 84.375, 140, 0.5), trial("T2", "B", 1.4, 286.875, 177, 0.5)];
    const doubled = exampleSource();
    doubled.inventory = doubled.inventory.map((entry) => ({ ...entry, activityBq: entry.activityBq * 2 }));
    const once = adaptOpenRcTrialDoses(results(adapt(caseOf(), trials)), 2);
    const twice = adaptOpenRcTrialDoses(results(adapt(caseOf(doubled), trials)), 2);
    expect(twice.every((dose, index) => closeTo(dose, 2 * once[index], SUMMATION_TOLERANCE))).toBe(true);
  });

  it("escapes a percent sign in the case name so the engine reads the name as written", () => {
    const adapted = adapt(caseOf(exampleSource(), exampleSettings(), "RC 100% = worst: case"));
    expect(lineOf(adapted.requests[0].request.configText, "case_name")).toBe("RC 100%% = worst: case RCM-01");
    expect(check(adapted.requests[0]).result?.["caseName"]).toBe("RC 100% = worst: case RCM-01");
  });

  it("refuses a metric that is not in the case", () => {
    const error = refusal(() => adapt(caseOf(), ONE_TRIAL, "RCM-09"));
    expect(error.code).toBe("RC_METRIC_NOT_FOUND");
    expect(error.message).toBe("Consequence metric 'RCM-09' is not part of this case");
    expect(error.details).toEqual({ metricId: "RCM-09" });
    expect(error.name).toBe("WorkbookOpenRcAdapterError");
    expect(refusal(() => adapt({ ...caseOf(), metrics: undefined })).code).toBe("RC_METRIC_NOT_FOUND");
  });

  it.each([
    ["a health risk", QHO, "OpenRC has no health-effect model yet."],
    ["a population dose", { ...LMP, quantity: "POPULATION_DOSE" as const }, "OpenRC reports dose at receptors, not population dose."],
    ["a credited protective action", { ...LMP, protectiveActionsCredited: true }, "OpenRC has no protective-action model yet."],
    ["a population average", { ...LMP, receptor: { kind: "WITHIN_RADIUS" as const, radiusKm: 16 } }, "OpenRC reports dose at receptors, not population averages."],
    ["a custom measure", { ...LMP, quantity: "CUSTOM" as const, customUnit: "Bq" }, "Custom measures are not assessed against OpenRC."],
  ])("refuses a metric with %s", (_name, metric, reason) => {
    const error = refusal(() => adapt({ ...caseOf(), metrics: [{ ...metric, id: "RCM-05" }] }, ONE_TRIAL, "RCM-05"));
    expect(error.code).toBe("RC_METRIC_NOT_SUPPORTED");
    expect(error.message).toBe(`OpenRC cannot quantify the metric '${metric.name}': ${reason}`);
    expect(error.details).toEqual({ metricId: "RCM-05", reason });
  });

  it("refuses a metric without a window", () => {
    const { window: _window, ...unbounded } = LMP;
    expect(refusal(() => adapt({ ...caseOf(), metrics: [unbounded] })).code).toBe("RC_METRIC_WINDOW_MISSING");
  });

  it("counts a window that starts at plume arrival from release onset, as the engine does, and says so", () => {
    const arrival = adapt({ ...caseOf(), metrics: [{ ...LMP, window: { seconds: 2592000, start: "PLUME_ARRIVAL" } }] });
    expect(arrival.requests).toEqual(adapt().requests);
    expect(arrival.notes).toEqual([
      {
        code: "WINDOW_COUNTED_FROM_RELEASE_ONSET",
        message: "OpenRC counts the exposure window from release onset, so the plume arrival start of the metric '30-day dose at the EAB' is not used",
        details: { metricId: "RCM-01" },
      },
    ]);
  });

  it("refuses a case without a source term or without saved transport settings", () => {
    const { source: _source, ...sourceless } = caseOf();
    const missingSource = refusal(() => adapt(sourceless));
    expect(missingSource.code).toBe("RC_SOURCE_TERM_MISSING");
    expect(missingSource.message).toBe("Release category 'RC-1' has no source term");
    const { transport: _transport, ...untransported } = caseOf();
    expect(refusal(() => adapt(untransported)).code).toBe("RC_TRANSPORT_SETTINGS_MISSING");
    const other = caseOf();
    const elsewhere: RcCaseData = { ...other, transport: { revision: 1, decayFiles: [], categories: [{ categoryId: "RC-2", settings: exampleSettings() }] } };
    const missingSettings = refusal(() => adapt(elsewhere));
    expect(missingSettings.code).toBe("RC_TRANSPORT_SETTINGS_MISSING");
    expect(missingSettings.message).toBe("Release category 'RC-1' has no saved deposition velocities and decay mode");
  });

  it.each([
    ["a name the config format cannot carry", (source: RcSourceTermValues) => source.inventory.push({ name: "Cs=137", activityBq: 1, group: 2 })],
    ["a name with a line break", (source: RcSourceTermValues) => source.inventory.push({ name: "Cs-137\nI-131", activityBq: 1, group: 2 })],
    ["an empty name", (source: RcSourceTermValues) => source.inventory.push({ name: "", activityBq: 1, group: 2 })],
    ["the same nuclide twice", (source: RcSourceTermValues) => source.inventory.push({ name: "Cs-137", activityBq: 1, group: 2 })],
    ["a negative inventory", (source: RcSourceTermValues) => source.inventory.push({ name: "Cs-134", activityBq: -1, group: 2 })],
    ["an inventory that is not finite", (source: RcSourceTermValues) => source.inventory.push({ name: "Cs-134", activityBq: Number.POSITIVE_INFINITY, group: 2 })],
    ["an inventory that is not a number", (source: RcSourceTermValues) => source.inventory.push({ name: "Cs-134", activityBq: Number.NaN, group: 2 })],
    ["a nuclide of an unlisted group", (source: RcSourceTermValues) => source.inventory.push({ name: "Cs-134", activityBq: 1, group: 9 })],
    ["too few fractions", (source: RcSourceTermValues) => source.releases[0].fractions.pop()],
    ["a fraction above one", (source: RcSourceTermValues) => source.releases[0].fractions.splice(0, 1, 1.5)],
    ["a negative fraction", (source: RcSourceTermValues) => source.releases[0].fractions.splice(0, 1, -0.1)],
    ["a fraction that is not a number", (source: RcSourceTermValues) => source.releases[0].fractions.splice(0, 1, Number.NaN)],
    ["no release segment", (source: RcSourceTermValues) => source.releases.splice(0, 1)],
    ["no chemical group", (source: RcSourceTermValues) => source.groups.splice(0, 3)],
  ])("refuses a source term with %s", (_name, damage) => {
    const source = exampleSource();
    damage(source);
    expect(refusal(() => adapt(caseOf(source))).code).toBe("RC_SOURCE_TERM_INVALID");
  });

  it("refuses a source term that leaves the engine nothing to release", () => {
    const source = exampleSource();
    source.inventory = [
      { name: "H-3", activityBq: 5e13, group: 1 },
      { name: "Co-60", activityBq: 2e11, group: 2 },
      { name: "Cs-137", activityBq: 0, group: 2 },
    ];
    const error = refusal(() => adapt(caseOf(source)));
    expect(error.code).toBe("RC_SOURCE_TERM_NOT_RELEASED");
    expect(error.details).toEqual({ withoutChemicalGroup: ["H-3", "Co-60"] });
  });

  it("names the release segments that lack a start, a duration or a height", () => {
    const source = exampleSource();
    source.releases = [
      { id: 1, durationSeconds: 3600, heightMetres: 0, fractions: [1, 1, 1] },
      { id: 2, startSeconds: 3600, durationSeconds: 3600, heightMetres: 0, fractions: [0, 0, 0] },
      { id: 3, startSeconds: 7200, heightMetres: 0, fractions: [0, 0, 0] },
      { id: 4, startSeconds: 9000, durationSeconds: 60, fractions: [0, 0, 0] },
      { id: 5, startSeconds: 9100, durationSeconds: 0, heightMetres: 0, fractions: [0, 0, 0] },
      { id: 6, startSeconds: -1, durationSeconds: 60, heightMetres: 0, fractions: [0, 0, 0] },
      { id: 7, startSeconds: 9300, durationSeconds: 60, heightMetres: Number.NaN, fractions: [0, 0, 0] },
    ];
    const error = refusal(() => adapt(caseOf(source)));
    expect(error.code).toBe("RC_RELEASE_SEGMENT_INCOMPLETE");
    expect(error.message).toBe("Release segments 1, 3, 4, 5, 6, 7 need a start time, a duration and a release height");
    expect(error.details).toEqual({ segments: [1, 3, 4, 5, 6, 7] });
  });

  it("names the chemical groups that have no saved deposition velocity", () => {
    const settings = exampleSettings();
    settings.groupVelocities = [settings.groupVelocities[0], { groupId: 2, name: "Renamed", velocity: 0.003, basis: "analyst" }, { groupId: 3, name: "Halogens", velocity: Number.NaN, basis: "analyst" }];
    const error = refusal(() => adapt(caseOf(exampleSource(), settings)));
    expect(error.code).toBe("RC_DEPOSITION_VELOCITY_MISSING");
    expect(error.message).toBe("No deposition velocity is saved for the chemical groups Alkali metals, Halogens");
    expect(error.details).toEqual({ groups: ["Alkali metals", "Halogens"] });
  });

  it("does not ask for a deposition velocity of a group whose nuclides the engine leaves out", () => {
    const source = exampleSource();
    source.groups.push({ id: 4, name: "Activation products" });
    source.inventory.push({ name: "Co-60", activityBq: 2e11, group: 4 });
    source.releases[0].fractions.push(0.1);
    expect(adapt(caseOf(source)).requests[0].request.configText).toBe(EXAMPLE_CONFIG);
  });

  it("leaves a noble gas undeposited, as the engine does, and says so when the case gives it a velocity", () => {
    const settings = exampleSettings();
    settings.groupVelocities[0] = { groupId: 1, name: "Noble gases", velocity: 0.001, basis: "analyst" };
    const adapted = adapt(caseOf(exampleSource(), settings));
    expect(adapted.requests).toEqual(adapt().requests);
    expect(adapted.notes).toEqual([
      {
        code: "NOBLE_GAS_VELOCITY_NOT_USED",
        message: "OpenRC never deposits noble gases, so the deposition velocity of Xe-133 is not used",
        details: { nuclides: ["Xe-133"] },
      },
    ]);
    const unsaved = exampleSettings();
    unsaved.groupVelocities.shift();
    expect(adapt(caseOf(exampleSource(), unsaved))).toEqual(adapt());
    const written = (velocity: number): number =>
      singleOf(resultOf(handAnswer({ ...EXAMPLE_HAND_DECK, source: [["Xe-133", 1e12]], velocities: [velocity, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0, 0.003] }))).tede_sv;
    expect(written(0.001)).toBe(written(0));
    expect(written(0)).toBeGreaterThan(0);
  });

  it("refuses daughter ingrowth when one engine group has two deposition velocities", () => {
    const source = exampleSource();
    source.groups.push({ id: 4, name: "Rubidium" });
    source.inventory.push({ name: "Rb-88", activityBq: 4e12, group: 4 });
    source.releases[0].fractions.push(1);
    const settings: RcTransportSettings = { ...exampleSettings(), decayMode: "ingrowth" };
    settings.groupVelocities = [...settings.groupVelocities, { groupId: 4, name: "Rubidium", velocity: 0.01, basis: "analyst" }];
    const error = refusal(() => adapt(caseOf(source, settings)));
    expect(error.code).toBe("RC_INGROWTH_VELOCITY_AMBIGUOUS");
    expect(error.details).toEqual({ group: 2, nuclides: ["Cs-137", "Rb-88"] });
    expect(adapt(caseOf(source, { ...settings, decayMode: "parent" })).requests).toHaveLength(2);
    const alike: RcTransportSettings = { ...settings, groupVelocities: settings.groupVelocities.map((entry) => (entry.groupId === 4 ? { ...entry, velocity: 0.003 } : entry)) };
    source.releases[0].fractions[3] = 0.5;
    expect(adapt(caseOf(source, alike)).requests).toHaveLength(2);
  });

  it.each([
    [0, 0],
    [-10, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [1000, -1],
    [1000, Number.NaN],
  ])("refuses a receptor at a distance of %s m and a height of %s m", (distanceMetres, heightMetres) => {
    expect(refusal(() => adapt(caseOf(), ONE_TRIAL, "RCM-01", { distanceMetres, heightMetres })).code).toBe("RC_RECEPTOR_INVALID");
  });

  it("refuses a case without weather trials and a trial the engine cannot run", () => {
    expect(refusal(() => adapt(caseOf(), [])).code).toBe("RC_WEATHER_TRIALS_MISSING");
    const broken: RcWeatherTrial[] = [
      trial("calm", "D", 0, 90, 1000, 1),
      trial("backwards", "D", -3, 90, 1000, 1),
      trial("no speed", "D", Number.NaN, 90, 1000, 1),
      trial("no direction", "D", 3, Number.NaN, 1000, 1),
      trial("no lid", "D", 3, 90, 0, 1),
      trial("no lid value", "D", 3, 90, Number.NaN, 1),
    ];
    for (const entry of broken) {
      const error = refusal(() => adapt(caseOf(), [ONE_TRIAL[0], entry]));
      expect(error.code).toBe("RC_WEATHER_TRIAL_INVALID");
      expect(error.message).toBe(`Weather trial '${entry.id}' needs a positive wind speed, a wind direction and a positive mixing height`);
      expect(error.details).toEqual({ trial: entry.id });
    }
  });

  it("passes stability class G on, which the engine runs as class D, and says so", () => {
    const trials = [trial("D200P04", "D", 3, 90, 1000, 0.5), trial("D200P05", "G", 3, 90, 1000, 0.5)];
    const adapted = adapt(caseOf(), trials);
    expect(adapted.requests[0].request.metFileText.split("\n").slice(1, 3)).toEqual(["D,3,270,,1000", "G,3,270,,1000"]);
    expect(adapted.notes).toEqual([
      {
        code: "STABILITY_CLASS_G_RUN_AS_D",
        message: "OpenRC knows the stability classes A to F and runs class G as class D, as in 1 of 2 weather trials",
        details: { trials: 1, of: 2 },
      },
    ]);
    const summary = seriesOf(resultOf(run(adapted.requests[0])));
    expect(summary.realizations.map((entry) => entry.stability_class)).toEqual(["D", "G"]);
    expect(summary.realizations[1].tede_msv).toBe(summary.realizations[0].tede_msv);
    const deck: HandDeck = { ...EXAMPLE_HAND_DECK, meteorology: ["met_file = hours.met", "mixing_height_m = none"] };
    const asG = singleOf(resultOf(handAnswer(deck, "G,3.0,270,,1000\n")));
    const asD = singleOf(resultOf(handAnswer(deck, "D,3.0,270,,1000\n")));
    const asF = singleOf(resultOf(handAnswer(deck, "F,3.0,270,,1000\n")));
    expect(asG.tede_sv).toBe(asD.tede_sv);
    expect(asG.tede_sv).not.toBe(asF.tede_sv);
  });

  it("treats every weather trial as equally likely, as the engine does, and says so when the probabilities differ", () => {
    const trials = [trial("W01", "D", 3, 90, 1000, 0.5), trial("W02", "E", 2, 90, 500, 0.3), trial("W03", "F", 1, 90, 100, 0.2)];
    const adapted = adapt(caseOf(), trials);
    expect(adapted.trialIds).toEqual(["W01", "W02", "W03"]);
    expect(adapted.notes).toEqual([
      {
        code: "TRIAL_PROBABILITIES_NOT_USED",
        message: "OpenRC treats every weather trial as equally likely, so the different probabilities of the 3 weather trials are not used",
        details: { trials: 3 },
      },
    ]);
    const alike = trials.map((entry) => ({ ...entry, probability: 1 / 3 }));
    expect(adapt(caseOf(), alike).requests).toEqual(adapted.requests);
    expect(adapt(caseOf(), alike).notes).toEqual([]);
    const summary = seriesOf(resultOf(run(adapted.requests[0])));
    const statistics = adaptOpenRcStatistics(adaptOpenRcTrialDoses([resultOf(run(adapted.requests[0]))], 3), { mean: true, percentiles: [5, 50, 95], exceedanceThresholds: [] });
    const engine = [summary.tede_msv.p05, summary.tede_msv.p50, summary.tede_msv.p95];
    expect(statistics.percentiles.every((entry, index) => closeTo(entry.value * 1000, engine[index], SUMMATION_TOLERANCE))).toBe(true);
    const doses = summary.realizations.map((entry) => entry.tede_msv / 1000);
    expect(closeTo(statistics.mean ?? 0, (doses[0] + doses[1] + doses[2]) / 3, SUMMATION_TOLERANCE)).toBe(true);
  });

  it("refuses a release category or metric id that would break the case name", () => {
    for (const categoryId of ["RC-1\nmode = epz", "RC-1\r", "RC 1", "RC\u00851", "RC\t1", "RC\u007f1"]) {
      const error = refusal(() => adapt(caseOf(exampleSource(), exampleSettings(), categoryId)));
      expect(error.code).toBe("RC_CASE_NAME_INVALID");
      expect(error.details).toEqual({ text: `${categoryId} RCM-01` });
    }
    const metric = { ...LMP, id: "RCM\n01" };
    expect(refusal(() => adapt({ ...caseOf(), metrics: [metric] }, ONE_TRIAL, "RCM\n01")).code).toBe("RC_CASE_NAME_INVALID");
    expect(lineOf(adapt(caseOf(exampleSource(), exampleSettings(), "  RC-1  ")).requests[0].request.configText, "case_name")).toBe("RC-1   RCM-01");
  });
});

describe("OpenRC results", () => {
  const trials = FOUR_TRIALS;
  let single: OpenRcJsonObject;
  let series: OpenRcJsonObject;

  beforeAll(() => {
    single = resultOf(run(adapt().requests[0]));
    series = resultOf(run(adapt(caseOf(), trials).requests[0]));
  });

  function altered(result: OpenRcJsonObject, change: (summary: OpenRcJsonObject) => void): OpenRcJsonObject {
    const copy: OpenRcJsonObject = JSON.parse(JSON.stringify(result));
    const summary = copy["results"];
    if (summary !== null && typeof summary === "object" && !Array.isArray(summary)) change(summary);
    return copy;
  }

  it("reads the dose of a single weather trial in sievert", () => {
    expect(adaptOpenRcTrialDoses([single], 1)).toEqual([singleOf(single).tede_sv]);
  });

  it("reads the dose of every weather trial in sievert and in trial order", () => {
    const doses = adaptOpenRcTrialDoses([series], 4);
    expect(doses).toEqual(seriesOf(series).realizations.map((entry) => entry.tede_msv / 1000));
    expect(doses.every((dose) => dose > 0)).toBe(true);
    expect(new Set(doses).size).toBe(4);
  });

  it("adds the doses of the requests of one case trial by trial", () => {
    const first = adaptOpenRcTrialDoses([series], 4);
    expect(adaptOpenRcTrialDoses([series, series, series], 4)).toEqual(first.map((dose) => dose + dose + dose));
    expect(adaptOpenRcTrialDoses([single, single], 1)).toEqual([2 * singleOf(single).tede_sv]);
  });

  it("refuses results that do not hold the weather trials of the case", () => {
    expect(refusal(() => adaptOpenRcTrialDoses([series], 3)).code).toBe("OPENRC_TRIAL_COUNT_MISMATCH");
    expect(refusal(() => adaptOpenRcTrialDoses([series], 1)).code).toBe("OPENRC_TRIAL_COUNT_MISMATCH");
    expect(refusal(() => adaptOpenRcTrialDoses([single], 4)).code).toBe("OPENRC_TRIAL_COUNT_MISMATCH");
    expect(refusal(() => adaptOpenRcTrialDoses([series, single], 4)).code).toBe("OPENRC_TRIAL_COUNT_MISMATCH");
    const short = altered(series, (summary) => {
      const realizations = summary["realizations"];
      if (Array.isArray(realizations)) realizations.pop();
    });
    expect(refusal(() => adaptOpenRcTrialDoses([short], 4)).code).toBe("OPENRC_TRIAL_COUNT_MISMATCH");
  });

  it("refuses results that are not centerline consequence results", () => {
    expect(refusal(() => adaptOpenRcTrialDoses([], 1)).code).toBe("OPENRC_RESULT_INVALID");
    expect(refusal(() => adaptOpenRcTrialDoses([single], 0)).code).toBe("OPENRC_RESULT_INVALID");
    expect(refusal(() => adaptOpenRcTrialDoses([single], 1.5)).code).toBe("OPENRC_RESULT_INVALID");
    expect(refusal(() => adaptOpenRcTrialDoses([{ ...single, methodType: "FAULT_TREE" }], 1)).code).toBe("OPENRC_RESULT_INVALID");
    expect(refusal(() => adaptOpenRcTrialDoses([{ methodType: "RADIOLOGICAL_CONSEQUENCE", console: "" }], 1)).code).toBe("OPENRC_RESULT_INVALID");
    expect(refusal(() => adaptOpenRcTrialDoses([{ ...single, results: [1] }], 1)).code).toBe("OPENRC_RESULT_INVALID");
    expect(refusal(() => adaptOpenRcTrialDoses([altered(single, (summary) => (summary["geometry"] = "polar"))], 1)).code).toBe("OPENRC_RESULT_INVALID");
    expect(refusal(() => adaptOpenRcTrialDoses([altered(single, (summary) => delete summary["tede_sv"])], 1)).code).toBe("OPENRC_RESULT_INVALID");
    expect(refusal(() => adaptOpenRcTrialDoses([altered(single, (summary) => (summary["tede_sv"] = "0.5"))], 1)).code).toBe("OPENRC_RESULT_INVALID");
    expect(refusal(() => adaptOpenRcTrialDoses([altered(single, (summary) => (summary["tede_sv"] = -0.5))], 1)).code).toBe("OPENRC_RESULT_INVALID");
    const reordered = altered(series, (summary) => {
      const realizations = summary["realizations"];
      if (Array.isArray(realizations)) realizations.reverse();
    });
    expect(refusal(() => adaptOpenRcTrialDoses([reordered], 4)).code).toBe("OPENRC_RESULT_INVALID");
    const listed = altered(series, (summary) => {
      const realizations = summary["realizations"];
      if (Array.isArray(realizations)) realizations[2] = 7;
    });
    expect(refusal(() => adaptOpenRcTrialDoses([listed], 4)).code).toBe("OPENRC_RESULT_INVALID");
  });

  it("refuses a dose that the engine could not give as a finite number", () => {
    const answer = resultOf(handAnswer({ ...EXAMPLE_HAND_DECK, source: [["Cs-137", Number.POSITIVE_INFINITY], ["I-131", 1e12]] }));
    expect(answer["results"]).toMatchObject({ tede_sv: null, geometry: "centerline" });
    const error = refusal(() => adaptOpenRcTrialDoses([answer], 1));
    expect(error.code).toBe("OPENRC_RESULT_NOT_FINITE");
    expect(error.details).toEqual({ part: 1, trial: 1 });
    const missing = altered(series, (summary) => {
      const realizations = summary["realizations"];
      const third = Array.isArray(realizations) ? realizations[2] : null;
      if (third !== null && typeof third === "object" && !Array.isArray(third)) third["tede_msv"] = null;
    });
    expect(refusal(() => adaptOpenRcTrialDoses([series, missing], 4)).details).toEqual({ part: 2, trial: 3 });
  });

  it("lists the nuclides without dose coefficients when the engine reports them", () => {
    const source = exampleSource();
    source.inventory.push({ name: "Rb-88", activityBq: 4e12, group: 2 }, { name: "Cs-999", activityBq: 1e12, group: 2 }, { name: "Ba-998", activityBq: 1e12, group: 2 });
    const reported = resultOf(run(adapt(caseOf(source)).requests[0]));
    expect(singleOf(reported).missing_dcfs).toEqual(["Ba-998", "Cs-999"]);
    expect(adaptOpenRcMissingDoseCoefficients([reported])).toEqual(["Ba-998", "Cs-999"]);
    expect(adaptOpenRcMissingDoseCoefficients([single])).toEqual([]);
    expect(adaptOpenRcMissingDoseCoefficients([reported, single, reported])).toEqual(["Ba-998", "Cs-999"]);
    expect(adaptOpenRcMissingDoseCoefficients([series])).toBeUndefined();
    expect(adaptOpenRcMissingDoseCoefficients([single, series])).toBeUndefined();
    expect(adaptOpenRcMissingDoseCoefficients([])).toBeUndefined();
  });

  it("gives the percentiles that the engine itself reports", () => {
    const summary = seriesOf(series);
    const statistics = adaptOpenRcStatistics(adaptOpenRcTrialDoses([series], 4), { mean: false, percentiles: [5, 50, 95], exceedanceThresholds: [] });
    expect(statistics.mean).toBeUndefined();
    expect(statistics.percentiles.map((entry) => entry.percentile)).toEqual([5, 50, 95]);
    const engine = [summary.tede_msv.p05, summary.tede_msv.p50, summary.tede_msv.p95];
    expect(statistics.percentiles.every((entry, index) => closeTo(entry.value * 1000, engine[index], SUMMATION_TOLERANCE))).toBe(true);
    expect(RcResultStatisticsSchema.safeParse(statistics).success).toBe(true);
  });

  it("gives the engine's own percentiles for any number of trials", () => {
    const rows = [
      trial("N1", "A", 3.7, 348.75, 843.5, 0.4),
      trial("N2", "B", 1.4, 286.875, 177, 0.2),
      trial("N3", "C", 4.5, 0, 758, 0.1),
      trial("N4", "D", 3, 90, 1000, 0.1),
      trial("N5", "E", 2.2, 84.375, 140, 0.1),
      trial("N6", "F", 0.5, 22.5, 100, 0.05),
      trial("N7", "G", 1.9, 84.375, 116, 0.05),
    ];
    for (const count of [2, 3, 5, 6, 7]) {
      const answer = resultOf(run(adapt(caseOf(), rows.slice(0, count)).requests[0]));
      const summary = seriesOf(answer);
      const statistics = adaptOpenRcStatistics(adaptOpenRcTrialDoses([answer], count), { mean: false, percentiles: [5, 50, 95], exceedanceThresholds: [] });
      const engine = [summary.tede_msv.p05, summary.tede_msv.p50, summary.tede_msv.p95];
      expect(summary.n_realizations).toBe(count);
      expect(statistics.percentiles.every((entry, index) => closeTo(entry.value * 1000, engine[index], SUMMATION_TOLERANCE))).toBe(true);
    }
  });

  it("interpolates between the two nearest doses like the engine", () => {
    const statistics = adaptOpenRcStatistics([0.004, 0.001, 0.003, 0.002], { mean: true, percentiles: [50, 5, 95, 25, 99.9], exceedanceThresholds: [] });
    expect(statistics.percentiles.map((entry) => entry.percentile)).toEqual([50, 5, 95, 25, 99.9]);
    const expected = [0.0025, 0.00115, 0.00385, 0.00175, 0.003997];
    expect(statistics.percentiles.every((entry, index) => closeTo(entry.value, expected[index], SUMMATION_TOLERANCE))).toBe(true);
    expect(closeTo(statistics.mean ?? 0, 0.0025, SUMMATION_TOLERANCE)).toBe(true);
  });

  it("gives the one dose as every percentile of a single trial", () => {
    const statistics = adaptOpenRcStatistics([0.0125], LMP.statistics);
    expect(statistics).toEqual({
      mean: 0.0125,
      percentiles: [
        { percentile: 5, value: 0.0125 },
        { percentile: 50, value: 0.0125 },
        { percentile: 95, value: 0.0125 },
      ],
      exceedances: [{ threshold: 0.001, probability: 1 }],
    });
  });

  it("takes the mean and the chance of exceeding a dose over equally likely trials", () => {
    const statistics = adaptOpenRcStatistics([0.002, 0.01, 0.05], { mean: true, percentiles: [], exceedanceThresholds: [0.001, 0.002, 0.0099, 0.01, 0.05, 1] });
    expect(closeTo(statistics.mean ?? 0, (0.002 + 0.01 + 0.05) / 3, SUMMATION_TOLERANCE)).toBe(true);
    expect(statistics.percentiles).toEqual([]);
    expect(statistics.exceedances).toEqual([
      { threshold: 0.001, probability: 1 },
      { threshold: 0.002, probability: 2 / 3 },
      { threshold: 0.0099, probability: 2 / 3 },
      { threshold: 0.01, probability: 1 / 3 },
      { threshold: 0.05, probability: 0 },
      { threshold: 1, probability: 0 },
    ]);
    expect(RcResultStatisticsSchema.safeParse(statistics).success).toBe(true);
  });

  it("gives the same percentiles and chances for the same doses in any trial order", () => {
    const wanted = { mean: false, percentiles: [5, 25, 50, 75, 95], exceedanceThresholds: [0.0015, 0.0045] };
    const inOrder = adaptOpenRcStatistics([0.001, 0.002, 0.004, 0.008, 0.016], wanted);
    expect(adaptOpenRcStatistics([0.016, 0.001, 0.008, 0.002, 0.004], wanted)).toEqual(inOrder);
    const expected = [0.0012, 0.002, 0.004, 0.008, 0.0144];
    expect(inOrder.percentiles.every((entry, index) => closeTo(entry.value, expected[index], SUMMATION_TOLERANCE))).toBe(true);
    expect(inOrder.exceedances.map((entry) => entry.probability)).toEqual([0.8, 0.4]);
  });

  it("refuses statistics without a finite dose for every trial, a percentile between 0 and 100 and a positive threshold", () => {
    const wanted = { mean: true, percentiles: [], exceedanceThresholds: [] };
    const error = refusal(() => adaptOpenRcStatistics([], wanted));
    expect(error.code).toBe("RC_STATISTICS_INVALID");
    expect(error.message).toBe("Statistics need a finite dose for every weather trial, percentiles between 0 and 100 and positive dose thresholds");
    expect(error.details).toEqual({ doses: 0 });
    expect(refusal(() => adaptOpenRcStatistics([Number.NaN], wanted)).code).toBe("RC_STATISTICS_INVALID");
    expect(refusal(() => adaptOpenRcStatistics([Number.POSITIVE_INFINITY], wanted)).code).toBe("RC_STATISTICS_INVALID");
    expect(refusal(() => adaptOpenRcStatistics([-0.1], wanted)).code).toBe("RC_STATISTICS_INVALID");
    expect(refusal(() => adaptOpenRcStatistics([0.1, Number.NaN, 0.2], wanted)).code).toBe("RC_STATISTICS_INVALID");
    expect(refusal(() => adaptOpenRcStatistics([0.1], { ...wanted, percentiles: [0] })).code).toBe("RC_STATISTICS_INVALID");
    expect(refusal(() => adaptOpenRcStatistics([0.1], { ...wanted, percentiles: [100] })).code).toBe("RC_STATISTICS_INVALID");
    expect(refusal(() => adaptOpenRcStatistics([0.1], { ...wanted, percentiles: [50, Number.NaN] })).code).toBe("RC_STATISTICS_INVALID");
    expect(refusal(() => adaptOpenRcStatistics([0.1], { ...wanted, exceedanceThresholds: [0] })).code).toBe("RC_STATISTICS_INVALID");
    expect(refusal(() => adaptOpenRcStatistics([0.1], { ...wanted, exceedanceThresholds: [0.5, Number.NaN] })).code).toBe("RC_STATISTICS_INVALID");
    expect(adaptOpenRcStatistics([0], { mean: true, percentiles: [50], exceedanceThresholds: [0.001] })).toEqual({
      mean: 0,
      percentiles: [{ percentile: 50, value: 0 }],
      exceedances: [{ threshold: 0.001, probability: 0 }],
    });
  });
});

describe("the published source term, site and weather through OpenRC", () => {
  let published: PublishedOpenRcCase;
  let saved: RcCaseData;
  let hourly: RcWeatherTrial[];
  let adapted: AdaptedOpenRcCase;
  let answers: OpenRcJsonObject[];
  const receptor = { distanceMetres: 746, heightMetres: 0 };

  beforeAll(() => {
    published = publishedCase();
    saved = published.saved;
    hourly = published.hourly;
    adapted = adaptRcCaseRequests({ caseData: saved, metricId: "RCM-01", receptor, trials: hourly });
    answers = results(adapted);
  }, 120000);

  function sourceNames(part: number): string[] {
    return sectionOf(adapted.requests[part].request.configText, "source_term").map((line) => line.slice(0, line.indexOf(" = ")));
  }

  it("runs the two published dose metrics as saved and refuses the two health risk metrics", () => {
    expect((saved.metrics ?? []).map((metric) => [metric.id, metric.window?.start])).toEqual([
      ["RCM-01", "PLUME_ARRIVAL"],
      ["RCM-02", "PLUME_ARRIVAL"],
      ["RCM-03", "PLUME_ARRIVAL"],
      ["RCM-04", "PLUME_ARRIVAL"],
    ]);
    const distance = adaptRcCaseRequests({ caseData: saved, metricId: "RCM-02", receptor, trials: hourly });
    expect(distance.requests).toHaveLength(3);
    expect(distance.notes.map((note) => note.code)).toEqual(["NUCLIDES_WITHOUT_CHEMICAL_GROUP", "WINDOW_COUNTED_FROM_RELEASE_ONSET"]);
    expect(distance.notes[1].details).toEqual({ metricId: "RCM-02" });
    expect(refusal(() => adaptRcCaseRequests({ caseData: saved, metricId: "RCM-03", receptor, trials: hourly })).code).toBe("RC_METRIC_NOT_SUPPORTED");
    expect(refusal(() => adaptRcCaseRequests({ caseData: saved, metricId: "RCM-04", receptor, trials: hourly })).code).toBe("RC_METRIC_NOT_SUPPORTED");
  });

  it("counts the published plume arrival window from release onset, as the engine does", () => {
    const onset = (saved.metrics ?? []).map((metric) => (metric.window === undefined ? metric : { ...metric, window: { ...metric.window, start: "RELEASE_ONSET" as const } }));
    const fromOnset = adaptRcCaseRequests({ caseData: { ...saved, metrics: onset }, metricId: "RCM-01", receptor, trials: hourly });
    expect(fromOnset.requests).toEqual(adapted.requests);
    expect(fromOnset.notes.map((note) => note.code)).toEqual(["NUCLIDES_WITHOUT_CHEMICAL_GROUP"]);
  });

  it("uses all 24 published weather hours as equally likely trials", () => {
    expect(hourly).toHaveLength(24);
    expect(hourly.every((entry) => entry.probability === 1 / 24)).toBe(true);
    expect(adapted.trialIds).toEqual(hourly.map((entry) => entry.id));
    expect(adapted.requests[0].request.metFileText.split("\n").slice(0, 3)).toEqual([
      "stability_class,wind_speed_m_s,wind_dir_deg,u_star_m_s,mixing_height_m",
      "E,2.2,264.375,,140",
      "F,1.9,264.375,,116",
    ]);
  });

  it("needs three requests, because the published groups differ from the engine's for 17 nuclides", () => {
    expect(adapted.requests).toHaveLength(3);
    expect(sourceNames(1)).toEqual(["Tc-99m", "Zr-95", "Zr-97", "Am-241", "Cm-242", "Cm-244", "Nd-147", "Pr-143", "Pr-144", "Pr-144m"]);
    expect(sourceNames(2)).toEqual(["Y-90", "Y-91", "Y-92", "Y-93", "Y-91m"]);
    expect(sourceNames(0)).toHaveLength(52);
    expect(adapted.notes).toEqual([
      {
        code: "NUCLIDES_WITHOUT_CHEMICAL_GROUP",
        message: "OpenRC has no chemical group for Co-58, Co-60 and leaves them out of the dose",
        details: { nuclides: ["Co-58", "Co-60"] },
      },
      {
        code: "WINDOW_COUNTED_FROM_RELEASE_ONSET",
        message: "OpenRC counts the exposure window from release onset, so the plume arrival start of the metric '30-day dose at the EAB' is not used",
        details: { metricId: "RCM-01" },
      },
    ]);
    const used = [...sourceNames(0), ...sourceNames(1), ...sourceNames(2), "Co-58", "Co-60"];
    expect(new Set(used).size).toBe(69);
    expect([...used].sort()).toEqual((saved.source?.values.inventory ?? []).map((entry) => entry.name).sort());
  });

  it("keeps the published release times, heights and window in every request", () => {
    for (const request of adapted.requests) {
      const config = request.request.configText;
      expect(sectionOf(config, "release")).toEqual(["integration_time_s = 2593334.1", "plume_segments = 8"]);
      expect(sectionOf(config, "release.segment_1").slice(0, 3)).toEqual(["delay_s = 1334.1", "duration_s = 3600.4", "height_m = 0"]);
      expect(sectionOf(config, "release.segment_8").slice(0, 3)).toEqual(["delay_s = 14465", "duration_s = 490", "height_m = 0"]);
      expect(sectionOf(config, "receptor")).toEqual(["x_m = 746", "y_m = 0", "z_m = 0"]);
      expect(request.request.metFileText).toBe(adapted.requests[0].request.metFileText);
    }
    const first = adapted.requests[0].request.configText;
    expect(lineOf(first, "release_fractions_by_group")).toBe("0.015442, 0.0000054657, 1.2009e-8, 0.0000056863, 0.0000051152, 3.447e-17, 2.4584e-12, 6.2305e-18, 2.2207e-15, 0");
    expect(lineOf(adapted.requests[1].request.configText, "release_fractions_by_group")).toBe("0, 0, 0, 0, 0, 2.4584e-12, 6.2305e-18, 2.2207e-15, 0, 0");
    expect(lineOf(adapted.requests[2].request.configText, "release_fractions_by_group")).toBe("0, 0, 0, 0, 0, 0, 2.2207e-15, 0, 0, 0");
  });

  it("gives the engine three cases that it accepts", () => {
    const checks = adapted.requests.map((request) => check(request).result);
    expect(checks.map((entry) => [entry?.["valid"], entry?.["nuclideCount"], entry?.["segmentCount"], entry?.["metRecordCount"], entry?.["mode"], entry?.["geometry"]])).toEqual([
      [true, 52, 8, 24, "lmp", "centerline"],
      [true, 10, 8, 24, "lmp", "centerline"],
      [true, 5, 8, 24, "lmp", "centerline"],
    ]);
    expect(checks.map((entry) => entry?.["caseName"])).toEqual(["MELMACCS-APP-C RCM-01 part 1 of 3", "MELMACCS-APP-C RCM-01 part 2 of 3", "MELMACCS-APP-C RCM-01 part 3 of 3"]);
  });

  it("adds up to the dose of every nuclide run alone with its own published fractions and velocity", () => {
    const expected = nuclideByNuclide(saved, 746, 0, 2592000 + 1334.1, hourly);
    const doses = adaptOpenRcTrialDoses(answers, 24);
    expect(doses.every((dose) => dose > 0)).toBe(true);
    expect(doses.every((dose, index) => closeTo(dose, expected[index], SUMMATION_TOLERANCE))).toBe(true);
  }, 120000);

  it("turns the doses of the 24 hours into the statistics the boundary metric asks for", () => {
    const metric = (saved.metrics ?? []).find((entry) => entry.id === "RCM-01");
    if (metric === undefined) throw new Error("The published case has no boundary metric");
    const doses = adaptOpenRcTrialDoses(answers, 24);
    const statistics = adaptOpenRcStatistics(doses, metric.statistics);
    const ascending = [...doses].sort((left, right) => left - right);
    expect(closeTo(statistics.mean ?? 0, doses.reduce((sum, dose) => sum + dose, 0) / 24, SUMMATION_TOLERANCE)).toBe(true);
    expect(statistics.percentiles.map((entry) => entry.percentile)).toEqual([5, 50, 95]);
    expect(statistics.percentiles[0].value).toBeGreaterThanOrEqual(ascending[1]);
    expect(statistics.percentiles[0].value).toBeLessThanOrEqual(ascending[2]);
    expect(closeTo(statistics.percentiles[1].value, (ascending[11] + ascending[12]) / 2, SUMMATION_TOLERANCE)).toBe(true);
    expect(statistics.percentiles[2].value).toBeGreaterThanOrEqual(ascending[21]);
    expect(statistics.percentiles[2].value).toBeLessThanOrEqual(ascending[22]);
    expect(statistics.exceedances).toEqual([{ threshold: 0.001, probability: 1 }]);
    expect(RcResultStatisticsSchema.safeParse(statistics).success).toBe(true);
    expect(adaptOpenRcMissingDoseCoefficients(answers)).toBeUndefined();
  });

  it("runs the published first weather hour alone as the case's saved fixed start", () => {
    const fixed = published.firstHour;
    expect(fixed).toHaveLength(1);
    expect(saved.weather?.model?.mode).toBe("fixed_start");
    const alone = adaptRcCaseRequests({ caseData: saved, metricId: "RCM-01", receptor, trials: fixed });
    const single = results(alone);
    const dose = adaptOpenRcTrialDoses(single, 1);
    const all = adaptOpenRcTrialDoses(answers, 24);
    expect(closeTo(dose[0], all[0], SUMMATION_TOLERANCE)).toBe(true);
    expect(adaptOpenRcMissingDoseCoefficients(single)).toEqual(["Nb-97m"]);
    expect(adaptOpenRcStatistics(dose, { mean: true, percentiles: [95], exceedanceThresholds: [0.01] })).toEqual({
      mean: dose[0],
      percentiles: [{ percentile: 95, value: dose[0] }],
      exceedances: [{ threshold: 0.01, probability: 1 }],
    });
  });

  it("gives a lower dose at each farther published distance band", () => {
    const bands = [746, 1609.3, 2355.3, 3218.7, 8046.7];
    const doses = bands.map((distanceMetres) => {
      const alone = adaptRcCaseRequests({ caseData: saved, metricId: "RCM-02", receptor: { distanceMetres, heightMetres: 0 }, trials: hourly.slice(0, 1) });
      expect(lineOf(alone.requests[0].request.configText, "mode")).toBe("epz");
      expect(lineOf(alone.requests[0].request.configText, "integration_time_s")).toBe("346934.1");
      return adaptOpenRcTrialDoses(results(alone), 1)[0];
    });
    expect(doses.every((dose, index) => index === 0 || dose < doses[index - 1])).toBe(true);
  });
});

describe("the HTGR and SFR example workbooks through OpenRC", () => {
  const site = RC_ANALYSIS_HTGR.releaseCategoryToConsequence.siteInformation;
  const boundaryMetres = site.isBounding ? (site.boundingSite.characteristics.siteBoundaryDistance ?? Number.NaN) : Number.NaN;
  const receptor = { distanceMetres: boundaryMetres, heightMetres: 0 };
  const categories = ["RC-1", "RC-2", "RC-3"];

  function htgr(categoryId: string): AdaptedOpenRcCase {
    return adaptRcCaseRequests({ caseData: currentRcCase(RC_ANALYSIS_HTGR, categoryId), metricId: "RCM-01", receptor, trials: FOUR_TRIALS });
  }

  it("places the HTGR receptor on the example's site boundary", () => {
    expect(boundaryMetres).toBe(425);
    expect(sectionOf(htgr("RC-1").requests[0].request.configText, "receptor")).toEqual(["x_m = 425", "y_m = 0", "z_m = 0"]);
  });

  it("writes the boundary dose of every HTGR release category as requests that the engine accepts", () => {
    const adapted = categories.map(htgr);
    expect(adapted.map((entry) => entry.requests.length)).toEqual([2, 2, 1]);
    expect(adapted.map((entry) => entry.notes.map((note) => note.details["nuclides"]))).toEqual([[["H-3", "Ag-110m", "Sb-127"]], [["H-3", "Ag-110m"]], [["H-3"]]]);
    expect(adapted[2].notes[0].message).toBe("OpenRC has no chemical group for H-3 and leaves it out of the dose");
    const checks = adapted.map((entry) => entry.requests.map((request) => check(request).result));
    expect(checks.map((entry) => entry.map((result) => [result?.["valid"], result?.["nuclideCount"], result?.["segmentCount"], result?.["metRecordCount"]]))).toEqual([
      [
        [true, 10, 2, 4],
        [true, 4, 2, 4],
      ],
      [
        [true, 4, 1, 4],
        [true, 1, 1, 4],
      ],
      [[true, 1, 1, 4]],
    ]);
    expect(sectionOf(adapted[0].requests[1].request.configText, "source_term").map((line) => line.slice(0, line.indexOf(" = ")))).toEqual(["Cs-134", "Ba-140", "Pu-239", "Pu-241"]);
    expect(sectionOf(adapted[1].requests[0].request.configText, "release")).toEqual(["integration_time_s = 2678400", "plume_segments = 1"]);
    expect(sectionOf(adapted[1].requests[0].request.configText, "release.segment_1").slice(0, 3)).toEqual(["delay_s = 86400", "duration_s = 172800", "height_m = 10"]);
  });

  it("adds up to the dose of every HTGR nuclide run alone with its own fractions and velocity", () => {
    const integrations = [2592000, 2592000 + 86400, 2592000];
    const doses = categories.map((categoryId, index) => {
      const expected = nuclideByNuclide(currentRcCase(RC_ANALYSIS_HTGR, categoryId), 425, 0, integrations[index], FOUR_TRIALS);
      const summed = adaptOpenRcTrialDoses(results(htgr(categoryId)), 4);
      expect(summed.every((dose) => dose > 0)).toBe(true);
      expect(summed.every((dose, trialIndex) => closeTo(dose, expected[trialIndex], SUMMATION_TOLERANCE))).toBe(true);
      return summed;
    });
    expect(doses[0].every((dose, trialIndex) => dose > doses[1][trialIndex] && doses[1][trialIndex] > doses[2][trialIndex])).toBe(true);
  });

  it("refuses the HTGR metrics that the engine cannot quantify", () => {
    const caseData = currentRcCase(RC_ANALYSIS_HTGR, "RC-1");
    const reasons = ["RCM-02", "RCM-03", "RCM-04"].map((metricId) => {
      const error = refusal(() => adaptRcCaseRequests({ caseData, metricId, receptor, trials: FOUR_TRIALS }));
      expect(error.code).toBe("RC_METRIC_NOT_SUPPORTED");
      return error.details["reason"];
    });
    expect(reasons).toEqual(["OpenRC has no health-effect model yet.", "OpenRC has no health-effect model yet.", "OpenRC reports dose at receptors, not population dose."]);
  });

  it("refuses the SFR example, whose deposition velocities are not saved yet", () => {
    for (const categoryId of categories) {
      const caseData = currentRcCase(RC_ANALYSIS, categoryId);
      expect(caseData.source?.values.inventory.length).toBeGreaterThan(0);
      const error = refusal(() => adaptRcCaseRequests({ caseData, metricId: "RCM-01", receptor, trials: FOUR_TRIALS }));
      expect(error.code).toBe("RC_TRANSPORT_SETTINGS_MISSING");
      expect(error.details).toEqual({ categoryId });
    }
  });
});

describe("the Python reference engine of OpenRC", () => {
  const reference: ReferenceFile = JSON.parse(readFileSync(join(__dirname, "openrc-python-reference.json"), "utf8"));
  let cases: ReturnType<typeof openRcReferenceCases>;

  beforeAll(() => {
    cases = openRcReferenceCases(publishedCase());
  }, 120000);

  it("was run on the very requests that the adapter writes", () => {
    expect(reference.cases.map((entry) => entry.name)).toEqual(cases.map((entry) => entry.name));
    expect(reference.cases.map((entry) => entry.requests)).toEqual(cases.map((entry) => entry.adapted.requests.map((request) => request.request)));
    expect(cases.map((entry) => entry.adapted.requests.length)).toEqual([1, 1, 2, 1, 3, 3, 1, 1]);
    expect(cases.every((entry) => entry.adapted.requests.every((request) => request.schemaVersion === "1.0.0"))).toBe(true);
  });

  it("gives the same dose for every request and weather trial as the engine that the backend calls", () => {
    let compared = 0;
    for (const [index, entry] of cases.entries()) {
      const expected = reference.cases[index].doses;
      const answers = results(entry.adapted);
      expect(answers).toHaveLength(expected.length);
      answers.forEach((answer, part) => {
        const doses = expected[part];
        if (doses.tede_msv === undefined) {
          const summary = singleOf(answer);
          expect(sameAsReference(summary.tede_sv, doses.tede_sv ?? Number.NaN)).toBe(true);
          expect(summary.missing_dcfs).toEqual(doses.missing_dcfs);
          compared += 1;
          return;
        }
        const summary = seriesOf(answer);
        expect(summary.realizations).toHaveLength(doses.tede_msv.length);
        expect(summary.realizations.every((realization, trialIndex) => sameAsReference(realization.tede_msv, doses.tede_msv?.[trialIndex] ?? Number.NaN))).toBe(true);
        expect(sameAsReference(summary.tede_msv.p05, doses.percentiles_msv?.p05 ?? Number.NaN)).toBe(true);
        expect(sameAsReference(summary.tede_msv.p50, doses.percentiles_msv?.p50 ?? Number.NaN)).toBe(true);
        expect(sameAsReference(summary.tede_msv.p95, doses.percentiles_msv?.p95 ?? Number.NaN)).toBe(true);
        compared += doses.tede_msv.length + 3;
      });
    }
    expect(compared).toBe(1 + 7 + 2 + 7 + 81 + 3 + 5 + 6);
  });

  it("gives the doses that the adapter adds up over the requests of a case", () => {
    for (const [index, entry] of cases.entries()) {
      const expected = reference.cases[index].doses;
      const trialCount = entry.adapted.trialIds.length;
      const summed = Array.from({ length: trialCount }, (_unused, trialIndex) =>
        expected.reduce((sum, doses) => sum + (doses.tede_msv === undefined ? (doses.tede_sv ?? Number.NaN) : doses.tede_msv[trialIndex] / 1000), 0),
      );
      const doses = adaptOpenRcTrialDoses(results(entry.adapted), trialCount);
      expect(doses.every((dose, trialIndex) => closeTo(dose, summed[trialIndex], REFERENCE_TOLERANCE))).toBe(true);
    }
  });

  it("gives the percentiles that the adapter takes over equally likely weather trials", () => {
    const wanted = { mean: false, percentiles: [5, 50, 95], exceedanceThresholds: [] };
    let compared = 0;
    for (const [index, entry] of cases.entries()) {
      const expected = reference.cases[index].doses;
      const percentiles = expected[0].percentiles_msv;
      if (expected.length !== 1 || percentiles === undefined) continue;
      const doses = adaptOpenRcTrialDoses(results(entry.adapted), entry.adapted.trialIds.length);
      const statistics = adaptOpenRcStatistics(doses, wanted);
      const python = [percentiles.p05, percentiles.p50, percentiles.p95];
      expect(statistics.percentiles.every((row, rowIndex) => closeTo(row.value * 1000, python[rowIndex], REFERENCE_TOLERANCE))).toBe(true);
      compared += 1;
    }
    expect(compared).toBe(4);
  });

  it("runs stability class G as class D and takes its percentiles over equally likely trials, whatever their probabilities", () => {
    const entry = reference.cases[7];
    expect(entry.name).toBe("stability class G and unequal trial probabilities, three weather trials");
    expect(entry.requests[0].metFileText.split("\n").slice(1, 4)).toEqual(["D,3,270,,1000", "G,3,270,,1000", "F,1,202.5,,100"]);
    const doses = entry.doses[0].tede_msv ?? [];
    const percentiles = entry.doses[0].percentiles_msv;
    expect(doses).toHaveLength(3);
    expect(doses[1]).toBe(doses[0]);
    expect(doses[2]).toBeGreaterThan(doses[0]);
    expect(percentiles?.p05).toBe(doses[0]);
    expect(percentiles?.p50).toBe(doses[0]);
    expect(closeTo(percentiles?.p95 ?? Number.NaN, doses[0] + 0.9 * (doses[2] - doses[0]), REFERENCE_TOLERANCE)).toBe(true);
    expect(cases[7].adapted.trialIds).toEqual(["G1", "G2", "G3"]);
    expect(cases[7].adapted.notes.map((note) => note.code)).toEqual(["STABILITY_CLASS_G_RUN_AS_D", "TRIAL_PROBABILITIES_NOT_USED"]);
  });

  it("reads numbers in exponent form as the adapter writes them", () => {
    const config = cases[6].adapted.requests[0].request;
    expect(sectionOf(config.configText, "source_term")).toEqual(["Cs-137 = 1e+21", "I-131 = 2.5e+22", "Xe-133 = 1.5e-7"]);
    expect(lineOf(config.configText, "release_fractions_by_group")).toBe("1, 1e-7, 0, 2.5e-9, 0, 0, 0, 0, 0, 0");
    expect(lineOf(config.configText, "deposition_velocities_by_group")).toBe("0, 1e-7, 0.003, 9.999, 0.003, 0.003, 0.003, 0.003, 0, 0.003");
    expect(sectionOf(config.configText, "release")).toEqual(["integration_time_s = 2592000.5", "plume_segments = 1"]);
    expect(config.metFileText.split("\n").slice(1, 3)).toEqual(["A,0.05,179.99,,12345.678", "F,29.75,90,,100.25"]);
    const spelledOut: [string, string][] = [
      ["Cs-137 = 1e+21", "Cs-137 = 1000000000000000000000"],
      ["I-131 = 2.5e+22", "I-131 = 25000000000000000000000.0"],
      ["Xe-133 = 1.5e-7", "Xe-133 = 0.00000015"],
      ["1, 1e-7, 0, 2.5e-9,", "1.0, 0.0000001, 0.0, 0.0000000025,"],
      ["0, 1e-7, 0.003, 9.999,", "0.0, 0.0000001, 0.003, 9.999,"],
    ];
    const plainText = spelledOut.reduce((text, [exponent, plain]) => {
      expect(text.split(exponent)).toHaveLength(2);
      return text.split(exponent).join(plain);
    }, config.configText);
    const plain: OpenRcRequestEnvelope = { schemaVersion: "1.0.0", request: { ...config, configText: plainText, metFileText: "A,0.0500,179.9900,,12345.6780\nF,29.7500,90.0000,,100.2500\n" } };
    const adapted = seriesOf(resultOf(run(cases[6].adapted.requests[0])));
    expect(adapted.realizations.map((entry) => entry.tede_msv)).toEqual(seriesOf(resultOf(run(plain))).realizations.map((entry) => entry.tede_msv));
    expect(adapted.realizations.every((entry) => entry.tede_msv > 0)).toBe(true);
  });

  it("names the one published nuclide that the engine has no dose coefficients for", () => {
    const hour = reference.cases[5];
    expect(hour.name).toBe("published source term, first published weather hour, 8046.7 m");
    expect(hour.doses.map((doses) => doses.missing_dcfs)).toEqual([["Nb-97m"], [], []]);
    expect(adaptOpenRcMissingDoseCoefficients(results(cases[5].adapted))).toEqual(["Nb-97m"]);
  });
});
