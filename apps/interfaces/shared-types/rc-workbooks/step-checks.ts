import type { RadiologicalConsequenceAnalysis, RcSubElement } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcCaseStep } from "interfaces-mef-types/rc/case-records";
import { caseChecks, caseVersions, currentRcCase } from "./case-records";
import { rcConsequenceMatchesFamily, rcLatestCategoryResult } from "./family-consequences";
import { rcFamilyReferenceMatches } from "./linked-data";
import { rcMetricIssues, rcMetricMatchesMeasure } from "./metrics";
import { depositionFlagNotes } from "./transport";

export interface RcLinkedFamily {
  uuid: string;
  name: string;
  releaseCategoryIds: string[];
  memberSequenceIds: string[];
}

export interface RcStepLinks {
  es?: { workbookId: string; families: RcLinkedFamily[]; categoryIds?: string[] };
  riMeasures?: string[];
  typedSources?: string[];
  unavailable?: string[];
}

const label = (id: string, name?: string) => name?.trim() ? `${id} (${name.trim()})` : id;

export { rcFamilyReferenceMatches };

export function rcScopeChecks(rc: RadiologicalConsequenceAnalysis, links: RcStepLinks = {}): string[] {
  const items: string[] = [];
  const categories = rc.releaseCategoryToConsequence.releaseCategoryInputs;
  const metrics = rc.scope.metrics ?? [];
  if (!rc.linkedWorkbooks?.ES) items.push("Link the Event Sequence Analysis workbook that defines the release categories.");
  for (const code of links.unavailable ?? []) items.push(`The linked ${code} workbook is unavailable. Fix the link in Step 01.`);
  if (!categories.length) items.push(rc.linkedWorkbooks?.ES ? "The linked ES workbook lists no release category." : "Add a release category.");
  const es = links.es;
  if (es) {
    const overrides = rc.releaseCategoryToConsequence.familyMapOverrides ?? [];
    for (const family of es.families) {
      const holders = categories.filter((category) => (category.eventSequenceFamilyReferences ?? []).some((reference) => rcFamilyReferenceMatches(reference, es.workbookId, family.uuid)));
      const typed = overrides.find((entry) => entry.familyId === family.uuid);
      if (holders.length > 1) items.push(`${label(family.uuid, family.name)} is in more than one release category.`);
      if (typed !== undefined && !typed.reason?.trim()) items.push(`${label(family.uuid, family.name)}: give the reason for the release category typed over the ES assignment.`);
      if (typed === undefined && !holders.length && family.releaseCategoryIds.length) items.push(`${label(family.uuid, family.name)} releases into ${family.releaseCategoryIds.join(", ")} in the ES workbook but is in no release category here.`);
    }
    for (const lost of overrides.filter((entry) => !es.families.some((family) => family.uuid === entry.familyId)))
      items.push(`${lost.familyId}: linked row not found. The typed release category is kept until the family returns or it is removed in Step 01.`);
    const listed = es.categoryIds;
    if (listed !== undefined) {
      for (const category of categories.filter((entry) => !listed.includes(entry.releaseCategory)))
        items.push(`${category.releaseCategory}: linked row not found. The ES workbook does not list this release category.`);
    }
    for (const category of categories) {
      const mapped = es.families.filter((family) => (category.eventSequenceFamilyReferences ?? []).some((reference) => rcFamilyReferenceMatches(reference, es.workbookId, family.uuid)));
      if (!mapped.length) items.push(`${category.releaseCategory}: assign at least one event sequence family.`);
      const members = new Set(mapped.flatMap((family) => family.memberSequenceIds));
      const bounding = category.boundingMember?.sequenceId.trim();
      if (bounding && members.size && !members.has(bounding)) items.push(`${category.releaseCategory}: ${bounding} is not a member of the category's families.`);
    }
  }
  for (const category of categories) {
    const bounding = category.boundingMember;
    if (!bounding?.sequenceId.trim()) items.push(`${category.releaseCategory}: record the bounding member and its screening basis.`);
    else if (!bounding.basis.trim()) items.push(`${category.releaseCategory}: state why ${bounding.sequenceId.trim()} bounds the category.`);
    const source = caseChecks(currentRcCase(rc, category.releaseCategory)).find((check) => check.key === "source");
    for (const item of source?.items ?? []) items.push(`${category.releaseCategory}: ${item}`);
    if ((links.typedSources ?? []).includes(category.releaseCategory) && !category.sourceTermOverrideReason?.trim())
      items.push(`${category.releaseCategory}: give the reason for the source term typed over the MS source term.`);
  }
  if (!metrics.length) items.push("Define at least one consequence metric.");
  for (const metric of metrics) for (const issue of rcMetricIssues(metric)) items.push(`${metric.id}: ${issue}`);
  for (const measure of links.riMeasures ?? []) {
    if (!metrics.some((metric) => rcMetricMatchesMeasure(metric.name, measure))) items.push(`No metric supplies the RI measure "${measure}".`);
  }
  return items;
}

