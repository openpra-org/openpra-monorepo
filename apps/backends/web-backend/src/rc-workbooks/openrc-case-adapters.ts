import type { RcCaseData, RcResultStatistics } from "interfaces-mef-types/rc/case-records";
import type { RcConsequenceMetric, RcMetricStatistics } from "interfaces-mef-types/rc/metrics";
import type { RcSourceTermValues } from "interfaces-mef-types/rc/source-term";
import type { RcTransportSettings } from "interfaces-mef-types/rc/transport";
import type { RcWeatherTrial } from "interfaces-mef-types/rc/weather";
import { rcMetricOpenRcSupport } from "interfaces-shared-types/rc-workbooks/metrics";
import type { NativeJson } from "openrc-node/protocol";

type OpenRcJsonObject = { [key: string]: NativeJson };

interface OpenRcRequestEnvelope {
  schemaVersion: "1.0.0";
  request: {
    methodType: "RADIOLOGICAL_CONSEQUENCE";
    configText: string;
    metFileText: string;
  };
}

interface OpenRcReceptor {
  distanceMetres: number;
  heightMetres: number;
}

interface OpenRcCaseInput {
  caseData: RcCaseData;
  metricId: string;
  receptor: OpenRcReceptor;
  trials: readonly RcWeatherTrial[];
}

type OpenRcCaseNoteCode =
  | "NUCLIDES_WITHOUT_CHEMICAL_GROUP"
  | "NOBLE_GAS_VELOCITY_NOT_USED"
  | "WINDOW_COUNTED_FROM_RELEASE_ONSET"
  | "STABILITY_CLASS_G_RUN_AS_D"
  | "TRIAL_PROBABILITIES_NOT_USED"
  | "RAIN_NOT_MODELLED"
  | "BOUNDARY_WEATHER_NOT_MODELLED";

interface OpenRcCaseNote {
  code: OpenRcCaseNoteCode;
  message: string;
  details: Readonly<Record<string, NativeJson>>;
}

interface AdaptedOpenRcCase {
  requests: OpenRcRequestEnvelope[];
  trialIds: string[];
  notes: OpenRcCaseNote[];
}

type WorkbookOpenRcAdapterErrorCode =
  | "WORKBOOK_OPENRC_ADAPTER_ERROR"
  | "RC_METRIC_NOT_FOUND"
  | "RC_METRIC_NOT_SUPPORTED"
  | "RC_METRIC_WINDOW_MISSING"
  | "RC_SOURCE_TERM_MISSING"
  | "RC_SOURCE_TERM_INVALID"
  | "RC_SOURCE_TERM_NOT_RELEASED"
  | "RC_RELEASE_SEGMENT_INCOMPLETE"
  | "RC_TRANSPORT_SETTINGS_MISSING"
  | "RC_DEPOSITION_VELOCITY_MISSING"
  | "RC_INGROWTH_VELOCITY_AMBIGUOUS"
  | "RC_RECEPTOR_INVALID"
  | "RC_WEATHER_TRIALS_MISSING"
  | "RC_WEATHER_TRIAL_INVALID"
  | "RC_CASE_NAME_INVALID"
  | "RC_STATISTICS_INVALID"
  | "OPENRC_RESULT_INVALID"
  | "OPENRC_RESULT_NOT_FINITE"
  | "OPENRC_TRIAL_COUNT_MISMATCH";

class WorkbookOpenRcAdapterError extends Error {
  readonly code: WorkbookOpenRcAdapterErrorCode;
  readonly details: Readonly<Record<string, NativeJson>>;

  constructor(
    message: string,
    code: WorkbookOpenRcAdapterErrorCode = "WORKBOOK_OPENRC_ADAPTER_ERROR",
    details: Readonly<Record<string, NativeJson>> = {},
  ) {
    super(message);
    this.name = "WorkbookOpenRcAdapterError";
    this.code = code;
    this.details = details;
  }
}

