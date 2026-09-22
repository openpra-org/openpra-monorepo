import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcCaseData, RcCaseCheck, RcCaseFile, RcCaseDataset, RcCaseTable, RcCaseStep } from "interfaces-mef-types/rc/case-records";
import type { RcWeatherRecord, RcWeatherTrial } from "interfaces-mef-types/rc/weather";
import { RcSourceTermValuesSchema } from "interfaces-mef-types/zod/rc/source-term";
import { siteReceptorIssues, receptorCount, evaluatedReceptor, sitePopulation } from "./site-receptors";
import { weatherIssues, weatherIsReviewed } from "./weather";
import { weatherTreatmentNames } from "./weather-trials";
import { decayCoverage } from "./transport";
import { doseCoverage, dosePathways, dosePathwayNames } from "./dose-inputs";
import { effectiveResponseTiming, responseIssues } from "./protective-response";
import { rcEconomicCostCoverage, rcEconomicCostIssues, rcEconomicCostSpecs } from "./economic-costs";
import { rcHealthEffectLabel } from "./health-input-parser";

export const caseSteps = ["source", "site", "weather", "transport", "dose", "health", "economy"] as const;
export const caseStepNames = { source: "Source term", site: "Site and receptors", weather: "Meteorology", transport: "Atmospheric dispersion", dose: "Dosimetry", health: "Health effects", economy: "Economic factors" };
export const caseDatasets: Record<RcCaseDataset, { label: string; step: typeof caseSteps[number] }> = {
  inventory: { label: "01 · Inventory", step: "source" }, releases: { label: "01 · Release segments", step: "source" }, fractions: { label: "01 · Release fractions", step: "source" },
  receptors: { label: "02 · Evaluation positions", step: "site" }, response: { label: "02 · Response groups", step: "site" }, weather: { label: "03 · Weather trials", step: "weather" }, deposition: { label: "04 · Group deposition", step: "transport" },
  decay: { label: "04 · Decay coverage", step: "transport" }, dose: { label: "05 · Dose coverage", step: "dose" },
  health: { label: "06 · Health parameters", step: "health" }, healthModel: { label: "06 · Health model", step: "health" }, riskSources: { label: "06 · Risk-factor sources", step: "health" },
  regions: { label: "07 · Economic regions", step: "economy" }, crops: { label: "07 · Crop seasons", step: "economy" },
  costs: { label: "07 · Cost parameters", step: "economy" }, economySettings: { label: "07 · Economy settings", step: "economy" },
};
export function currentRcCase(rc: RadiologicalConsequenceAnalysis, categoryId: string): RcCaseData {
  const transport = rc.atmosphericTransportAndDispersion.transportInputs, dose = rc.dosimetry.doseInputs;
  const aspectSteps = { RCPA: "site", RCME: "weather", RCAD: "transport", RCDO: "dose", RCHE: "health", RCEC: "economy" } as const;
  const excludedSteps: RcCaseStep[] = (rc.scope?.evaluationDecisions ?? []).filter(decision => !decision.included && decision.subElement in aspectSteps)
    .map(decision => aspectSteps[decision.subElement as keyof typeof aspectSteps]);
  return { schemaVersion: 2, categoryId, source: rc.releaseCategoryToConsequence.releaseCategoryInputs.find(c => c.releaseCategory === categoryId)?.sourceTerm,
    site: rc.protectiveActionParameters.siteAndReceptors,
    response: { protectiveActionsIncluded: rc.protectiveActionParameters.protectiveActionsIncluded, cohortModeling: rc.protectiveActionParameters.cohortModeling,
      responseTiming: effectiveResponseTiming(rc.protectiveActionParameters), earlyResponseModel: rc.protectiveActionParameters.earlyResponseModel }, weather: rc.meteorologicalData.weatherInputs,
    transport: transport && { ...transport, categories: transport.categories.filter(c => c.categoryId === categoryId) },
    dose: dose && { ...dose, categories: dose.categories.filter(c => c.categoryId === categoryId) },
    health: rc.healthEffects, economy: rc.economicFactors, excludedSteps };
}
const objectVersion = (value: unknown) => {
  const json = JSON.stringify(value ?? {});
  let hash = 2166136261;
  for (let index = 0; index < json.length; index++) hash = Math.imul(hash ^ json.charCodeAt(index), 16777619) >>> 0;
  return hash;
};
export const caseVersions = (c: RcCaseData) => `${[c.source, c.site, c.weather, c.transport, c.dose].map(v => v?.revision ?? 0).join(",")},${objectVersion({ response: c.response, excludedSteps: c.excludedSteps })},${objectVersion(c.health)},${objectVersion(c.economy)}`;
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
  const sourceItems: string[] = [], transportItems: string[] = [], doseItems: string[] = [], healthItems: string[] = [], economyItems: string[] = [], links: string[] = [];
  if (!source) sourceItems.push("Save or import the Step 01 source inventory and releases.");
  else {
    if (!RcSourceTermValuesSchema.safeParse(source).success) sourceItems.push("Check inventory, group assignments and release fractions in Step 01.");
    for (const [key, label] of [["startSeconds", "start time"], ["durationSeconds", "duration"], ["heightMetres", "release height"]] as const) {
      const missing = source.releases.filter(r => r[key] === undefined).map(r => r.id);
      if (missing.length) sourceItems.push(`Supply ${label} for segments: ${missing.join(", ")}.`);
    }
  }
  const siteItems = siteReceptorIssues(c.site?.settings ?? {}, c.site?.geometry);
  siteItems.push(...responseIssues(c.response, c.site));
  const metItems = weatherIssues(c.weather, c.site?.settings ?? {}, c.site?.geometry);
  if (!c.weather?.weatherFile && c.weather?.data) metItems.push("Supply the original weather file.");
  if ((c.weather?.data || c.weather?.model?.mode === "constant") && !weatherIsReviewed(c.weather, c.site?.settings ?? {}, c.site?.geometry)) metItems.push("Review and save the weather trials for this site in Step 03.");
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
  const health = c.health;
  if (!health?.healthInput?.records.length) healthItems.push("Import health-effect parameter records in Step 06.");
  if (!health?.earlyHealthEffects.some(effect => effect.trim())) healthItems.push("Select an early health effect in Step 06.");
  if (!health?.latentHealthEffects.some(effect => effect.trim())) healthItems.push("Select a latent health effect in Step 06.");
  if (!health?.riskFactorSources.some(row => row.source.trim() && row.recognizedBody.trim() && row.version?.trim())) healthItems.push("Record a risk-factor source, recognized body and version in Step 06.");
  if (health?.healthInput) {
    const known = new Set(health.healthInput.records.map(rcHealthEffectLabel));
    const missing = [...health.earlyHealthEffects, ...health.latentHealthEffects].filter(effect => effect.trim() && !known.has(effect));
    if (missing.length) healthItems.push(`Selected effects without a matching imported parameter card: ${missing.join(", ")}.`);
  }
  const economy = c.economy, econInput = economy?.siteEconomyInput;
  if (!econInput) economyItems.push("Supply the site economy file in Step 07.");
  else {
    if (econInput.regions.length !== econInput.expectedRegions) economyItems.push(`Regional economy coverage: ${econInput.regions.length} of ${econInput.expectedRegions} rows.`);
    if (econInput.sourceSiteRevision !== undefined && econInput.sourceSiteRevision !== c.site?.revision) economyItems.push("The Step 02 site file changed after the economy import. Reimport in Step 07.");
  }
  if (economy) {
    const coverage = rcEconomicCostCoverage(economy);
    if (economy.decontaminationLevels === undefined) economyItems.push("Choose decontamination levels in Step 07.");
    else if (!coverage.complete) economyItems.push(`Cost parameters: ${coverage.supplied} of ${coverage.required} required values supplied.`);
    economyItems.push(...rcEconomicCostIssues(economy.costParameterEstimates, economy.decontaminationLevels));
    if (!economy.parameterConsistencyConfirmed) economyItems.push("Review the site coverage and cost parameters in Step 07.");
  }
  if (!caseReceptorCount(c)) links.push("No evaluation positions prepared. Complete Step 02.");
  if (!c.weather?.trialSet?.trialCount) links.push("No generated weather trials available. Complete Step 03.");
  if (!(Number.isFinite(caseDuration(c)) && caseDuration(c)! > 0)) links.push("Integration time must be greater than zero.");
  const checks: RcCaseCheck[] = [{ key: "source", title: caseStepNames.source, items: sourceItems }, { key: "site", title: caseStepNames.site, items: siteItems }, { key: "weather", title: caseStepNames.weather, items: metItems },
    { key: "transport", title: caseStepNames.transport, items: transportItems }, { key: "dose", title: caseStepNames.dose, items: doseItems },
    { key: "health", title: caseStepNames.health, items: healthItems }, { key: "economy", title: caseStepNames.economy, items: economyItems }, { key: "links", title: "Case links", items: links }];
  return checks.filter(check => check.key === "links" || !c.excludedSteps?.includes(check.key));
}
export function caseFiles(c: RcCaseData): RcCaseFile[] {
  const files: RcCaseFile[] = [];
  const add = (kind: RcCaseFile["kind"], purpose: string, file?: RcCaseFile["file"]) => { if (file && !files.some(f => f.file.documentId === file.documentId)) files.push({ kind, purpose, file }); };
  add("source", "01 · Original inventory and release records", c.source?.originalFile);
  add("site", "02 · Original geometry", c.site?.geometryFile); add("site", "02 · Original location", c.site?.locationFile);
  add("response", "02 · Original response records", c.response?.earlyResponseModel?.originalFile);
  add("weather", "03 · Original meteorology", c.weather?.weatherFile); add("weather", "03 · Generation settings", c.weather?.configurationFile);
  add("transport", "04 · Deposition reference", c.transport?.categories.find(v => v.categoryId === c.categoryId)?.deposition?.file);
  add("transport", "04 · Dispersion reference", c.transport?.dispersionReference?.file);
  c.transport?.decayFiles.forEach(f => add("transport", "04 · Decay data", f.file));
  add("dose", "05 · Exposure settings", c.dose?.categories.find(v => v.categoryId === c.categoryId)?.exposure?.file);
  c.dose?.libraries.forEach(l => add("dose", `05 · ${dosePathwayNames[l.kind]} coefficients`, l.file));
  return files;
}
export function caseEmbeddedFiles(c: RcCaseData) {
  return [
    ...(c.health?.healthInput?.original ? [{ id: "health-original" as const, filename: c.health.healthInput.filename, purpose: "06 · Health parameter source" }] : []),
    ...(c.economy?.siteEconomyInput?.original ? [{ id: "economy-original" as const, filename: c.economy.siteEconomyInput.filename, purpose: "07 · Site economy source" }] : []),
  ];
}
export function caseSummaryRows(c: RcCaseData): [string, string][] {
  const s = c.source?.values, g = c.site?.geometry, w = c.weather, t = c.transport?.categories.find(v => v.categoryId === c.categoryId), coverage = decayCoverage(c.transport, s);
  return [[c.source?.originalFile?.filename ?? (s ? "Entered source values" : "Source not supplied"), `${s?.inventory.length ?? 0} nuclides · ${s?.groups.length ?? 0} groups · ${s?.releases.length ?? 0} segments`],
    [g?.kind === "cells" ? `${receptorCount(g)} receptor cells` : `${receptorCount(g)} receptor points`, `${c.site?.settings.latitude ?? "—"}, ${c.site?.settings.longitude ?? "—"} · ${caseReceptorCount(c)} evaluation positions${g?.kind === "cells" && g.populationByCell ? ` · ${g.populationByCell.reduce((sum, count) => sum + count, 0)} people` : ""}`],
    [`${w?.trialSet?.trialCount ?? 0} generated weather trials`, w?.trialSet && w.model ? `${weatherTreatmentNames[w.model.mode]} · probability ${w.trialSet.probabilityTotal}` : w?.data ? `${w.data.recordCount} records awaiting trial generation` : w?.collectionRequest ? `Collection request: ${w.collectionRequest.start} to ${w.collectionRequest.end}` : "Complete Step 03"],
    [`${t?.settings?.groupVelocities.length ?? 0} group deposition velocities`, `${coverage.found.length}/${coverage.total} parent records · ${t?.settings ? t.settings.decayMode === "parent" ? "Parent decay" : "With daughter ingrowth" : "Decay mode not saved"}`],
    [caseDuration(c) === undefined ? "Integration time not saved" : `${caseDuration(c)} s integration time`, dosePathways.map(k => `${dosePathwayNames[k]} ${doseCoverage(c.dose, s, k).found.length}/${s?.inventory.length ?? 0}`).join(" · ")],
    [`${c.health?.healthInput?.records.length ?? 0} health parameter cards`, `${c.health?.earlyHealthEffects.length ?? 0} early effects · ${c.health?.latentHealthEffects.length ?? 0} latent effects · ${c.health?.riskFactorSources.length ?? 0} risk-factor ${c.health?.riskFactorSources.length === 1 ? "source" : "sources"}`],
    [`${c.economy?.siteEconomyInput?.regions.length ?? 0} of ${c.economy?.siteEconomyInput?.expectedRegions ?? 0} economic regions`, c.economy ? `${c.economy.siteEconomyInput?.crops.length ?? 0} crops · ${rcEconomicCostCoverage(c.economy).supplied} of ${rcEconomicCostCoverage(c.economy).required} cost values` : "No economic inputs"]];
}
export function caseTable(c: RcCaseData, kind: RcCaseDataset, offset: number, weatherTrials: RcWeatherTrial[] = []): RcCaseTable {
  const s = c.source?.values, out: RcCaseTable = { columns: [], rows: [], units: "", offset, total: 0 };
  const fill = (columns: string[], units: string, total: number, row: (i: number) => (string | number | null)[]) => {
    Object.assign(out, { columns, units, total, rows: Array.from({ length: Math.max(0, Math.min(5, total - offset)) }, (_, i) => row(offset + i)) });
  };
  switch (kind) {
    case "inventory": fill(["Radionuclide", "Inventory (Bq)", "Group"], "Activity: Bq. Group IDs link inventory to release fractions.", s?.inventory.length ?? 0, i => { const n = s!.inventory[i]; return [n.name, n.activityBq, n.group]; }); break;
    case "releases": fill(["Segment", "Start (s)", "Duration (s)", "Height (m)"], "Times: seconds from accident start. Release height: m above ground.", s?.releases.length ?? 0, i => { const r = s!.releases[i]; return [r.id, r.startSeconds ?? null, r.durationSeconds ?? null, r.heightMetres ?? null]; }); break;
    case "fractions": fill(["Segment", "Group", "Fraction"], "Fraction of group inventory released in each segment: 0–1.", (s?.releases.length ?? 0) * (s?.groups.length ?? 0), i => { const r = s!.releases[Math.floor(i / s!.groups.length)], g = s!.groups[i % s!.groups.length]; return [r.id, `${g.id} · ${g.name}`, r.fractions[i % s!.groups.length]]; }); break;
    case "receptors": fill(["Receptor ID", "Distance (m)", "Bearing (°)", "Height (m)", "Population"], `Distance and height: m. Bearing clockwise from ${c.site?.geometry?.kind === "cells" ? "compass" : "grid"} north.`, caseReceptorCount(c), i => { const r = evaluatedReceptor(c.site!.geometry!, c.site!.settings, i); return [r.id, r.distanceMetres, r.bearingDegrees, r.heightMetres, c.site?.geometry?.kind === "cells" ? c.site.geometry.populationByCell?.[i] ?? null : null]; }); break;
    case "response": { const groups = c.response?.cohortModeling?.cohorts ?? [], population = sitePopulation(c.site?.geometry);
      fill(["Group", "Population share (%)", "Population (people)", "Compliance share (%)", "Complying (people)", "Shelter begins (min)", "Evacuation begins (min)", "Speed (m/s)"], "Times are measured from accident start. People are rounded from imported cell counts and group shares.", groups.length, i => {
        const group = groups[i], timing = c.response?.responseTiming, share = group.populationPercent;
        const groupPeople = population === undefined || share === undefined ? null : Math.round(population * share / 100);
        const complyingPeople = population === undefined || share === undefined || group.compliancePercent === undefined ? null : Math.round(population * share * group.compliancePercent / 10000);
        const reference = timing?.referenceAfterAccidentMinutes ?? timing?.declarationAfterAccidentMinutes;
        const applies = !timing?.cohortName || timing.cohortName === group.name;
        const shelter = !applies || reference === undefined || timing?.shelterStartMinutes === undefined ? null : reference + timing.shelterStartMinutes;
        const evacuation = !applies || reference === undefined || timing?.evacuationStartMinutes === undefined ? null : reference + timing.evacuationStartMinutes;
        return [group.name, share ?? null, groupPeople, group.compliancePercent ?? null, complyingPeople, shelter, evacuation, applies ? timing?.evacuationSpeedMetresPerSecond ?? null : null];
      }); break; }
    case "weather": fill(["Trial ID", "Start", "Selection group", "Probability", "Speed (m/s)", "Toward (°)", "Stability", "Rain (mm/h)", "Mixing height (m)"], "Generated Step 03 weather trials and their probability weights.", weatherTrials.length, i => { const trial = weatherTrials[i]; return [trial.id, trial.source === "constant" ? "Constant" : `Day ${trial.day}, period ${trial.period}`, trial.selectionGroup, trial.probability, trial.windSpeedMetresPerSecond, trial.windTowardDegrees, trial.stabilityClass, trial.rainMillimetresPerHour, trial.mixingHeightMetres]; }); break;
    case "deposition": fill(["Group", "Velocity (m/s)"], "Saved group deposition velocity: m/s.", s?.groups.length ?? 0, i => { const g = s!.groups[i]; return [`${g.id} · ${g.name}`, c.transport?.categories.find(v => v.categoryId === c.categoryId)?.settings?.groupVelocities.find(v => v.groupId === g.id && v.name === g.name)?.velocity ?? null]; }); break;
    case "decay": { const covered = new Set(decayCoverage(c.transport, s).found); fill(["Radionuclide", "Parent record"], "Parent record presence by inventory nuclide. Record coverage does not check daughter chains.", s?.inventory.length ?? 0, i => [s!.inventory[i].name, covered.has(s!.inventory[i].name) ? "Present" : "Not supplied"]); break; }
    case "dose": fill(["Pathway", "Names covered", "Missing"], `Integration time: ${caseDuration(c) ?? "not saved"}${caseDuration(c) === undefined ? "" : " s"}. Coefficient quantities and units are retained in original files.`, 3, i => { const k = dosePathways[i], cv = doseCoverage(c.dose, s, k); return [dosePathwayNames[k], `${cv.found.length}/${cv.total}`, cv.missing.join(", ") || (cv.total ? "None" : "Inventory not supplied")]; }); break;
    case "health": { const records = c.health?.healthInput?.records ?? [];
      fill(["Card", "Effect", "Organ", "Parameters", "Selected"], "Original health parameter card values are retained in the snapshot.", records.length, i => { const record = records[i], label = rcHealthEffectLabel(record); return [record.cardId, label, record.organ, record.values.join(", "), [...(c.health?.earlyHealthEffects ?? []), ...(c.health?.latentHealthEffects ?? [])].includes(label) ? "Yes" : "No"]; }); break; }
    case "healthModel": { const h = c.health;
      const rows: (string | number | null)[][] = h ? [["Early effects", h.earlyHealthEffects.join(", ")], ["Latent effects", h.latentHealthEffects.join(", ")],
        ["Early treatment", h.earlyEffectParameters.approach], ["Early treatment basis", h.earlyEffectParameters.description], ["Latent treatment", h.latentEffectParameters.approach],
        ["Latent treatment basis", h.latentEffectParameters.description], ["Age and gender homogeneous", h.ageGenderHomogeneous ? "Yes" : "No"],
        ["Parameter uncertainty", h.parameterUncertaintyCharacterization ?? null]] : [];
      fill(["Setting", "Saved value"], "Health-effect selections and treatment from Step 06.", rows.length, i => rows[i]); break; }
    case "riskSources": { const rows = c.health?.riskFactorSources ?? [];
      fill(["Source", "Recognized body", "Version"], "Risk-factor references recorded in Step 06.", rows.length, i => [rows[i].source, rows[i].recognizedBody, rows[i].version ?? null]); break; }
    case "regions": { const regions = c.economy?.siteEconomyInput?.regions ?? [];
      fill(["Region", "Name", "Farm share", "Dairy share", "Farm sales ($/ha/year)", "Farmland ($/ha)", "Non-farm ($/person)"], "Regional economy records as imported from Step 07.", regions.length, i => { const r = regions[i]; return [r.index, r.name, r.farmFraction, r.dairySalesFraction, r.annualFarmSalesPerHectare, r.farmlandValuePerHectare, r.nonFarmlandValuePerPerson]; }); break; }
    case "crops": { const crops = c.economy?.siteEconomyInput?.crops ?? [];
      fill(["Crop", "Start day", "End day", "Farmland share"], "Crop growing period and farmland share from Step 07.", crops.length, i => { const r = crops[i]; return [r.name, r.growingStartDay, r.growingEndDay, r.farmlandFraction]; }); break; }
    case "costs": { const costs = c.economy?.costParameterEstimates ?? [];
      fill(["Parameter", "Level", "Value", "Unit", "Currency year", "Source"], "Only analyst-supplied cost values are shown.", costs.length, i => { const r = costs[i]; return [r.costCode ?? r.parameter, r.level ?? null, r.value ?? null, r.costCode ? rcEconomicCostSpecs[r.costCode].unit : "", r.currencyYear ?? null, r.source]; }); break; }
    case "economySettings": { const e = c.economy, site = e?.siteEconomyInput;
      const rows: (string | number | null)[][] = e ? [["Source file", site?.filename ?? null], ["Economic multiplier", site?.economicMultiplier ?? null],
        ["Regions expected", site?.expectedRegions ?? null], ["Regions supplied", site?.regions.length ?? null], ["Decontamination levels", e.decontaminationLevels ?? null],
        ["Parameter consistency confirmed", e.parameterConsistencyConfirmed ? "Yes" : "No"], ["Parameter uncertainty", e.parameterUncertaintyCharacterization ?? null]] : [];
      fill(["Setting", "Saved value"], "Site economy and cost-model settings from Step 07.", rows.length, i => rows[i]); break; }
  }
  return out;
}
