import type { RcCaseData } from "interfaces-mef-types/rc/case-records";
import type { RcConsequenceMetric } from "interfaces-mef-types/rc/metrics";
import type { RcSourceTermValues } from "interfaces-mef-types/rc/source-term";
import type { RcTransportSettings } from "interfaces-mef-types/rc/transport";
import type { RcWeatherRecord, RcWeatherTrial } from "interfaces-mef-types/rc/weather";
import { currentRcCase } from "interfaces-shared-types/rc-workbooks/case-records";
import { rcMetricPresets } from "interfaces-shared-types/rc-workbooks/metrics";
import { decodeRcText } from "interfaces-shared-types/rc-workbooks/source-term-parser";
import { parseRcWeather } from "interfaces-shared-types/rc-workbooks/weather-parser";
import { generateWeatherTrials } from "interfaces-shared-types/rc-workbooks/weather-trials";
import { createPublishedRcSeed, RC_PUBLISHED_CATEGORY, readRcPublishedFile } from "../../example-workbooks/seeds/rc-published-inputs-seed";
import { adaptRcCaseRequests, type AdaptedOpenRcCase } from "../openrc-case-adapters";

interface PublishedOpenRcCase {
  saved: RcCaseData;
  firstHour: RcWeatherTrial[];
  hourly: RcWeatherTrial[];
}

interface OpenRcReferenceCase {
  name: string;
  adapted: AdaptedOpenRcCase;
}

function preset(key: string, id: string): RcConsequenceMetric {
  const found = rcMetricPresets.find((candidate) => candidate.key === key);
  if (found === undefined) throw new Error(`No metric preset ${key}`);
  return { id, ...found.metric };
}

const LMP = preset("lmp-fc", "RCM-01");
const EPZ = preset("epz", "RCM-02");
const QHO = preset("qho-early", "RCM-03");

function trial(id: string, stabilityClass: RcWeatherRecord["stabilityClass"], speed: number, toward: number, mixing: number, probability: number, rain = 0): RcWeatherTrial {
  return {
    id,
    source: "constant",
    selectionGroup: "Fixed direction",
    probability,
    windSpeedMetresPerSecond: speed,
    windTowardDegrees: toward,
    stabilityClass,
    rainMillimetresPerHour: rain,
    mixingHeightMetres: mixing,
  };
}

const ONE_TRIAL = [trial("CONST", "D", 3, 90, 1000, 1)];
const FOUR_TRIALS = [trial("T1", "E", 2.2, 84.375, 140, 0.25), trial("T2", "B", 1.4, 286.875, 177, 0.25), trial("T3", "F", 0.5, 22.5, 100, 0.25), trial("T4", "C", 4.5, 0, 758, 0.25)];
const RECEPTOR = { distanceMetres: 1000, heightMetres: 0 };

function exampleSource(): RcSourceTermValues {
  return {
    groups: [
      { id: 1, name: "Noble gases" },
      { id: 2, name: "Alkali metals" },
      { id: 3, name: "Halogens" },
    ],
    inventory: [
      { name: "Cs-137", activityBq: 1e12, group: 2 },
      { name: "I-131", activityBq: 1e12, group: 3 },
      { name: "Xe-133", activityBq: 1e12, group: 1 },
    ],
    releases: [{ id: 1, startSeconds: 0, durationSeconds: 3600, heightMetres: 0, fractions: [1, 1, 1] }],
  };
}

function exampleSettings(): RcTransportSettings {
  return {
    decayMode: "parent",
    groupVelocities: [
      { groupId: 1, name: "Noble gases", velocity: 0, basis: "noble_gas" },
      { groupId: 2, name: "Alkali metals", velocity: 0.003, basis: "openrc_default" },
      { groupId: 3, name: "Halogens", velocity: 0.003, basis: "openrc_default" },
    ],
  };
}

function caseOf(source: RcSourceTermValues = exampleSource(), settings: RcTransportSettings = exampleSettings(), categoryId = "RC-1"): RcCaseData {
  return {
    schemaVersion: 3,
    categoryId,
    metrics: [LMP, EPZ, QHO],
    source: { revision: 1, values: source },
    transport: { revision: 1, decayFiles: [], categories: [{ categoryId, savedForSourceRevision: 1, settings }] },
  };
}

function delayedSource(): RcSourceTermValues {
  const source = exampleSource();
  source.releases = [
    { id: 1, startSeconds: 1334.1, durationSeconds: 3600.4, heightMetres: 10, fractions: [0.5, 0.25, 0.125] },
    { id: 2, startSeconds: 3677.4, durationSeconds: 3599.3, heightMetres: 25, fractions: [0.25, 0.125, 0.0000054657] },
  ];
  return source;
}

function splitSource(): RcSourceTermValues {
  const source = exampleSource();
  source.groups.push({ id: 4, name: "Rubidium" });
  source.inventory.push({ name: "Rb-88", activityBq: 4e12, group: 4 }, { name: "Cs-134", activityBq: 2e12, group: 2 });
  source.releases[0].fractions.push(0.25);
  return source;
}

function splitSettings(): RcTransportSettings {
  const settings = exampleSettings();
  settings.groupVelocities.push({ groupId: 4, name: "Rubidium", velocity: 0.01, basis: "analyst" });
  return settings;
}