const OPENRC_GROUP_ELEMENTS: readonly (readonly string[])[] = [
  ["Xe", "Kr", "Ar", "He", "Ne", "Rn"],
  ["Cs", "Rb"],
  ["Ba", "Sr"],
  ["I"],
  ["Te", "Se"],
  ["Ru", "Rh", "Tc"],
  ["Mo", "Nb", "Zr", "Y"],
  ["Ce", "Pr", "Nd", "Pm", "Sm", "Np", "Pu", "Am", "Cm"],
  ["La"],
  ["U", "Th"],
];
const OPENRC_NOBLE_GAS_GROUP = 0;
const OPENRC_DEFAULT_GROUP_VELOCITIES: readonly number[] = [0, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0, 0.003];
const OPENRC_DEFAULT_DRY_DEPOSITION_VELOCITY = 0.003;
const OPENRC_DEFAULT_COLLAPSE_HALF_LIFE_SECONDS = 1;
const OPENRC_EFFECTIVE_DOSE_ORGAN = "ICRP60ED";
const OPENRC_MODULES = "RC01_ST, RC04_DCF, RC05_RCRE, RC10_RCAD";
const OPENRC_STABILITY_CLASSES: readonly string[] = ["A", "B", "C", "D", "E", "F"];
const OPENRC_MET_FILE = "weather-trials.met";
const OPENRC_DCF_PATH = "data/DCF.json";
const OPENRC_DECAY_PATH = "data/Chains.json";
const OPENRC_OUTPUT_DIRECTORY = "outputs";
const OPENRC_MET_COLUMNS = "stability_class,wind_speed_m_s,wind_dir_deg,u_star_m_s,mixing_height_m";
const DIGITS = "0123456789";
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LINE_SEPARATORS: readonly number[] = [0x7f, 0x85, 0x2028, 0x2029];

interface SourceNuclide {
  name: string;
  activityBq: number;
  group: number;
  fractions: number[];
  velocity: number;
}

interface GroupClass {
  key: string;
  fractions: number[];
  velocity: number;
  nuclides: SourceNuclide[];
}

interface ReleaseSegment {
  id: number;
  delaySeconds: number;
  durationSeconds: number;
  heightMetres: number;
}

type ConfigSection = readonly [string, readonly (readonly [string, string])[]];

const fail = (
  code: WorkbookOpenRcAdapterErrorCode,
  message: string,
  details: Readonly<Record<string, NativeJson>> = {},
): WorkbookOpenRcAdapterError => new WorkbookOpenRcAdapterError(message, code, details);

const numberText = (value: number): string => String(value === 0 ? 0 : value);

const openRcElement = (nuclide: string): string | undefined => {
  const characters = [...nuclide];
  let start = 0;
  while (start < characters.length && DIGITS.includes(characters[start])) start += 1;
  let end = start;
  while (end < characters.length && LETTERS.includes(characters[end])) end += 1;
  if (end === start) return undefined;
  const letters = characters.slice(start, end).join("");
  return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
};

const groupIndexOf = (nuclide: string): number | undefined => {
  const element = openRcElement(nuclide);
  if (element === undefined) return undefined;
  const index = OPENRC_GROUP_ELEMENTS.findIndex((elements) => elements.includes(element));
  return index < 0 ? undefined : index;
};

const openRcChemicalGroup = (nuclide: string): number | undefined => {
  const index = groupIndexOf(nuclide);
  return index === undefined ? undefined : index + 1;
};

const plainName = (name: string): boolean =>
  name.length > 0 && [...name].every((character) => character === "-" || DIGITS.includes(character) || LETTERS.includes(character));

const configValue = (text: string, what: string): string => {
  const value = text.trim();
  const broken = [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 0x20 || LINE_SEPARATORS.includes(code);
  });
  if (value.length === 0 || broken) {
    throw fail("RC_CASE_NAME_INVALID", `${what} cannot be written into an OpenRC case name`, { text });
  }
  return value.split("%").join("%%");
};

const metricOf = (caseData: RcCaseData, metricId: string): RcConsequenceMetric => {
  const metric = (caseData.metrics ?? []).find((candidate) => candidate.id === metricId);
  if (metric === undefined) {
    throw fail("RC_METRIC_NOT_FOUND", `Consequence metric '${metricId}' is not part of this case`, { metricId });
  }
  const support = rcMetricOpenRcSupport(metric);
  if (support.status !== "YES") {
    throw fail("RC_METRIC_NOT_SUPPORTED", `OpenRC cannot quantify the metric '${metric.name}': ${support.reason}`, { metricId, reason: support.reason });
  }
  return metric;
};

