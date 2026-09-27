import type { MechanisticSourceTermAnalysis, SourceInventory, SourceTermDefinition } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import type { RcBoundingMember } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcSourceTermValues } from "interfaces-mef-types/rc/source-term";
import { RcSourceTermValuesSchema } from "interfaces-mef-types/zod/rc/source-term";

export interface RcMsSourceTermConversion {
  values?: RcSourceTermValues;
  issues: string[];
}

const timeSeconds = new Map<string, number>([
  ["s", 1], ["sec", 1], ["second", 1], ["seconds", 1],
  ["min", 60], ["minute", 60], ["minutes", 60],
  ["h", 3600], ["hr", 3600], ["hour", 3600], ["hours", 3600],
  ["d", 86400], ["day", 86400], ["days", 86400],
]);

const activityBq = new Map<string, number>([
  ["Bq", 1], ["kBq", 1e3], ["MBq", 1e6], ["GBq", 1e9], ["TBq", 1e12], ["PBq", 1e15], ["EBq", 1e18],
  ["mCi", 3.7e7], ["Ci", 3.7e10], ["kCi", 3.7e13], ["MCi", 3.7e16],
]);

const unitToken = (unit: string | undefined): string => (unit ?? "").trim().split(" ")[0].split(",")[0];
const unitWord = (unit: string | undefined): string => unitToken(unit).toLowerCase();
const activityFactor = (unit: string): number | undefined => activityBq.get(unitToken(unit));
const isFraction = (unit: string, flagged: boolean | undefined): boolean => flagged === true || unitWord(unit) === "fraction";
const isMetres = (unit: string): boolean => ["m", "metre", "metres", "meter", "meters"].includes(unitWord(unit));

export function rcMsSourceTermFor(ms: Pick<MechanisticSourceTermAnalysis, "sourceTermDefinitions">, categoryId: string): SourceTermDefinition | undefined {
  return ms.sourceTermDefinitions.find((definition) => definition.releaseCategoryReference === categoryId);
}

export function rcMsInventoryIds(ms: Pick<MechanisticSourceTermAnalysis, "sourceInventories" | "transportBarrierAssessments">, categoryId: string): string[] {
  const cited = new Set(ms.transportBarrierAssessments.filter((barrier) => barrier.releaseCategoryReference === categoryId).flatMap((barrier) => barrier.sourceInventoryRefs));
  const ids = ms.sourceInventories.filter((inventory) => cited.has(inventory.uuid)).map((inventory) => inventory.uuid);
  return ids.length ? ids : ms.sourceInventories.slice(0, 1).map((inventory) => inventory.uuid);
}

export function rcMsBoundingMember(ms: Pick<MechanisticSourceTermAnalysis, "releaseCategories">, categoryId: string): RcBoundingMember | undefined {
  const category = ms.releaseCategories.find((entry) => entry.uuid === categoryId);
  if (!category?.boundingSequenceReference.trim()) return undefined;
  return { sequenceId: category.boundingSequenceReference.trim(), basis: category.boundingSequenceJustification?.trim() ?? "" };
}

export function rcSourceTermFromMs(definition: SourceTermDefinition, inventories: readonly SourceInventory[]): RcMsSourceTermConversion {
  const issues: string[] = [];
  const phases = [...definition.releasePhases].sort((a, b) => a.startTime - b.startTime);
  const phaseIds = new Set(phases.map((phase) => phase.uuid));
  const names: string[] = [];
  for (const release of definition.radionuclideReleases) {
    if (!phaseIds.has(release.phaseId)) issues.push(`Release quantities refer to an unknown phase: ${release.phaseId}.`);
    for (const quantity of release.quantities) if (!names.includes(quantity.radionuclide)) names.push(quantity.radionuclide);
  }
  const activities = new Map<string, number>();
  for (const name of names) {
    const rows = inventories.flatMap((inventory) => inventory.inventory.filter((row) => row.radionuclide === name));
    if (!rows.length) { issues.push(`${name} is released but is not in the selected inventories.`); continue; }
    let total = 0, known = true;
    for (const row of rows) {
      const factor = activityFactor(row.unit);
      if (factor === undefined) { issues.push(`${name}: inventory unit ${row.unit} is not an activity unit.`); known = false; break; }
      total += row.quantity * factor;
    }
    if (known) activities.set(name, total);
  }
  const kept = names.filter((name) => activities.has(name));
  if (!kept.length) return { issues: issues.length ? issues : ["The source term releases no radionuclide."] };
  const height = definition.releaseElevation;
  if (height && !isMetres(height.unit)) issues.push(`Release elevation unit ${height.unit} is not metres. Enter the height in Step 01.`);
  const heightMetres = height && isMetres(height.unit) ? height.quantity : undefined;
  const releases = phases.map((phase, index) => {
    const factor = timeSeconds.get(unitWord(phase.timeUnit ?? "h"));
    if (factor === undefined) issues.push(`${phase.name || phase.uuid}: time unit ${phase.timeUnit ?? ""} is not supported.`);
    const duration = factor === undefined ? undefined : (phase.endTime - phase.startTime) * factor;
    if (duration !== undefined && duration <= 0) issues.push(`${phase.name || phase.uuid}: the phase must end after it starts.`);
    const quantities = definition.radionuclideReleases.filter((release) => release.phaseId === phase.uuid).flatMap((release) => release.quantities);
    const fractions = kept.map((name) => quantities.filter((quantity) => quantity.radionuclide === name).reduce((sum, quantity) => {
      if (isFraction(quantity.unit, quantity.expressedAsReleaseFraction)) return sum + quantity.quantity;
      const factorBq = activityFactor(quantity.unit), available = activities.get(name) ?? 0;
      if (factorBq === undefined || available <= 0) { issues.push(`${name}: release unit ${quantity.unit} cannot be converted to a fraction.`); return sum; }
      return sum + quantity.quantity * factorBq / available;
    }, 0));
    return {
      id: index + 1,
      ...(factor === undefined ? {} : { startSeconds: phase.startTime * factor }),
      ...(duration === undefined || duration <= 0 ? {} : { durationSeconds: duration }),
      ...(heightMetres === undefined ? {} : { heightMetres }),
      fractions,
    };
  });
  const values: RcSourceTermValues = {
    groups: kept.map((name, index) => ({ id: index + 1, name })),
    inventory: kept.map((name, index) => ({ name, activityBq: activities.get(name) ?? 0, group: index + 1 })),
    releases,
  };
  const parsed = RcSourceTermValuesSchema.safeParse(values);
  if (!parsed.success) return { issues: [...issues, ...new Set(parsed.error.issues.map((issue) => issue.message))] };
  return { values: parsed.data, issues };
}