function exponentSource(): RcSourceTermValues {
  return {
    groups: [
      { id: 1, name: "Noble gases" },
      { id: 2, name: "Alkali metals" },
      { id: 3, name: "Halogens" },
    ],
    inventory: [
      { name: "Cs-137", activityBq: 1e21, group: 2 },
      { name: "I-131", activityBq: 2.5e22, group: 3 },
      { name: "Xe-133", activityBq: 1.5e-7, group: 1 },
    ],
    releases: [{ id: 1, startSeconds: 0.5, durationSeconds: 1e-3, heightMetres: 123.456, fractions: [1, 1e-7, 2.5e-9] }],
  };
}

function exponentSettings(): RcTransportSettings {
  return {
    decayMode: "parent",
    groupVelocities: [
      { groupId: 1, name: "Noble gases", velocity: 0, basis: "noble_gas" },
      { groupId: 2, name: "Alkali metals", velocity: 1e-7, basis: "analyst" },
      { groupId: 3, name: "Halogens", velocity: 9.999, basis: "analyst" },
    ],
  };
}

const EXPONENT_TRIALS = [trial("X1", "A", 0.05, 359.99, 12345.678, 0.5), trial("X2", "F", 29.75, -90, 100.25, 0.5)];
const EXPONENT_RECEPTOR = { distanceMetres: 123456.789, heightMetres: 2.5 };
const CLASS_G_TRIALS = [trial("G1", "D", 3, 90, 1000, 0.5), trial("G2", "G", 3, 90, 1000, 0.3), trial("G3", "F", 1, 22.5, 100, 0.2)];

function publishedCase(): PublishedOpenRcCase {
  const saved = currentRcCase(createPublishedRcSeed(), RC_PUBLISHED_CATEGORY);
  const records = parseRcWeather(decodeRcText(readRcPublishedFile("MacMetGen-Noah-published-day.MET"))).records;
  const weather = saved.weather;
  if (weather?.model === undefined) throw new Error("The published case has no weather model");
  return {
    saved,
    firstHour: generateWeatherTrials(weather, records).trials,
    hourly: generateWeatherTrials({ ...weather, model: { ...weather.model, mode: "stratified", sampling: { randomSeed: 1, samplesPerDay: 24 } } }, records).trials,
  };
}

function openRcReferenceCases(published: PublishedOpenRcCase): OpenRcReferenceCase[] {
  const delayedSettings = exampleSettings();
  delayedSettings.groupVelocities[1] = { groupId: 2, name: "Alkali metals", velocity: 0.015603372126679999, basis: "source_file" };
  const withUngrouped = splitSource();
  withUngrouped.inventory.push({ name: "Co-60", activityBq: 2e11, group: 2 });
  return [
    {
      name: "boundary dose, one weather trial",
      adapted: adaptRcCaseRequests({ caseData: caseOf(), metricId: "RCM-01", receptor: RECEPTOR, trials: ONE_TRIAL }),
    },
    {
      name: "distance dose, four weather trials, delayed elevated release",
      adapted: adaptRcCaseRequests({
        caseData: caseOf(delayedSource(), delayedSettings, "RC 100% = worst case"),
        metricId: "RCM-02",
        receptor: { distanceMetres: 425.5, heightMetres: 1.5 },
        trials: FOUR_TRIALS,
      }),
    },
    {
      name: "one engine group released two ways",
      adapted: adaptRcCaseRequests({ caseData: caseOf(withUngrouped, splitSettings()), metricId: "RCM-01", receptor: RECEPTOR, trials: ONE_TRIAL }),
    },
    {
      name: "daughter ingrowth, four weather trials",
      adapted: adaptRcCaseRequests({ caseData: caseOf(exampleSource(), { ...exampleSettings(), decayMode: "ingrowth" }), metricId: "RCM-01", receptor: RECEPTOR, trials: FOUR_TRIALS }),
    },
    {
      name: "published source term, 24 published weather hours, 746 m",
      adapted: adaptRcCaseRequests({ caseData: published.saved, metricId: "RCM-01", receptor: { distanceMetres: 746, heightMetres: 0 }, trials: published.hourly }),
    },
    {
      name: "published source term, first published weather hour, 8046.7 m",
      adapted: adaptRcCaseRequests({ caseData: published.saved, metricId: "RCM-02", receptor: { distanceMetres: 8046.7, heightMetres: 0 }, trials: published.firstHour }),
    },
    {
      name: "very large and very small numbers",
      adapted: adaptRcCaseRequests({ caseData: caseOf(exponentSource(), exponentSettings()), metricId: "RCM-01", receptor: EXPONENT_RECEPTOR, trials: EXPONENT_TRIALS }),
    },
    {
      name: "stability class G and unequal trial probabilities, three weather trials",
      adapted: adaptRcCaseRequests({ caseData: caseOf(), metricId: "RCM-01", receptor: RECEPTOR, trials: CLASS_G_TRIALS }),
    },
  ];
}

export {
  CLASS_G_TRIALS,
  EPZ,
  EXPONENT_RECEPTOR,
  EXPONENT_TRIALS,
  FOUR_TRIALS,
  LMP,
  ONE_TRIAL,
  QHO,
  RECEPTOR,
  caseOf,
  delayedSource,
  exampleSettings,
  exampleSource,
  exponentSettings,
  exponentSource,
  openRcReferenceCases,
  publishedCase,
  splitSettings,
  splitSource,
  trial,
};
export type { OpenRcReferenceCase, PublishedOpenRcCase };