const windowSecondsOf = (metric: RcConsequenceMetric): number => {
  if (metric.window === undefined || !Number.isFinite(metric.window.seconds) || metric.window.seconds <= 0) {
    throw fail("RC_METRIC_WINDOW_MISSING", `The metric '${metric.name}' has no exposure window`, { metricId: metric.id });
  }
  return metric.window.seconds;
};

const sourceOf = (caseData: RcCaseData): RcSourceTermValues => {
  const source = caseData.source?.values;
  if (source === undefined) {
    throw fail("RC_SOURCE_TERM_MISSING", `Release category '${caseData.categoryId}' has no source term`, { categoryId: caseData.categoryId });
  }
  if (source.releases.length === 0 || source.groups.length === 0) {
    throw fail("RC_SOURCE_TERM_INVALID", "The source term needs at least one chemical group and one release segment");
  }
  const names = new Set<string>();
  for (const nuclide of source.inventory) {
    if (!plainName(nuclide.name) || names.has(nuclide.name)) {
      throw fail("RC_SOURCE_TERM_INVALID", `The source term names the nuclide '${nuclide.name}' more than once or in a form OpenRC cannot read`, { nuclide: nuclide.name });
    }
    names.add(nuclide.name);
    if (!Number.isFinite(nuclide.activityBq) || nuclide.activityBq < 0) {
      throw fail("RC_SOURCE_TERM_INVALID", `The inventory of ${nuclide.name} is not a nonnegative activity`, { nuclide: nuclide.name });
    }
  }
  for (const release of source.releases) {
    const valid =
      release.fractions.length === source.groups.length &&
      release.fractions.every((fraction) => Number.isFinite(fraction) && fraction >= 0 && fraction <= 1);
    if (!valid) {
      throw fail("RC_SOURCE_TERM_INVALID", `Release segment ${release.id} needs one fraction from 0 to 1 for every chemical group`, { segment: release.id });
    }
  }
  return source;
};

const segmentsOf = (source: RcSourceTermValues): ReleaseSegment[] => {
  const usable = (value: number | undefined, positive: boolean): value is number =>
    value !== undefined && Number.isFinite(value) && (positive ? value > 0 : value >= 0);
  const incomplete = source.releases
    .filter((release) => !usable(release.startSeconds, false) || !usable(release.durationSeconds, true) || !usable(release.heightMetres, false))
    .map((release) => release.id);
  if (incomplete.length > 0) {
    throw fail(
      "RC_RELEASE_SEGMENT_INCOMPLETE",
      `Release segments ${incomplete.join(", ")} need a start time, a duration and a release height`,
      { segments: incomplete },
    );
  }
  return source.releases.map((release) => ({
    id: release.id,
    delaySeconds: release.startSeconds ?? 0,
    durationSeconds: release.durationSeconds ?? 0,
    heightMetres: release.heightMetres ?? 0,
  }));
};

const transportOf = (caseData: RcCaseData): RcTransportSettings => {
  const settings = caseData.transport?.categories.find((category) => category.categoryId === caseData.categoryId)?.settings;
  if (settings === undefined) {
    throw fail(
      "RC_TRANSPORT_SETTINGS_MISSING",
      `Release category '${caseData.categoryId}' has no saved deposition velocities and decay mode`,
      { categoryId: caseData.categoryId },
    );
  }
  return settings;
};

const assertReceptor = (receptor: OpenRcReceptor): void => {
  const valid =
    Number.isFinite(receptor.distanceMetres) && receptor.distanceMetres > 0 && Number.isFinite(receptor.heightMetres) && receptor.heightMetres >= 0;
  if (!valid) {
    throw fail("RC_RECEPTOR_INVALID", "The receptor needs a positive distance from the release and a nonnegative height", {
      distanceMetres: Number.isFinite(receptor.distanceMetres) ? receptor.distanceMetres : null,
      heightMetres: Number.isFinite(receptor.heightMetres) ? receptor.heightMetres : null,
    });
  }
};