export function rcQuantificationChecks(rc: RadiologicalConsequenceAnalysis): string[] {
  const items: string[] = [];
  const q = rc.consequenceQuantification, records = q.caseRecords;
  const categories = rc.releaseCategoryToConsequence.releaseCategoryInputs, metrics = rc.scope.metrics ?? [];
  for (const category of categories) {
    const id = category.releaseCategory;
    if (!records?.snapshots.some((snapshot) => snapshot.categoryId === id)) items.push(`${id}: save an input snapshot.`);
    const versions = caseVersions(currentRcCase(rc, id));
    for (const metric of metrics) {
      const result = rcLatestCategoryResult(records, id, metric.id);
      const name = metric.name.trim() || metric.id;
      if (!result) { items.push(`${id}: record the ${name} result.`); continue; }
      const snapshot = records?.snapshots.find((entry) => entry.id === result.snapshotId);
      if (snapshot?.versions !== undefined && snapshot.versions !== versions) items.push(`${id}: the ${name} result uses ${snapshot.label}, and the inputs changed after it.`);
      const missing = [
        ...(metric.statistics.mean && result.statistics.mean === undefined ? ["the mean"] : []),
        ...metric.statistics.percentiles.filter((percentile) => !result.statistics.percentiles.some((row) => row.percentile === percentile)).map((percentile) => `the ${percentile}th percentile`),
        ...metric.statistics.exceedanceThresholds.filter((threshold) => !result.statistics.exceedances.some((row) => row.threshold === threshold)).map((threshold) => `the chance of exceeding ${threshold}`),
      ];
      if (missing.length) items.push(`${id}: the ${name} result lacks ${missing.join(", ")}.`);
    }
    for (const result of records?.results.filter((entry) => entry.categoryId === id && !metrics.some((metric) => metric.id === entry.metricId)) ?? [])
      items.push(`${id}: a result refers to the removed metric ${result.metricId}.`);
  }
  for (const entry of q.eventSequenceConsequences.filter((consequence) => consequence.origin !== "CATEGORY_RESULT")) {
    if (!entry.overrideReason?.trim()) items.push(`${entry.eventSequenceFamily}: give the reason for the hand-typed values.`);
    if (!categories.some((category) => (category.eventSequenceFamilyReferences ?? []).some((reference) => rcConsequenceMatchesFamily(entry, reference))))
      items.push(`${entry.eventSequenceFamily}: the hand-typed values belong to no release category.`);
  }
  if (!q.outputReview.performed) items.push("Review the output files for errors and unexpected zeros.");
  if (!q.resultsConfirmation.performed || !q.resultsConfirmation.description?.trim()) items.push("Confirm the results against the output and record the basis.");
  return items;
}

const caseSubElements: Record<RcCaseStep, RcSubElement> = { source: "RCRE", site: "RCPA", weather: "RCME", transport: "RCAD", dose: "RCDO", health: "RCHE", economy: "RCEC" };

export function rcSubElementChecks(rc: RadiologicalConsequenceAnalysis, links: RcStepLinks = {}): Record<RcSubElement, string[]> {
  const checks: Record<RcSubElement, string[]> = { RCRE: rcScopeChecks(rc, links), RCPA: [], RCME: [], RCAD: [], RCDO: [], RCHE: [], RCEC: [], RCQ: rcQuantificationChecks(rc) };
  const categories = rc.releaseCategoryToConsequence.releaseCategoryInputs.map((category) => category.releaseCategory);
  const perCategory = new Set<RcCaseStep>(["transport", "dose"]);
  (categories.length ? categories : [""]).forEach((categoryId, index) => {
    for (const check of caseChecks(currentRcCase(rc, categoryId))) {
      if (check.key === "links" || check.key === "source") continue;
      if (!perCategory.has(check.key) && index > 0) continue;
      const target = checks[caseSubElements[check.key]];
      for (const item of check.items) {
        const text = perCategory.has(check.key) && categoryId ? `${categoryId}: ${item}` : item;
        if (!target.includes(text)) target.push(text);
      }
    }
  });
  const deposition = rc.atmosphericTransportAndDispersion.deposition;
  for (const category of rc.atmosphericTransportAndDispersion.transportInputs?.categories ?? []) {
    if (!category.deposition) continue;
    for (const note of depositionFlagNotes({ wet: deposition.wetDeposition.included, dry: deposition.dryDeposition.included }, category.deposition.data)) if (note.blocking) checks.RCAD.push(`${category.categoryId}: ${note.text}`);
  }
  return checks;
}
