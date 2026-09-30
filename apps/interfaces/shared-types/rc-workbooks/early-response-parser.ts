import type { RcEarlyResponseCohort, RcEarlyResponseModel } from "interfaces-mef-types/rc/early-response";

export function blankEarlyResponseModel(): RcEarlyResponseModel {
  return { revision: 1, population: { source: "UNSET", weighting: "UNSET" }, movement: { model: "UNSET" }, iodineProtection: "UNSET", cohorts: [] };
}

/** Reads only unambiguous MACCS cohort records. Other cards remain available for review. */
export function parseEarlyResponseRecords(text: string, previous?: RcEarlyResponseModel): RcEarlyResponseModel {
  const blocks: { name: string; records: { card: string; value: string }[] }[] = [];
  let current = { name: "Imported cohort", records: [] as { card: string; value: string }[] };
  for (const line of text.split(/\r?\n/)) {
    const heading = /^\s*\*\s*(.+?\bCohort)\b/i.exec(line);
    if (heading) {
      if (current.records.length) blocks.push(current);
      current = { name: heading[1].trim(), records: [] }; continue;
    }
    if (/^\s*(?:\*|!|$)/.test(line)) continue;
    const record = /^\s*([A-Z][A-Z0-9_]{3,})\s+([^\s*!]+)/i.exec(line);
    if (record) current.records.push({ card: record[1].toUpperCase(), value: record[2] });
  }
  if (current.records.length) blocks.push(current);
  const recognized = blocks.some(block => block.records.some(({ card }) => /^EZ(?:WTFRAC|DLTSHL|DLTEVA|OALARM)\d{3}$/.test(card)));
  if (!recognized) throw new Error("No supported MACCS response cards found (WTFRAC, DLTSHL, DLTEVA, OALARM).");
  const model: RcEarlyResponseModel = previous ? structuredClone(previous) : blankEarlyResponseModel();
  const unassigned: NonNullable<RcEarlyResponseModel["unassignedRecords"]> = [];
  const seen = new Set<string>();
  const cohorts: RcEarlyResponseCohort[] = blocks.map((block, index) => {
    const id = `cohort-${index + 1}`;
    const old = previous?.cohorts.find(cohort => cohort.id === id);
    const cohort: RcEarlyResponseCohort = old ? structuredClone(old) : { id, name: block.name, evacuation: { shape: "UNSET" } };
    cohort.name = block.name;
    const delays: { shelter: Map<number, number>; evacuation: Map<number, number> } = { shelter: new Map(), evacuation: new Map() };
    for (const record of block.records) {
      const match = /^EZ(WTFRAC|DLTSHL|DLTEVA|OALARM)(\d{3})$/.exec(record.card);
      const number = Number(record.value.replace(/[dD]/g, "E"));
      if (!match || !Number.isFinite(number) || seen.has(`${id}:${record.card}`)) { unassigned.push({ cohortId: id, ...record }); continue; }
      seen.add(`${id}:${record.card}`);
      const [, kind, suffix] = match, band = Number(suffix);
      if (kind === "WTFRAC" && band === 1 && number >= 0 && number <= 1) cohort.resultWeightFraction = number;
      else if (kind === "OALARM" && band === 1 && number >= 0) cohort.evacuation.notificationAfterAccidentSeconds = number;
      else if (kind === "DLTSHL" && band > 0 && number >= 0) delays.shelter.set(band, number);
      else if (kind === "DLTEVA" && band > 0 && number >= 0) delays.evacuation.set(band, number);
      else unassigned.push({ cohortId: id, ...record });
    }
    for (const [key, target] of [["shelter", "shelterDelaySecondsByBand"], ["evacuation", "evacuationDelaySecondsByBand"]] as const) {
      const values = delays[key];
      if (values.size && Array.from({ length: values.size }, (_, i) => i + 1).every(i => values.has(i))) cohort.evacuation[target] = Array.from({ length: values.size }, (_, i) => values.get(i + 1)!);
      else for (const [band, value] of values) unassigned.push({ cohortId: id, card: `EZ${key === "shelter" ? "DLTSHL" : "DLTEVA"}${String(band).padStart(3, "0")}`, value: String(value) });
    }
    return cohort;
  });
  model.cohorts = cohorts;
  model.unassignedRecords = unassigned;
  return model;
}