const mapNuclides = (
  source: RcSourceTermValues,
  settings: RcTransportSettings,
): { nuclides: SourceNuclide[]; withoutGroup: string[]; nobleWithVelocity: string[] } => {
  const nuclides: SourceNuclide[] = [];
  const withoutGroup: string[] = [];
  const nobleWithVelocity: string[] = [];
  const missingVelocities = new Set<string>();
  for (const entry of source.inventory) {
    if (entry.activityBq === 0) continue;
    const group = groupIndexOf(entry.name);
    if (group === undefined) {
      withoutGroup.push(entry.name);
      continue;
    }
    const position = source.groups.findIndex((candidate) => candidate.id === entry.group);
    const sourceGroup = source.groups[position];
    if (sourceGroup === undefined) {
      throw fail("RC_SOURCE_TERM_INVALID", `${entry.name} belongs to a chemical group that the source term does not list`, { nuclide: entry.name, group: entry.group });
    }
    const saved = settings.groupVelocities.find((candidate) => candidate.groupId === sourceGroup.id && candidate.name === sourceGroup.name);
    const noble = group === OPENRC_NOBLE_GAS_GROUP;
    if (noble && saved !== undefined && saved.velocity !== 0) nobleWithVelocity.push(entry.name);
    if (!noble && (saved === undefined || !Number.isFinite(saved.velocity) || saved.velocity < 0)) {
      missingVelocities.add(sourceGroup.name);
      continue;
    }
    nuclides.push({
      name: entry.name,
      activityBq: entry.activityBq,
      group,
      fractions: source.releases.map((release) => release.fractions[position] ?? 0),
      velocity: noble ? 0 : (saved?.velocity ?? 0),
    });
  }
  if (missingVelocities.size > 0) {
    const groups = [...missingVelocities];
    throw fail("RC_DEPOSITION_VELOCITY_MISSING", `No deposition velocity is saved for the chemical groups ${groups.join(", ")}`, { groups });
  }
  return { nuclides, withoutGroup, nobleWithVelocity };
};

const groupClasses = (nuclides: readonly SourceNuclide[]): GroupClass[][] => {
  const classes: GroupClass[][] = OPENRC_GROUP_ELEMENTS.map(() => []);
  for (const nuclide of nuclides) {
    const key = JSON.stringify([nuclide.fractions.map((fraction) => (fraction === 0 ? 0 : fraction)), nuclide.velocity]);
    const known = classes[nuclide.group].find((candidate) => candidate.key === key);
    if (known === undefined) {
      classes[nuclide.group].push({ key, fractions: nuclide.fractions, velocity: nuclide.velocity, nuclides: [nuclide] });
    } else {
      known.nuclides.push(nuclide);
    }
  }
  return classes;
};

const weatherRows = (trials: readonly RcWeatherTrial[]): string[] => {
  if (trials.length === 0) {
    throw fail("RC_WEATHER_TRIALS_MISSING", "The case has no generated weather trials");
  }
  return trials.map((trial) => {
    const valid =
      Number.isFinite(trial.windSpeedMetresPerSecond) &&
      trial.windSpeedMetresPerSecond > 0 &&
      Number.isFinite(trial.windTowardDegrees) &&
      Number.isFinite(trial.mixingHeightMetres) &&
      trial.mixingHeightMetres > 0;
    if (!valid) {
      throw fail(
        "RC_WEATHER_TRIAL_INVALID",
        `Weather trial '${trial.id}' needs a positive wind speed, a wind direction and a positive mixing height`,
        { trial: trial.id },
      );
    }
    const windFromDegrees = (((trial.windTowardDegrees + 180) % 360) + 360) % 360;
    return [
      trial.stabilityClass,
      numberText(trial.windSpeedMetresPerSecond),
      numberText(windFromDegrees),
      "",
      numberText(trial.mixingHeightMetres),
    ].join(",");
  });
};

const configText = (sections: readonly ConfigSection[]): string =>
  `${sections.map(([name, options]) => [`[${name}]`, ...options.map(([key, value]) => `${key} = ${value}`)].join("\n")).join("\n\n")}\n`;

