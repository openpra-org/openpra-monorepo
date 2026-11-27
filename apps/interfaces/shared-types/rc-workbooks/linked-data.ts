import type { EventSequenceAnalysis, EventSequenceFamily } from "interfaces-mef-types/es/event-sequence-analysis";
import type { MechanisticSourceTermAnalysis } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import type {
  RadiologicalConsequenceAnalysis,
  RcBoundingMember,
  RcFamilyMapOverride,
  RcLinkedSourceTerm,
  ReleaseCategoryInputs,
  ReleaseCharacteristics,
  RiskIntegrationFeedback,
} from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcSourceTerm, RcSourceTermValues } from "interfaces-mef-types/rc/source-term";
import type { RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import type { EventSequenceFamilyWorkbookReference } from "interfaces-mef-types/modeling/references";
import { withRcFamilyConsequences } from "./family-consequences";
import { rcMsBoundingMember, rcMsInventoryIds, rcMsSourceTermFor, rcSourceTermFromMs } from "./ms-source-term";
import { withSourceTermSummary } from "./source-term-summary";

export type RcLinkedEsAnalysis = Pick<EventSequenceAnalysis, "eventSequenceFamilies" | "releaseCategoryMappings">;
export type RcLinkedMsAnalysis = Pick<MechanisticSourceTermAnalysis, "sourceTermDefinitions" | "sourceInventories" | "transportBarrierAssessments" | "releaseCategories">;
export type RcLinkedRiAnalysis = Pick<RiskIntegration, "uuid" | "riskIntegrationFeedbackDispatch">;

export interface RcLinkedData {
  es?: { workbookId: string; analysis: RcLinkedEsAnalysis };
  ms?: { workbookId: string; analysis: RcLinkedMsAnalysis };
  ri?: { workbookId: string; analysis: RcLinkedRiAnalysis };
}

export interface RcSourceChoice {
  sourceTermId: string;
  inventoryIds: string[];
}

export interface RcSourceLink {
  choice: RcSourceChoice;
  values?: RcSourceTermValues;
  issues: string[];
}

export interface RcFamilyAssignment {
  familyId: string;
  linkedCategory?: string;
  category?: string;
  typed: boolean;
  reason?: string;
}

const NO_LINKED_DATA: RcLinkedData = {};

function sourceSignature(values: RcSourceTermValues): string {
  return JSON.stringify([
    values.groups.map((group) => [group.id, group.name]),
    values.inventory.map((row) => [row.name, row.activityBq, row.group]),
    values.releases.map((release) => [release.id, release.startSeconds ?? null, release.durationSeconds ?? null, release.heightMetres ?? null, release.fractions]),
  ]);
}

export function rcSourceFingerprint(values: RcSourceTermValues): number {
  const text = sourceSignature(values);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619) >>> 0;
  return hash === 0 ? 1 : hash;
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function sameChoice(left: RcSourceChoice | undefined, right: RcSourceChoice | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.sourceTermId === right.sourceTermId && sameIds(left.inventoryIds, right.inventoryIds);
}

function defaultChoice(ms: RcLinkedMsAnalysis, categoryId: string): RcSourceChoice | undefined {
  const definition = rcMsSourceTermFor(ms, categoryId);
  return definition === undefined ? undefined : { sourceTermId: definition.uuid, inventoryIds: rcMsInventoryIds(ms, categoryId) };
}

function savedChoice(category: ReleaseCategoryInputs): RcSourceChoice | undefined {
  const held = category.linkedSourceTerm ?? category.sourceTerm?.msSource;
  return held === undefined ? undefined : { sourceTermId: held.sourceTermId, inventoryIds: held.inventoryIds };
}

export function rcSourceLink(category: ReleaseCategoryInputs, ms: RcLinkedMsAnalysis): RcSourceLink | undefined {
  const choice = savedChoice(category) ?? defaultChoice(ms, category.releaseCategory);
  if (choice === undefined) return undefined;
  const definition = ms.sourceTermDefinitions.find((entry) => entry.uuid === choice.sourceTermId);
  if (definition === undefined) return { choice, issues: [`The linked MS workbook has no source term ${choice.sourceTermId}.`] };
  const conversion = rcSourceTermFromMs(definition, ms.sourceInventories.filter((inventory) => choice.inventoryIds.includes(inventory.uuid)));
  return { choice, ...(conversion.values === undefined ? {} : { values: conversion.values }), issues: conversion.issues };
}

export function rcSourceWithoutLink(source: RcSourceTerm): RcSourceTerm {
  if (source.msSource === undefined) return source;
  const { msSource: _link, ...rest } = source;
  return rest;
}

function linkedRevision(category: ReleaseCategoryInputs, values: RcSourceTermValues): number {
  const fingerprint = rcSourceFingerprint(values);
  const copy = category.sourceTerm;
  if (copy !== undefined) return copy.revision;
  const baseline = category.linkedSourceTerm;
  return baseline?.revision !== undefined && baseline.fingerprint === fingerprint ? baseline.revision : fingerprint;
}

function copyIsLinked(category: ReleaseCategoryInputs, link: RcSourceLink | undefined): boolean {
  const copy = category.sourceTerm;
  return copy?.msSource !== undefined && link?.values !== undefined && sourceSignature(copy.values) === sourceSignature(link.values);
}

function sourceView(category: ReleaseCategoryInputs, ms: RcLinkedData["ms"], linkedToMs: boolean): ReleaseCategoryInputs {
  if (ms === undefined) {
    const held = category.sourceTerm;
    return linkedToMs || held?.msSource === undefined ? category : { ...category, sourceTerm: rcSourceWithoutLink(held) };
  }
  const link = rcSourceLink(category, ms.analysis);
  const saved = category.sourceTerm;
  if (saved !== undefined && !copyIsLinked(category, link)) return withSourceTermSummary({ ...category, sourceTerm: rcSourceWithoutLink(saved) });
  if (link?.values === undefined) return category;
  const { sourceTermOverrideReason: _reason, ...rest } = category;
  return withSourceTermSummary({
    ...rest,
    sourceTerm: { revision: linkedRevision(category, link.values), values: link.values, msSource: { workbookId: ms.workbookId, sourceTermId: link.choice.sourceTermId, inventoryIds: link.choice.inventoryIds } },
    sourceTermDefinitionRef: link.choice.sourceTermId,
  });
}

function withoutSummary(characteristics: ReleaseCharacteristics): ReleaseCharacteristics {
  const { numberOfPlumes: _plumes, radionuclideGroupFractions: _fractions, releasePhaseTimings: _timings, releaseHeight: _height, releaseHeightDescription: _heightText, ...kept } = characteristics;
  return kept;
}

function sourceSaved(category: ReleaseCategoryInputs, ms: RcLinkedData["ms"]): ReleaseCategoryInputs {
  if (ms === undefined) return category;
  const source = category.sourceTerm;
  if (source === undefined) {
    const picked = category.linkedSourceTerm;
    if (picked === undefined || picked.revision !== undefined) return category;
    if (!sameChoice({ sourceTermId: picked.sourceTermId, inventoryIds: picked.inventoryIds }, defaultChoice(ms.analysis, category.releaseCategory))) return category;
    const { linkedSourceTerm: _default, ...rest } = category;
    return rest;
  }
  if (source.msSource === undefined) {
    if (rcSourceLink({ ...category, sourceTerm: undefined }, ms.analysis) !== undefined) return category;
    const { sourceTermOverrideReason: _reason, ...rest } = category;
    return rest;
  }
  const { sourceTerm: _source, sourceTermDefinitionRef: _reference, sourceTermOverrideReason: _reason, linkedSourceTerm: wanted, ...rest } = category;
  const shown: RcSourceChoice = { sourceTermId: source.msSource.sourceTermId, inventoryIds: source.msSource.inventoryIds };
  const choice: RcSourceChoice = wanted === undefined ? shown : { sourceTermId: wanted.sourceTermId, inventoryIds: wanted.inventoryIds };
  const fingerprint = rcSourceFingerprint(source.values);
  const keepsBaseline = sameChoice(choice, shown) && source.revision !== fingerprint;
  const chosen = !sameChoice(choice, defaultChoice(ms.analysis, category.releaseCategory));
  const held: RcLinkedSourceTerm | undefined = chosen || keepsBaseline
    ? { ...choice, ...(keepsBaseline ? { revision: source.revision, fingerprint } : {}) }
    : undefined;
  return { ...rest, ...(held === undefined ? {} : { linkedSourceTerm: held }), releaseCharacteristics: withoutSummary(category.releaseCharacteristics) };
}

function sameBounding(left: RcBoundingMember | undefined, right: RcBoundingMember | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.sequenceId.trim() === right.sequenceId.trim() && left.basis.trim() === right.basis.trim();
}

function boundingView(category: ReleaseCategoryInputs, ms: RcLinkedData["ms"]): ReleaseCategoryInputs {
  if (ms === undefined || (category.boundingMember?.sequenceId.trim() ?? "").length > 0) return category;
  const linked = rcMsBoundingMember(ms.analysis, category.releaseCategory);
  return linked === undefined ? category : { ...category, boundingMember: linked };
}

function boundingSaved(category: ReleaseCategoryInputs, ms: RcLinkedData["ms"]): ReleaseCategoryInputs {
  if (ms === undefined || category.boundingMember === undefined) return category;
  if (!sameBounding(category.boundingMember, rcMsBoundingMember(ms.analysis, category.releaseCategory))) return category;
  const { boundingMember: _linked, ...rest } = category;
  return rest;
}

function esCategoryIds(es: RcLinkedEsAnalysis): string[] {
  return [...new Set([
    ...(es.releaseCategoryMappings ?? []).map((mapping) => mapping.releaseCategoryId),
    ...es.eventSequenceFamilies.flatMap((family) => family.releaseCategoryIds ?? []),
  ])];
}

export function rcListedCategoryIds(es: RcLinkedEsAnalysis): string[] {
  return esCategoryIds(es);
}

export function rcFamilyReferenceMatches(reference: EventSequenceFamilyWorkbookReference, workbookId: string, familyId: string): boolean {
  return reference.entityId === familyId && (reference.workbookId === workbookId || reference.workbookId.startsWith("example-"));
}

function heldCategory(categories: readonly ReleaseCategoryInputs[], workbookId: string, familyId: string): string | undefined {
  return categories.find((category) => (category.eventSequenceFamilyReferences ?? []).some((reference) => rcFamilyReferenceMatches(reference, workbookId, familyId)))?.releaseCategory;
}

function withLiveFamilyReferences(rc: RadiologicalConsequenceAnalysis, es: RcLinkedData["es"]): RadiologicalConsequenceAnalysis {
  if (es === undefined) return rc;
  const known = new Set(es.analysis.eventSequenceFamilies.map((family) => family.uuid));
  const entries = rc.consequenceQuantification.eventSequenceConsequences;
  const moved = entries.map((entry) => {
    const reference = entry.eventSequenceFamilyReference;
    if (reference === undefined || reference.workbookId === es.workbookId || !known.has(reference.entityId)) return entry;
    if (!rcFamilyReferenceMatches(reference, es.workbookId, reference.entityId)) return entry;
    return { ...entry, eventSequenceFamilyReference: { ...reference, workbookId: es.workbookId } };
  });
  if (moved.every((entry, index) => entry === entries[index])) return rc;
  return { ...rc, consequenceQuantification: { ...rc.consequenceQuantification, eventSequenceConsequences: moved } };
}

function linkedCategoryOf(family: EventSequenceFamily, categoryIds: ReadonlySet<string>): string | undefined {
  return (family.releaseCategoryIds ?? []).find((id) => categoryIds.has(id));
}

export function rcFamilyAssignments(rc: RadiologicalConsequenceAnalysis, linked: RcLinkedData): RcFamilyAssignment[] {
  const es = linked.es;
  if (es === undefined) return [];
  const categories = rc.releaseCategoryToConsequence.releaseCategoryInputs;
  const categoryIds = new Set(categories.map((category) => category.releaseCategory));
  const reasons = rc.releaseCategoryToConsequence.familyMapOverrides ?? [];
  return es.analysis.eventSequenceFamilies.map((family) => {
    const linkedCategory = linkedCategoryOf(family, categoryIds);
    const category = heldCategory(categories, es.workbookId, family.uuid);
    const typed = category !== linkedCategory;
    const reason = reasons.find((entry) => entry.familyId === family.uuid)?.reason;
    return {
      familyId: family.uuid,
      ...(linkedCategory === undefined ? {} : { linkedCategory }),
      ...(category === undefined ? {} : { category }),
      typed,
      ...(typed && reason !== undefined ? { reason } : {}),
    };
  });
}

function characteristicsEmpty(characteristics: ReleaseCharacteristics): boolean {
  return Object.values(characteristics).every((value) => value === undefined || value === "" || (Array.isArray(value) && value.length === 0));
}

function categoryIsBlank(category: ReleaseCategoryInputs): boolean {
  return category.sourceTerm === undefined
    && category.linkedSourceTerm === undefined
    && category.sourceTermOverrideReason === undefined
    && (category.sourceTermDefinitionRef ?? "").trim().length === 0
    && category.boundingMember === undefined
    && (category.eventSequenceFamilyReferences ?? []).length === 0
    && characteristicsEmpty(category.releaseCharacteristics);
}

function categoriesView(saved: RadiologicalConsequenceAnalysis, linked: RcLinkedData): { categories: ReleaseCategoryInputs[]; overrides: RcFamilyMapOverride[] | undefined } {
  const held = saved.releaseCategoryToConsequence.releaseCategoryInputs;
  const savedOverrides = saved.releaseCategoryToConsequence.familyMapOverrides;
  const es = linked.es;
  const listed = es === undefined ? [] : esCategoryIds(es.analysis).filter((id) => !held.some((category) => category.releaseCategory === id));
  const all: ReleaseCategoryInputs[] = [...held, ...listed.map((releaseCategory): ReleaseCategoryInputs => ({ releaseCategory, releaseCharacteristics: {} }))];
  const linkedToMs = (saved.linkedWorkbooks?.MS ?? "").length > 0;
  if (es === undefined) return { categories: all.map((category) => boundingView(sourceView(category, linked.ms, linkedToMs), linked.ms)), overrides: savedOverrides };
  const categoryIds = new Set(all.map((category) => category.releaseCategory));
  const overrides = savedOverrides ?? [];
  const assigned = new Map<string, string | undefined>();
  const typed: RcFamilyMapOverride[] = [];
  for (const family of es.analysis.eventSequenceFamilies) {
    const linkedCategory = linkedCategoryOf(family, categoryIds);
    const override = overrides.find((entry) => entry.familyId === family.uuid);
    const copied = heldCategory(held, es.workbookId, family.uuid);
    const category = override !== undefined ? override.releaseCategory : copied ?? linkedCategory;
    const known = category !== undefined && categoryIds.has(category) ? category : undefined;
    assigned.set(family.uuid, known);
    if (known !== linkedCategory) typed.push({ familyId: family.uuid, ...(known === undefined ? {} : { releaseCategory: known }), ...(override?.reason === undefined ? {} : { reason: override.reason }) });
  }
  const lost = overrides.filter((entry) => !es.analysis.eventSequenceFamilies.some((family) => family.uuid === entry.familyId));
  const categories = all.map((category) => {
    const references = es.analysis.eventSequenceFamilies
      .filter((family) => assigned.get(family.uuid) === category.releaseCategory)
      .map((family): EventSequenceFamilyWorkbookReference => ({ referenceType: "EVENT_SEQUENCE_FAMILY", workbookId: es.workbookId, entityId: family.uuid }));
    const { eventSequenceFamilyReferences: _copied, ...rest } = category;
    return boundingView(sourceView(references.length === 0 ? rest : { ...rest, eventSequenceFamilyReferences: references }, linked.ms, linkedToMs), linked.ms);
  });
  const next = [...typed, ...lost];
  return { categories, overrides: next.length === 0 ? undefined : next };
}

function categoriesSaved(view: RadiologicalConsequenceAnalysis, linked: RcLinkedData): { categories: ReleaseCategoryInputs[]; overrides: RcFamilyMapOverride[] | undefined } {
  const shown = view.releaseCategoryToConsequence.releaseCategoryInputs;
  const reasons = view.releaseCategoryToConsequence.familyMapOverrides;
  const es = linked.es;
  const own = shown.map((category) => boundingSaved(sourceSaved(category, linked.ms), linked.ms));
  if (es === undefined) return { categories: own, overrides: reasons };
  const categoryIds = new Set(shown.map((category) => category.releaseCategory));
  const listed = new Set(esCategoryIds(es.analysis));
  const overrides: RcFamilyMapOverride[] = [];
  for (const family of es.analysis.eventSequenceFamilies) {
    const linkedCategory = linkedCategoryOf(family, categoryIds);
    const category = heldCategory(shown, es.workbookId, family.uuid);
    if (category === linkedCategory) continue;
    const reason = (reasons ?? []).find((entry) => entry.familyId === family.uuid)?.reason;
    overrides.push({ familyId: family.uuid, ...(category === undefined ? {} : { releaseCategory: category }), ...(reason === undefined || reason.trim().length === 0 ? {} : { reason }) });
  }
  const lost = (reasons ?? []).filter((entry) => !es.analysis.eventSequenceFamilies.some((family) => family.uuid === entry.familyId));
  const categories = own
    .map((category) => {
      const { eventSequenceFamilyReferences: _derived, ...rest } = category;
      return rest;
    })
    .filter((category) => !(listed.has(category.releaseCategory) && categoryIsBlank(category)));
  const next = [...overrides, ...lost];
  return { categories, overrides: next.length === 0 ? undefined : next };
}

function responseHasContent(response: RiskIntegrationFeedback["response"]): boolean {
  if (response === undefined) return false;
  return response.description.trim().length > 0 || (response.changes ?? []).length > 0 || response.status !== "IN_PROGRESS";
}

function feedbackView(saved: RiskIntegrationFeedback | undefined, ri: RcLinkedData["ri"]): RiskIntegrationFeedback | undefined {
  if (ri === undefined) return saved;
  const dispatch = ri.analysis.riskIntegrationFeedbackDispatch;
  const sent = dispatch?.radiologicalConsequenceFeedback;
  const rows = sent?.metricFeedback ?? [];
  const message = sent?.generalFeedback ?? "";
  const own = saved !== undefined && ((saved.releaseCategoryFeedback ?? []).length > 0 || saved.response !== undefined);
  if (rows.length === 0 && message.trim().length === 0 && !own) return undefined;
  return {
    analysisRef: ri.analysis.uuid,
    ...(saved?.integratedRiskResultReference === undefined ? {} : { integratedRiskResultReference: saved.integratedRiskResultReference }),
    ...(dispatch?.dispatchDate === undefined || dispatch.dispatchDate.length === 0 ? {} : { feedbackDate: dispatch.dispatchDate }),
    metricFeedback: rows.map((row) => ({
      metric: row.metric,
      ...(row.riskSignificance === undefined ? {} : { riskSignificance: row.riskSignificance }),
      ...(row.insights === undefined ? {} : { insights: row.insights }),
      ...(row.recommendations === undefined ? {} : { recommendations: row.recommendations }),
    })),
    ...(saved?.releaseCategoryFeedback === undefined ? {} : { releaseCategoryFeedback: saved.releaseCategoryFeedback }),
    ...(message.length === 0 ? {} : { generalFeedback: message }),
    ...(saved?.response === undefined ? {} : { response: saved.response }),
  };
}

function feedbackSaved(view: RiskIntegrationFeedback | undefined, ri: RcLinkedData["ri"]): RiskIntegrationFeedback | undefined {
  if (ri === undefined || view === undefined) return view;
  const categories = view.releaseCategoryFeedback ?? [];
  const responded = responseHasContent(view.response);
  if (categories.length === 0 && !responded) return undefined;
  return {
    analysisRef: ri.analysis.uuid,
    ...(view.integratedRiskResultReference === undefined ? {} : { integratedRiskResultReference: view.integratedRiskResultReference }),
    ...(categories.length === 0 ? {} : { releaseCategoryFeedback: categories }),
    ...(responded && view.response !== undefined ? { response: view.response } : {}),
  };
}

function withUnlinkedSourcesTyped(rc: RadiologicalConsequenceAnalysis): RadiologicalConsequenceAnalysis {
  if ((rc.linkedWorkbooks?.MS ?? "").length > 0) return rc;
  const categories = rc.releaseCategoryToConsequence.releaseCategoryInputs;
  if (categories.every((category) => category.sourceTerm?.msSource === undefined)) return rc;
  return {
    ...rc,
    releaseCategoryToConsequence: { ...rc.releaseCategoryToConsequence, releaseCategoryInputs: categories.map((category) => sourceView(category, undefined, false)) },
  };
}

export function rcWithLinkedData(saved: RadiologicalConsequenceAnalysis, linked: RcLinkedData = NO_LINKED_DATA): RadiologicalConsequenceAnalysis {
  if (linked.es === undefined && linked.ms === undefined && linked.ri === undefined) return withUnlinkedSourcesTyped(saved);
  const { categories, overrides } = categoriesView(saved, linked);
  const feedback = feedbackView(saved.riskIntegrationFeedback, linked.ri);
  const { familyMapOverrides: _overrides, ...mapping } = saved.releaseCategoryToConsequence;
  const { riskIntegrationFeedback: _feedback, ...rest } = saved;
  const view = withLiveFamilyReferences({
    ...rest,
    releaseCategoryToConsequence: { ...mapping, releaseCategoryInputs: categories, ...(overrides === undefined ? {} : { familyMapOverrides: overrides }) },
    ...(feedback === undefined ? {} : { riskIntegrationFeedback: feedback }),
  }, linked.es);
  return rcDerivesFamilyConsequences(view, linked) ? withRcFamilyConsequences(view) : view;
}

export function rcWithoutLinkedData(view: RadiologicalConsequenceAnalysis, linked: RcLinkedData = NO_LINKED_DATA): RadiologicalConsequenceAnalysis {
  if (linked.es === undefined && linked.ms === undefined && linked.ri === undefined) return view;
  const { categories, overrides } = categoriesSaved(view, linked);
  const feedback = feedbackSaved(view.riskIntegrationFeedback, linked.ri);
  const { familyMapOverrides: _overrides, ...mapping } = view.releaseCategoryToConsequence;
  const { riskIntegrationFeedback: _feedback, ...rest } = view;
  return {
    ...rest,
    releaseCategoryToConsequence: { ...mapping, releaseCategoryInputs: categories, ...(overrides === undefined ? {} : { familyMapOverrides: overrides }) },
    ...(feedback === undefined ? {} : { riskIntegrationFeedback: feedback }),
  };
}

export function rcLinkedDataFor(rc: RadiologicalConsequenceAnalysis, linked: RcLinkedData): RcLinkedData {
  const ids = rc.linkedWorkbooks;
  const es = linked.es !== undefined && linked.es.workbookId === ids?.ES ? linked.es : undefined;
  const ms = linked.ms !== undefined && linked.ms.workbookId === ids?.MS ? linked.ms : undefined;
  const ri = linked.ri !== undefined && linked.ri.workbookId === ids?.RI ? linked.ri : undefined;
  if (es === linked.es && ms === linked.ms && ri === linked.ri) return linked;
  return { ...(es === undefined ? {} : { es }), ...(ms === undefined ? {} : { ms }), ...(ri === undefined ? {} : { ri }) };
}

export function rcShowsSavedCopies(rc: RadiologicalConsequenceAnalysis): boolean {
  const state = rc.workflowState ?? "DRAFT";
  if (state === "DRAFT" || state === "REVISION_REQUIRED") return false;
  const feedback = rc.riskIntegrationFeedback;
  return rc.releaseCategoryToConsequence.releaseCategoryInputs.some((category) => category.sourceTerm?.msSource !== undefined || (category.eventSequenceFamilyReferences ?? []).length > 0)
    || (feedback?.metricFeedback ?? []).length > 0
    || (feedback?.generalFeedback ?? "").length > 0;
}

export function rcSavedForm(view: RadiologicalConsequenceAnalysis, linked: RcLinkedData = NO_LINKED_DATA): RadiologicalConsequenceAnalysis {
  const derived = rcDerivesFamilyConsequences(view, linked) ? withRcFamilyConsequences(view) : view;
  const stored = rcWithoutLinkedData(derived, linked);
  return rcDerivesFamilyConsequences(stored, NO_LINKED_DATA) ? withRcFamilyConsequences(stored) : stored;
}

export function rcWithCategory(rc: RadiologicalConsequenceAnalysis, categoryId: string): RadiologicalConsequenceAnalysis {
  const categories = rc.releaseCategoryToConsequence.releaseCategoryInputs;
  if (categoryId.trim().length === 0 || categories.some((category) => category.releaseCategory === categoryId)) return rc;
  return { ...rc, releaseCategoryToConsequence: { ...rc.releaseCategoryToConsequence, releaseCategoryInputs: [...categories, { releaseCategory: categoryId, releaseCharacteristics: {} }] } };
}

export function rcDerivesFamilyConsequences(rc: RadiologicalConsequenceAnalysis, linked: RcLinkedData): boolean {
  const linkedId = rc.linkedWorkbooks?.ES;
  return linkedId === undefined || linkedId.length === 0 || linked.es !== undefined;
}

export function rcSourceIsLinked(category: ReleaseCategoryInputs): boolean {
  return category.sourceTerm?.msSource !== undefined;
}

export function rcSourceStandsIn(category: ReleaseCategoryInputs, linked: RcLinkedData): boolean {
  const ms = linked.ms;
  if (ms === undefined || category.sourceTerm === undefined || category.sourceTerm.msSource !== undefined) return false;
  return rcSourceLink({ ...category, sourceTerm: undefined }, ms.analysis) !== undefined;
}

export function rcCategoryIsListed(categoryId: string, linked: RcLinkedData): boolean {
  return linked.es !== undefined && esCategoryIds(linked.es.analysis).includes(categoryId);
}

export function rcLostFamilyOverrides(rc: RadiologicalConsequenceAnalysis, linked: RcLinkedData): RcFamilyMapOverride[] {
  const es = linked.es;
  if (es === undefined) return [];
  return (rc.releaseCategoryToConsequence.familyMapOverrides ?? []).filter((entry) => !es.analysis.eventSequenceFamilies.some((family) => family.uuid === entry.familyId));
}

export function rcTypedSourceCategories(rc: RadiologicalConsequenceAnalysis, ms: RcLinkedMsAnalysis): string[] {
  return rc.releaseCategoryToConsequence.releaseCategoryInputs
    .filter((category) => category.sourceTerm !== undefined && category.sourceTerm.msSource === undefined && rcSourceLink({ ...category, sourceTerm: undefined, linkedSourceTerm: undefined }, ms) !== undefined)
    .map((category) => category.releaseCategory);
}

function withCategories(rc: RadiologicalConsequenceAnalysis, releaseCategoryInputs: ReleaseCategoryInputs[]): RadiologicalConsequenceAnalysis {
  return { ...rc, releaseCategoryToConsequence: { ...rc.releaseCategoryToConsequence, releaseCategoryInputs } };
}

function withoutOwnSource(category: ReleaseCategoryInputs): ReleaseCategoryInputs {
  const { sourceTerm: _typed, sourceTermOverrideReason: _reason, sourceTermDefinitionRef: _reference, ...rest } = category;
  return { ...rest, releaseCharacteristics: withoutSummary(category.releaseCharacteristics) };
}

export function rcWithTypedSourcesReplaced(rc: RadiologicalConsequenceAnalysis, ms: RcLinkedMsAnalysis): RadiologicalConsequenceAnalysis {
  const replaced = new Set(rcTypedSourceCategories(rc, ms));
  if (replaced.size === 0) return rc;
  return withCategories(rc, rc.releaseCategoryToConsequence.releaseCategoryInputs.map((category) => (replaced.has(category.releaseCategory) ? withoutOwnSource(category) : category)));
}

export function rcWithSourceLinked(rc: RadiologicalConsequenceAnalysis, categoryId: string): RadiologicalConsequenceAnalysis {
  return withCategories(rc, rc.releaseCategoryToConsequence.releaseCategoryInputs.map((category) => (category.releaseCategory === categoryId ? withoutOwnSource(category) : category)));
}

export function rcWithSourceChoice(rc: RadiologicalConsequenceAnalysis, categoryId: string, choice: RcSourceChoice): RadiologicalConsequenceAnalysis {
  return withCategories(rc, rc.releaseCategoryToConsequence.releaseCategoryInputs.map((category) => (
    category.releaseCategory === categoryId ? { ...category, linkedSourceTerm: { sourceTermId: choice.sourceTermId, inventoryIds: choice.inventoryIds } } : category
  )));
}

export function rcWithSourceReason(rc: RadiologicalConsequenceAnalysis, categoryId: string, reason: string): RadiologicalConsequenceAnalysis {
  return withCategories(rc, rc.releaseCategoryToConsequence.releaseCategoryInputs.map((category) => {
    if (category.releaseCategory !== categoryId) return category;
    const { sourceTermOverrideReason: _previous, ...rest } = category;
    return reason.trim().length === 0 ? rest : { ...rest, sourceTermOverrideReason: reason };
  }));
}

export function rcSavedSourceRevision(saved: RadiologicalConsequenceAnalysis, categoryId: string): number {
  return saved.releaseCategoryToConsequence.releaseCategoryInputs.find((category) => category.releaseCategory === categoryId)?.sourceTerm?.revision ?? 0;
}

export function rcWithFamilyReason(rc: RadiologicalConsequenceAnalysis, familyId: string, reason: string): RadiologicalConsequenceAnalysis {
  const overrides = rc.releaseCategoryToConsequence.familyMapOverrides ?? [];
  const next = overrides.some((entry) => entry.familyId === familyId)
    ? overrides.map((entry) => (entry.familyId === familyId ? { ...entry, reason } : entry))
    : [...overrides, { familyId, reason }];
  return { ...rc, releaseCategoryToConsequence: { ...rc.releaseCategoryToConsequence, familyMapOverrides: next } };
}

export function rcWithFamilyOverrideRemoved(rc: RadiologicalConsequenceAnalysis, familyId: string): RadiologicalConsequenceAnalysis {
  const kept = (rc.releaseCategoryToConsequence.familyMapOverrides ?? []).filter((entry) => entry.familyId !== familyId);
  const { familyMapOverrides: _overrides, ...mapping } = rc.releaseCategoryToConsequence;
  return { ...rc, releaseCategoryToConsequence: { ...mapping, ...(kept.length === 0 ? {} : { familyMapOverrides: kept }) } };
}

export function rcCategoriesNotListed(rc: RadiologicalConsequenceAnalysis, es: RcLinkedEsAnalysis): string[] {
  const listed = new Set(esCategoryIds(es));
  return rc.releaseCategoryToConsequence.releaseCategoryInputs.map((category) => category.releaseCategory).filter((id) => !listed.has(id));
}

export function rcWithCategoriesReplaced(rc: RadiologicalConsequenceAnalysis, es: RcLinkedEsAnalysis): RadiologicalConsequenceAnalysis {
  const dropped = new Set(rcCategoriesNotListed(rc, es));
  if (dropped.size === 0) return rc;
  return withCategories(rc, rc.releaseCategoryToConsequence.releaseCategoryInputs.filter((category) => !dropped.has(category.releaseCategory)));
}

export function rcFeedbackIsTyped(rc: RadiologicalConsequenceAnalysis): boolean {
  const feedback = rc.riskIntegrationFeedback;
  return feedback !== undefined && ((feedback.metricFeedback ?? []).length > 0 || (feedback.generalFeedback ?? "").trim().length > 0);
}

export function rcWithTypedFeedbackReplaced(rc: RadiologicalConsequenceAnalysis): RadiologicalConsequenceAnalysis {
  const feedback = rc.riskIntegrationFeedback;
  if (feedback === undefined) return rc;
  const categories = feedback.releaseCategoryFeedback ?? [];
  const responded = responseHasContent(feedback.response);
  const { riskIntegrationFeedback: _typed, ...rest } = rc;
  if (categories.length === 0 && !responded) return rest;
  return {
    ...rest,
    riskIntegrationFeedback: {
      analysisRef: feedback.analysisRef,
      ...(categories.length === 0 ? {} : { releaseCategoryFeedback: categories }),
      ...(responded && feedback.response !== undefined ? { response: feedback.response } : {}),
    },
  };
}
