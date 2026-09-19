import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcCaseData, RcCaseCheck, RcCaseFile, RcCaseDataset, RcCaseTable } from "interfaces-mef-types/rc/case-records";
import type { RcWeatherRecord } from "interfaces-mef-types/rc/weather";
import { RcSourceTermValuesSchema } from "interfaces-mef-types/zod/rc/source-term";
import { siteReceptorIssues, receptorCount, evaluatedReceptor } from "./site-receptors";
import { weatherIssues, weatherIsReviewed, weatherSectorCount, windToward } from "./weather";
import { decayCoverage } from "./transport";
import { doseCoverage, dosePathways, dosePathwayNames } from "./dose-inputs";

export const caseSteps = ["source", "site", "weather", "transport", "dose"] as const;
export const caseStepNames = { source: "Source term", site: "Site and receptors", weather: "Meteorology", transport: "Atmospheric dispersion", dose: "Dosimetry" };
export const caseDatasets: Record<RcCaseDataset, { label: string; step: typeof caseSteps[number] }> = {
  inventory: { label: "01 · Inventory", step: "source" }, releases: { label: "01 · Release segments", step: "source" }, fractions: { label: "01 · Release fractions", step: "source" },
  receptors: { label: "02 · Evaluation positions", step: "site" }, weather: { label: "03 · Weather trials", step: "weather" }, deposition: { label: "04 · Group deposition", step: "transport" },
  decay: { label: "04 · Decay coverage", step: "transport" }, dose: { label: "05 · Dose coverage", step: "dose" },
};
export function currentRcCase(rc: RadiologicalConsequenceAnalysis, categoryId: string): RcCaseData {
  const transport = rc.atmosphericTransportAndDispersion.transportInputs, dose = rc.dosimetry.doseInputs;
  return { schemaVersion: 1, categoryId, source: rc.releaseCategoryToConsequence.releaseCategoryInputs.find(c => c.releaseCategory === categoryId)?.sourceTerm,
    site: rc.protectiveActionParameters.siteAndReceptors, weather: rc.meteorologicalData.weatherInputs,
    transport: transport && { ...transport, categories: transport.categories.filter(c => c.categoryId === categoryId) },
    dose: dose && { ...dose, categories: dose.categories.filter(c => c.categoryId === categoryId) } };
}
export const caseVersions = (c: RcCaseData) => caseSteps.map(k => c[k]?.revision ?? 0).join(",");
export const caseDuration = (c: RcCaseData) => c.dose?.categories.find(d => d.categoryId === c.categoryId)?.settings?.integrationSeconds;
export const caseReceptorCount = (c: RcCaseData) => siteReceptorIssues(c.site?.settings ?? {}, c.site?.geometry).length ? 0 : receptorCount(c.site?.geometry);
export const caseTrialId = (r: RcWeatherRecord) => `D${String(r.day).padStart(3, "0")}P${String(r.period).padStart(2, "0")}`;
/** IDs identify workbook weather records, not solver-generated trials. */
export function caseReceptorIds(c: RcCaseData): string[] {
  const g = c.site?.geometry;
  if (!g || !caseReceptorCount(c)) return [];
  return g.kind === "cells" ? Array.from({ length: receptorCount(g) }, (_, i) => `S${String(Math.floor(i / g.radiiKm.length) + 1).padStart(2, "0")}R${String(i % g.radiiKm.length + 1).padStart(2, "0")}`) : g.points.map(p => p.id);
}
export function caseChecks(c: RcCaseData): RcCaseCheck[] {
  const source = c.source?.values, t = c.transport?.categories.find(v => v.categoryId === c.categoryId), d = c.dose?.categories.find(v => v.categoryId === c.categoryId);
  const sourceItems: string[] = [], transportItems: string[] = [], doseItems: string[] = [], links: string[] = [];
  if (!source) sourceItems.push("Save or import the Step 01 source inventory and releases.");
  else {
    if (!RcSourceTermValuesSchema.safeParse(source).success) sourceItems.push("Check inventory, group assignments and release fractions in Step 01.");
    for (const [key, label] of [["startSeconds", "start time"], ["durationSeconds", "duration"], ["heightMetres", "release height"]] as const) {
      const missing = source.releases.filter(r => r[key] === undefined).map(r => r.id);
      if (missing.length) sourceItems.push(`Supply ${label} for segments: ${missing.join(", ")}.`);
    }
  }
  const siteItems = siteReceptorIssues(c.site?.settings ?? {}, c.site?.geometry);
  const metItems = weatherIssues(c.weather, c.site?.settings ?? {});
  if (!c.weather?.weatherFile && c.weather?.data) metItems.push("Supply the original weather file.");
  if (c.weather?.data && !weatherIsReviewed(c.weather, c.site?.settings ?? {})) metItems.push("Review and save the weather settings for this site in Step 03.");
  if (!t?.settings) transportItems.push("Save the group deposition velocities and decay mode in Step 04.");
  else if (!source || t.savedForSourceRevision !== c.source?.revision) transportItems.push("Review Step 04 against the current source inventory and save it.");
  if (source && (!t?.settings || source.groups.some(g => !t.settings!.groupVelocities.some(v => v.groupId === g.id && v.name === g.name)))) transportItems.push("Supply a deposition velocity for every source group.");
  const decay = decayCoverage(c.transport, source);
  if (decay.missing.length) transportItems.push(`Parent decay records missing: ${decay.missing.join(", ")}.`);
  if (!d?.settings) doseItems.push("Save a positive integration time in Step 05.");
  else if (!source || d.savedForSourceRevision !== c.source?.revision) doseItems.push("Review Step 05 against the current source inventory and save it.");
  for (const kind of dosePathways) {
    if (!c.dose?.libraries.some(l => l.kind === kind)) doseItems.push(`Import the ${dosePathwayNames[kind].toLowerCase()} coefficient file.`);
    else { const coverage = doseCoverage(c.dose, source, kind); if (coverage.missing.length) doseItems.push(`${dosePathwayNames[kind]} records missing: ${coverage.missing.join(", ")}.`); }
  }
  if (!caseReceptorCount(c)) links.push("No evaluation positions prepared. Complete Step 02.");
  if (!c.weather?.weatherFile || !c.weather.data?.recordCount) links.push("No weather records available for trial references. Complete Step 03.");
  if (!(Number.isFinite(caseDuration(c)) && caseDuration(c)! > 0)) links.push("Integration time must be greater than zero.");
  return [{ key: "source", title: caseStepNames.source, items: sourceItems }, { key: "site", title: caseStepNames.site, items: siteItems }, { key: "weather", title: caseStepNames.weather, items: metItems },
    { key: "transport", title: caseStepNames.transport, items: transportItems }, { key: "dose", title: caseStepNames.dose, items: doseItems }, { key: "links", title: "Case links", items: links }];
}
export function caseFiles(c: RcCaseData): RcCaseFile[] {
  const files: RcCaseFile[] = [];
  const add = (kind: RcCaseFile["kind"], purpose: string, file?: RcCaseFile["file"]) => { if (file && !files.some(f => f.file.documentId === file.documentId)) files.push({ kind, purpose, file }); };
  add("source", "01 · Original inventory and release records", c.source?.originalFile);
  add("site", "02 · Original geometry", c.site?.geometryFile); add("site", "02 · Original location", c.site?.locationFile);
  add("weather", "03 · Original meteorology", c.weather?.weatherFile); add("weather", "03 · Generation settings", c.weather?.configurationFile);
  add("transport", "04 · Deposition reference", c.transport?.categories.find(v => v.categoryId === c.categoryId)?.deposition?.file);
  add("transport", "04 · Dispersion reference", c.transport?.dispersionReference?.file);
  c.transport?.decayFiles.forEach(f => add("transport", "04 · Decay data", f.file));
  add("dose", "05 · Exposure settings", c.dose?.categories.find(v => v.categoryId === c.categoryId)?.exposure?.file);
  c.dose?.libraries.forEach(l => add("dose", `05 · ${dosePathwayNames[l.kind]} coefficients`, l.file));
  return files;
}
export function caseSummaryRows(c: RcCaseData): [string, string][] {
  const s = c.source?.values, g = c.site?.geometry, w = c.weather, t = c.transport?.categories.find(v => v.categoryId === c.categoryId), coverage = decayCoverage(c.transport, s);
  return [[c.source?.originalFile?.filename ?? (s ? "Entered source values" : "Source not supplied"), `${s?.inventory.length ?? 0} nuclides · ${s?.groups.length ?? 0} groups · ${s?.releases.length ?? 0} segments`],
    [g?.kind === "cells" ? `${receptorCount(g)} receptor cells` : `${receptorCount(g)} receptor points`, `${c.site?.settings.latitude ?? "—"}, ${c.site?.settings.longitude ?? "—"} · ${caseReceptorCount(c)} evaluation positions`],
    [`${w?.data?.recordCount ?? 0} imported weather records`, w?.data ? `Year ${w.settings.year ?? "—"} · ${weatherSectorCount(w) ?? "—"} wind sectors` : w?.collectionRequest ? `Collection request: ${w.collectionRequest.start} to ${w.collectionRequest.end}` : "Import weather records in Step 03"],
    [`${t?.settings?.groupVelocities.length ?? 0} group deposition velocities`, `${coverage.found.length}/${coverage.total} parent records · ${t?.settings ? t.settings.decayMode === "parent" ? "Parent decay" : "With daughter ingrowth" : "Decay mode not saved"}`],
    [caseDuration(c) === undefined ? "Integration time not saved" : `${caseDuration(c)} s integration time`, dosePathways.map(k => `${dosePathwayNames[k]} ${doseCoverage(c.dose, s, k).found.length}/${s?.inventory.length ?? 0}`).join(" · ")]];
}
export function caseTable(c: RcCaseData, kind: RcCaseDataset, offset: number, weatherRecords: RcWeatherRecord[] = []): RcCaseTable {
  const s = c.source?.values, out: RcCaseTable = { columns: [], rows: [], units: "", offset, total: 0 };
  const fill = (columns: string[], units: string, total: number, row: (i: number) => (string | number | null)[]) => {
    Object.assign(out, { columns, units, total, rows: Array.from({ length: Math.max(0, Math.min(5, total - offset)) }, (_, i) => row(offset + i)) });
  };
  switch (kind) {
    case "inventory": fill(["Radionuclide", "Inventory (Bq)", "Group"], "Activity: Bq. Group IDs link inventory to release fractions.", s?.inventory.length ?? 0, i => { const n = s!.inventory[i]; return [n.name, n.activityBq, n.group]; }); break;
    case "releases": fill(["Segment", "Start (s)", "Duration (s)", "Height (m)"], "Times: seconds from accident start. Release height: m above ground.", s?.releases.length ?? 0, i => { const r = s!.releases[i]; return [r.id, r.startSeconds ?? null, r.durationSeconds ?? null, r.heightMetres ?? null]; }); break;
    case "fractions": fill(["Segment", "Group", "Fraction"], "Fraction of group inventory released in each segment: 0–1.", (s?.releases.length ?? 0) * (s?.groups.length ?? 0), i => { const r = s!.releases[Math.floor(i / s!.groups.length)], g = s!.groups[i % s!.groups.length]; return [r.id, `${g.id} · ${g.name}`, r.fractions[i % s!.groups.length]]; }); break;
    case "receptors": fill(["Receptor ID", "Distance (m)", "Bearing (°)", "Height (m)"], `Distance and height: m. Bearing clockwise from ${c.site?.geometry?.kind === "cells" ? "compass" : "grid"} north.`, caseReceptorCount(c), i => { const r = evaluatedReceptor(c.site!.geometry!, c.site!.settings, i); return [r.id, r.distanceMetres, r.bearingDegrees, r.heightMetres]; }); break;
    case "weather": fill(["Trial ID", "Speed (m/s)", "Toward (°)", "Stability"], "Toward: degrees clockwise from north. D = day of year; P = period in file. IDs reference weather rows; no sampling is performed.", weatherRecords.length, i => { const r = weatherRecords[i]; return [caseTrialId(r), r.windSpeedMetresPerSecond, windToward(r, weatherSectorCount(c.weather)) ?? null, r.stabilityClass]; }); break;
    case "deposition": fill(["Group", "Velocity (m/s)"], "Saved group deposition velocity: m/s.", s?.groups.length ?? 0, i => { const g = s!.groups[i]; return [`${g.id} · ${g.name}`, c.transport?.categories.find(v => v.categoryId === c.categoryId)?.settings?.groupVelocities.find(v => v.groupId === g.id && v.name === g.name)?.velocity ?? null]; }); break;
    case "decay": { const covered = new Set(decayCoverage(c.transport, s).found); fill(["Radionuclide", "Parent record"], "Parent record presence by inventory nuclide. Record coverage does not check daughter chains.", s?.inventory.length ?? 0, i => [s!.inventory[i].name, covered.has(s!.inventory[i].name) ? "Present" : "Not supplied"]); break; }
    case "dose": fill(["Pathway", "Names covered", "Missing"], `Integration time: ${caseDuration(c) ?? "not saved"}${caseDuration(c) === undefined ? "" : " s"}. Coefficient quantities and units are retained in original files.`, 3, i => { const k = dosePathways[i], cv = doseCoverage(c.dose, s, k); return [dosePathwayNames[k], `${cv.found.length}/${cv.total}`, cv.missing.join(", ") || (cv.total ? "None" : "Inventory not supplied")]; }); break;
  }
  return out;
}