const caseNoteList = (
  withoutGroup: readonly string[],
  nobleWithVelocity: readonly string[],
  metric: RcConsequenceMetric,
  trials: readonly RcWeatherTrial[],
  caseData: RcCaseData,
): OpenRcCaseNote[] => {
  const notes: OpenRcCaseNote[] = [];
  if (withoutGroup.length > 0) {
    notes.push({
      code: "NUCLIDES_WITHOUT_CHEMICAL_GROUP",
      message: `OpenRC has no chemical group for ${withoutGroup.join(", ")} and leaves ${withoutGroup.length === 1 ? "it" : "them"} out of the dose`,
      details: { nuclides: [...withoutGroup] },
    });
  }
  if (nobleWithVelocity.length > 0) {
    notes.push({
      code: "NOBLE_GAS_VELOCITY_NOT_USED",
      message: `OpenRC never deposits noble gases, so the deposition velocity of ${nobleWithVelocity.join(", ")} is not used`,
      details: { nuclides: [...nobleWithVelocity] },
    });
  }
  if (metric.window?.start === "PLUME_ARRIVAL") {
    notes.push({
      code: "WINDOW_COUNTED_FROM_RELEASE_ONSET",
      message: `OpenRC counts the exposure window from release onset, so the plume arrival start of the metric '${metric.name}' is not used`,
      details: { metricId: metric.id },
    });
  }
  const runAsD = trials.filter((trial) => !OPENRC_STABILITY_CLASSES.includes(trial.stabilityClass)).length;
  if (runAsD > 0) {
    notes.push({
      code: "STABILITY_CLASS_G_RUN_AS_D",
      message: `OpenRC knows the stability classes A to F and runs class G as class D, as in ${runAsD} of ${trials.length} weather trials`,
      details: { trials: runAsD, of: trials.length },
    });
  }
  if (trials.some((trial) => trial.probability !== trials[0].probability)) {
    notes.push({
      code: "TRIAL_PROBABILITIES_NOT_USED",
      message: `OpenRC treats every weather trial as equally likely, so the different probabilities of the ${trials.length} weather trials are not used`,
      details: { trials: trials.length },
    });
  }
  const rainy = trials.filter((trial) => trial.rainMillimetresPerHour > 0).length;
  if (rainy > 0) {
    notes.push({
      code: "RAIN_NOT_MODELLED",
      message: `OpenRC has no wet deposition, so the rain in ${rainy} of ${trials.length} weather trials is not used`,
      details: { trials: rainy, of: trials.length },
    });
  }
  if (caseData.weather?.model?.boundary?.enabled === true || caseData.weather?.trialSet?.boundary?.enabled === true) {
    notes.push({
      code: "BOUNDARY_WEATHER_NOT_MODELLED",
      message: "OpenRC holds the weather of a trial at every distance, so the boundary weather is not used",
      details: {},
    });
  }
  return notes;
};

const adaptRcCaseRequests = (input: OpenRcCaseInput): AdaptedOpenRcCase => {
  const { caseData, receptor, trials } = input;
  const metric = metricOf(caseData, input.metricId);
  const windowSeconds = windowSecondsOf(metric);
  const source = sourceOf(caseData);
  const segments = segmentsOf(source);
  const settings = transportOf(caseData);
  assertReceptor(receptor);
  const rows = weatherRows(trials);
  const { nuclides, withoutGroup, nobleWithVelocity } = mapNuclides(source, settings);
  if (nuclides.length === 0) {
    throw fail(
      "RC_SOURCE_TERM_NOT_RELEASED",
      "The source term has no nuclide with an activity that OpenRC can assign to one of its chemical groups",
      { withoutChemicalGroup: [...withoutGroup] },
    );
  }
  const classes = groupClasses(nuclides);
  if (settings.decayMode === "ingrowth") {
    const ambiguous = classes.findIndex((group) => group.some((candidate) => candidate.velocity !== group[0].velocity));
    if (ambiguous >= 0) {
      const elements = OPENRC_GROUP_ELEMENTS[ambiguous].join(", ");
      throw fail(
        "RC_INGROWTH_VELOCITY_AMBIGUOUS",
        `With daughter ingrowth OpenRC gives every daughter the deposition velocity of its chemical group, but the nuclides of the group ${elements} have more than one velocity`,
        { group: ambiguous + 1, nuclides: classes[ambiguous].flatMap((candidate) => candidate.nuclides.map((nuclide) => nuclide.name)) },
      );
    }
  }
  const partCount = Math.max(...classes.map((group) => group.length));
  const firstStart = Math.min(...segments.map((segment) => segment.delaySeconds));
  const baseName = `${caseData.categoryId} ${metric.id}`;
  const metFileText = `${[OPENRC_MET_COLUMNS, ...rows].join("\n")}\n`;

  const requests = Array.from({ length: partCount }, (_unused, part): OpenRcRequestEnvelope => {
    const chosen: (GroupClass | undefined)[] = classes.map((group) => group[part]);
    const members = new Set(chosen.flatMap((candidate) => candidate?.nuclides ?? []));
    const sourceTerm = nuclides
      .filter((nuclide) => members.has(nuclide))
      .map((nuclide): readonly [string, string] => [nuclide.name, numberText(nuclide.activityBq)]);
    const velocities = classes.map((group, index) => chosen[index]?.velocity ?? group[0]?.velocity ?? OPENRC_DEFAULT_GROUP_VELOCITIES[index]);
    const name = partCount === 1 ? baseName : `${baseName} part ${part + 1} of ${partCount}`;
    const sections: ConfigSection[] = [
      [
        "run",
        [
          ["case_name", configValue(name, "The release category or metric id")],
          ["mode", metric.receptor.kind === "EAB_MAXIMUM" ? "lmp" : "epz"],
          ["modules", OPENRC_MODULES],
          ["geometry", "centerline"],
        ],
      ],
      ["source_term", sourceTerm],
      [
        "receptor",
        [
          ["x_m", numberText(receptor.distanceMetres)],
          ["y_m", "0"],
          ["z_m", numberText(receptor.heightMetres)],
        ],
      ],
      [
        "meteorology",
        [
          ["met_file", OPENRC_MET_FILE],
          ["mixing_height_m", "none"],
        ],
      ],
      [
        "release",
        [
          ["integration_time_s", numberText(windowSeconds + firstStart)],
          ["plume_segments", String(segments.length)],
        ],
      ],
      ...segments.map((segment, index): ConfigSection => [
        `release.segment_${index + 1}`,
        [
          ["delay_s", numberText(segment.delaySeconds)],
          ["duration_s", numberText(segment.durationSeconds)],
          ["height_m", numberText(segment.heightMetres)],
          ["release_fractions_by_group", chosen.map((candidate) => numberText(candidate?.fractions[index] ?? 0)).join(", ")],
        ],
      ]),
      [
        "dcf",
        [
          ["organ", OPENRC_EFFECTIVE_DOSE_ORGAN],
          ["path", OPENRC_DCF_PATH],
        ],
      ],
      [
        "decay",
        [
          ["path", OPENRC_DECAY_PATH],
          ["include_ingrowth", settings.decayMode === "ingrowth" ? "true" : "false"],
          ["simple_decay_at_receptor", settings.decayMode === "parent" ? "true" : "false"],
          ["collapse_half_life_sec", numberText(OPENRC_DEFAULT_COLLAPSE_HALF_LIFE_SECONDS)],
        ],
      ],
      [
        "deposition",
        [
          ["dry_deposition_velocity_m_s", numberText(OPENRC_DEFAULT_DRY_DEPOSITION_VELOCITY)],
          ["deposition_velocities_by_group", velocities.map(numberText).join(", ")],
        ],
      ],
      [
        "outputs",
        [
          ["write_csv", "false"],
          ["output_dir", OPENRC_OUTPUT_DIRECTORY],
        ],
      ],
    ];
    return {
      schemaVersion: "1.0.0",
      request: { methodType: "RADIOLOGICAL_CONSEQUENCE", configText: configText(sections), metFileText },
    };
  });

  return {
    requests,
    trialIds: trials.map((trial) => trial.id),
    notes: caseNoteList(withoutGroup, nobleWithVelocity, metric, trials, caseData),
  };
};

const jsonObject = (value: NativeJson | undefined): OpenRcJsonObject | undefined =>
  value !== undefined && value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;

const summaryOf = (result: OpenRcJsonObject, part: number): OpenRcJsonObject => {
  const summary = jsonObject(result["results"]);
  if (result["methodType"] !== "RADIOLOGICAL_CONSEQUENCE" || summary === undefined || summary["geometry"] !== "centerline") {
    throw fail("OPENRC_RESULT_INVALID", `OpenRC result ${part + 1} is not a centerline consequence result`, { part: part + 1 });
  }
  return summary;
};

const doseOf = (value: NativeJson | undefined, part: number, trial: number): number => {
  if (value === null) {
    throw fail("OPENRC_RESULT_NOT_FINITE", `OpenRC returned a dose that is not a finite number for weather trial ${trial + 1}`, { part: part + 1, trial: trial + 1 });
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw fail("OPENRC_RESULT_INVALID", `OpenRC result ${part + 1} has no dose for weather trial ${trial + 1}`, { part: part + 1, trial: trial + 1 });
  }
  return value;
};

const adaptOpenRcTrialDoses = (results: readonly OpenRcJsonObject[], trialCount: number): number[] => {
  if (!Number.isSafeInteger(trialCount) || trialCount < 1 || results.length === 0) {
    throw fail("OPENRC_RESULT_INVALID", "OpenRC doses need at least one result and one weather trial");
  }
  const doses = Array.from({ length: trialCount }, () => 0);
  results.forEach((result, part) => {
    const summary = summaryOf(result, part);
    if (trialCount === 1) {
      if (summary["n_realizations"] !== undefined) {
        throw fail("OPENRC_TRIAL_COUNT_MISMATCH", `OpenRC result ${part + 1} holds more than the one weather trial of the case`, { part: part + 1 });
      }
      doses[0] += doseOf(summary["tede_sv"], part, 0);
      return;
    }
    const realizations = summary["realizations"];
    if (summary["n_realizations"] !== trialCount || !Array.isArray(realizations) || realizations.length !== trialCount) {
      throw fail(
        "OPENRC_TRIAL_COUNT_MISMATCH",
        `OpenRC result ${part + 1} does not hold the ${trialCount} weather trials of the case`,
        { part: part + 1, trials: trialCount },
      );
    }
    realizations.forEach((entry, trial) => {
      const realization = jsonObject(entry);
      if (realization === undefined || realization["index"] !== trial) {
        throw fail("OPENRC_RESULT_INVALID", `OpenRC result ${part + 1} lists its weather trials out of order`, { part: part + 1, trial: trial + 1 });
      }
      doses[trial] += doseOf(realization["tede_msv"], part, trial) / 1000;
    });
  });
  return doses;
};

const adaptOpenRcMissingDoseCoefficients = (results: readonly OpenRcJsonObject[]): string[] | undefined => {
  const names = new Set<string>();
  for (const [part, result] of results.entries()) {
    const listed = summaryOf(result, part)["missing_dcfs"];
    if (!Array.isArray(listed)) return undefined;
    for (const name of listed) {
      if (typeof name === "string") names.add(name);
    }
  }
  return results.length === 0 ? undefined : [...names].sort();
};

const interpolatedPercentile = (ascending: readonly number[], percentile: number): number => {
  if (ascending.length === 1) return ascending[0];
  const position = (percentile / 100) * (ascending.length - 1);
  const low = Math.trunc(position);
  const high = Math.min(low + 1, ascending.length - 1);
  return ascending[low] + (position - low) * (ascending[high] - ascending[low]);
};

const adaptOpenRcStatistics = (dosesSv: readonly number[], wanted: RcMetricStatistics): RcResultStatistics => {
  const valid =
    dosesSv.length > 0 &&
    dosesSv.every((dose) => Number.isFinite(dose) && dose >= 0) &&
    wanted.percentiles.every((percentile) => Number.isFinite(percentile) && percentile > 0 && percentile < 100) &&
    wanted.exceedanceThresholds.every((threshold) => Number.isFinite(threshold) && threshold > 0);
  if (!valid) {
    throw fail(
      "RC_STATISTICS_INVALID",
      "Statistics need a finite dose for every weather trial, percentiles between 0 and 100 and positive dose thresholds",
      { doses: dosesSv.length },
    );
  }
  const count = dosesSv.length;
  const ascending = [...dosesSv].sort((left, right) => left - right);
  return {
    ...(wanted.mean ? { mean: dosesSv.reduce((sum, dose) => sum + dose, 0) / count } : {}),
    percentiles: wanted.percentiles.map((percentile) => ({ percentile, value: interpolatedPercentile(ascending, percentile) })),
    exceedances: wanted.exceedanceThresholds.map((threshold) => ({
      threshold,
      probability: dosesSv.filter((dose) => dose > threshold).length / count,
    })),
  };
};

export {
  WorkbookOpenRcAdapterError,
  adaptRcCaseRequests,
  adaptOpenRcTrialDoses,
  adaptOpenRcMissingDoseCoefficients,
  adaptOpenRcStatistics,
  openRcChemicalGroup,
};
export type {
  AdaptedOpenRcCase,
  OpenRcCaseInput,
  OpenRcCaseNote,
  OpenRcCaseNoteCode,
  OpenRcJsonObject,
  OpenRcReceptor,
  OpenRcRequestEnvelope,
  WorkbookOpenRcAdapterErrorCode,
};
