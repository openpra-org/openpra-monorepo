import type {
  ModelUncertaintySource,
  RiFrequencyStats,
  RiInputConsequence,
  RiInputContributor,
  RiInputFamily,
  RiInputImportance,
  RiInputs,
  RiInputSequence,
  RiLinkedConsequenceDetail,
  RiLinkedFamilyDetail,
  RiLinkedScreenedItemDetail,
  RiLinkedSequenceDetail,
  RiLinkedUncertaintyDetail,
  RiskIntegration,
  ScreenedItemLedgerEntry,
} from "interfaces-mef-types/ri/risk-integration";
import { type RiUpstream } from "./riWorkbookContext";
import { ELEMENT_CODE_BY_TYPE, type RiLinkCode } from "./riViewData";
import { loadLinkedEs, loadLinkedEsq, loadLinkedMs, loadLinkedPos, loadLinkedRc } from "./riWorkbookApi";
import {
  applicationContextOf,
  consequenceInputs,
  registerCandidates,
  riLinkedRows,
  sameConsequence,
  sameFrequency,
  sameItem,
  screeningCandidates,
  type RiLinkedRows,
  type RiRegisterCandidate,
  type RiScreenCandidate,
} from "./riSelectors";

interface RiTableView<Row, Detail> {
  rows: Row[];
  leftovers: Detail[];
}

interface RiTableSaved<Row, Detail> {
  rows: Row[];
  details: Detail[];
}

type RiMutation = (ri: RiskIntegration) => RiskIntegration;

const NO_UPSTREAM: RiUpstream = { options: { POS: [], ES: [], ESQ: [], MS: [], RC: [] } };

const LINKED_ROWS = new WeakMap<RiUpstream, RiLinkedRows>();

const REGISTER_SRS: ModelUncertaintySource["implementsSrs"] = [{ sr: "RI-C1", hlr: "C" }, { sr: "RI-C3", hlr: "C" }];

const LEDGER_SRS: ScreenedItemLedgerEntry["implementsSrs"] = [{ sr: "RI-C1", hlr: "C" }];

function linkedRowsOf(upstream: RiUpstream): RiLinkedRows {
  const cached = LINKED_ROWS.get(upstream);
  if (cached !== undefined) return cached;
  const rows = riLinkedRows(upstream.es, upstream.esq);
  LINKED_ROWS.set(upstream, rows);
  return rows;
}

function filled(text: string | undefined): text is string {
  return text !== undefined && text.trim().length > 0;
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function consequenceId(row: { releaseCategoryId: string; rcMetricId: string }): string {
  return `${row.releaseCategoryId}|${row.rcMetricId}`;
}

function frequencyTyped(row: { imported?: RiFrequencyStats; frequency?: RiFrequencyStats; overridesLink?: boolean }): boolean {
  return row.overridesLink === true || !sameFrequency(row.imported, row.frequency);
}

function consequenceTyped(row: RiInputConsequence): boolean {
  return row.overridesLink === true || (row.imported !== undefined && !sameConsequence(row.imported, row.statistics));
}

function familyDetailOf(row: RiInputFamily): RiLinkedFamilyDetail {
  const typed = frequencyTyped(row);
  return {
    familyId: row.id,
    ...(row.included ? {} : { included: false }),
    ...(row.included || !filled(row.exclusionReason) ? {} : { exclusionReason: row.exclusionReason }),
    ...(typed ? { overridesLink: true } : {}),
    ...(typed && row.frequency !== undefined ? { frequency: row.frequency } : {}),
    ...(typed && filled(row.changeReason) ? { changeReason: row.changeReason } : {}),
  };
}

function familyDetailHasContent(detail: RiLinkedFamilyDetail): boolean {
  return detail.included === false || detail.overridesLink === true;
}

function familyFromDetail(linked: RiInputFamily, detail: RiLinkedFamilyDetail | undefined): RiInputFamily {
  if (detail === undefined) return linked;
  const typed = detail.overridesLink === true;
  const { frequency: _linked, ...identity } = linked;
  return {
    ...(typed ? identity : linked),
    ...(typed ? { overridesLink: true } : {}),
    ...(typed && detail.frequency !== undefined ? { frequency: detail.frequency } : {}),
    ...(typed && detail.changeReason !== undefined ? { changeReason: detail.changeReason } : {}),
    ...(detail.included === false ? { included: false, exclusionReason: detail.exclusionReason ?? "" } : {}),
  };
}

function familiesView(saved: RiInputFamily[], details: RiLinkedFamilyDetail[], linked: RiInputFamily[] | undefined): RiTableView<RiInputFamily, RiLinkedFamilyDetail> {
  if (linked === undefined) return { rows: saved, leftovers: details };
  const ids = new Set(linked.map((row) => row.id));
  const detailOf = new Map(details.map((detail): [string, RiLinkedFamilyDetail] => [detail.familyId, detail]));
  const copies = saved.filter((row) => row.manual === undefined);
  const copyOf = new Map(copies.map((row): [string, RiInputFamily] => [row.id, row]));
  const rows = linked.map((row) => {
    const copy = copyOf.get(row.id);
    return familyFromDetail(row, detailOf.get(row.id) ?? (copy === undefined ? undefined : familyDetailOf(copy)));
  });
  const stranded = copies.filter((row) => !ids.has(row.id) && !detailOf.has(row.id)).map(familyDetailOf).filter(familyDetailHasContent);
  return {
    rows: [...rows, ...saved.filter((row) => row.manual !== undefined)],
    leftovers: [...details.filter((detail) => !ids.has(detail.familyId)), ...stranded],
  };
}

function familiesSaved(view: RiInputFamily[], leftovers: RiLinkedFamilyDetail[], linked: RiInputFamily[] | undefined): RiTableSaved<RiInputFamily, RiLinkedFamilyDetail> {
  if (linked === undefined) return { rows: view, details: leftovers };
  const ids = new Set(linked.map((row) => row.id));
  const rows: RiInputFamily[] = [];
  const details: RiLinkedFamilyDetail[] = [];
  const seen = new Set<string>();
  for (const row of view) {
    if (row.manual !== undefined) {
      rows.push(row);
      continue;
    }
    if (!ids.has(row.id) || seen.has(row.id)) continue;
    seen.add(row.id);
    const detail = familyDetailOf(row);
    if (familyDetailHasContent(detail)) details.push(detail);
  }
  for (const leftover of leftovers) {
    if (!ids.has(leftover.familyId) && !details.some((detail) => detail.familyId === leftover.familyId)) details.push(leftover);
  }
  return { rows, details };
}

function sequenceDetailOf(row: RiInputSequence): RiLinkedSequenceDetail | undefined {
  if (!frequencyTyped(row)) return undefined;
  return {
    sequenceId: row.id,
    ...(row.frequency === undefined ? {} : { frequency: row.frequency }),
    ...(filled(row.changeReason) ? { changeReason: row.changeReason } : {}),
  };
}

function sequenceFromDetail(linked: RiInputSequence, detail: RiLinkedSequenceDetail | undefined): RiInputSequence {
  if (detail === undefined) return linked;
  const { frequency: _linked, ...identity } = linked;
  return {
    ...identity,
    overridesLink: true,
    ...(detail.frequency === undefined ? {} : { frequency: detail.frequency }),
    ...(detail.changeReason === undefined ? {} : { changeReason: detail.changeReason }),
  };
}

function sequencesView(saved: RiInputSequence[], details: RiLinkedSequenceDetail[], linked: RiInputSequence[] | undefined): RiTableView<RiInputSequence, RiLinkedSequenceDetail> {
  if (linked === undefined) return { rows: saved, leftovers: details };
  const ids = new Set(linked.map((row) => row.id));
  const detailOf = new Map(details.map((detail): [string, RiLinkedSequenceDetail] => [detail.sequenceId, detail]));
  const copies = saved.filter((row) => row.manual === undefined);
  const copyOf = new Map(copies.map((row): [string, RiInputSequence] => [row.id, row]));
  const rows = linked.map((row) => {
    const copy = copyOf.get(row.id);
    return sequenceFromDetail(row, detailOf.get(row.id) ?? (copy === undefined ? undefined : sequenceDetailOf(copy)));
  });
  const stranded = copies.filter((row) => !ids.has(row.id) && !detailOf.has(row.id)).flatMap((row) => {
    const detail = sequenceDetailOf(row);
    return detail === undefined ? [] : [detail];
  });
  return {
    rows: [...rows, ...saved.filter((row) => row.manual !== undefined)],
    leftovers: [...details.filter((detail) => !ids.has(detail.sequenceId)), ...stranded],
  };
}

function sequencesSaved(view: RiInputSequence[], leftovers: RiLinkedSequenceDetail[], linked: RiInputSequence[] | undefined): RiTableSaved<RiInputSequence, RiLinkedSequenceDetail> {
  if (linked === undefined) return { rows: view, details: leftovers };
  const ids = new Set(linked.map((row) => row.id));
  const rows: RiInputSequence[] = [];
  const details: RiLinkedSequenceDetail[] = [];
  const seen = new Set<string>();
  for (const row of view) {
    if (row.manual !== undefined) {
      rows.push(row);
      continue;
    }
    if (!ids.has(row.id) || seen.has(row.id)) continue;
    seen.add(row.id);
    const detail = sequenceDetailOf(row);
    if (detail !== undefined) details.push(detail);
  }
  for (const leftover of leftovers) {
    if (!ids.has(leftover.sequenceId) && !details.some((detail) => detail.sequenceId === leftover.sequenceId)) details.push(leftover);
  }
  return { rows, details };
}

function consequenceDetailOf(row: RiInputConsequence): RiLinkedConsequenceDetail | undefined {
  if (!consequenceTyped(row)) return undefined;
  return {
    releaseCategoryId: row.releaseCategoryId,
    rcMetricId: row.rcMetricId,
    statistics: row.statistics,
    ...(filled(row.changeReason) ? { changeReason: row.changeReason } : {}),
  };
}

function consequenceFromDetail(linked: RiInputConsequence, detail: RiLinkedConsequenceDetail | undefined): RiInputConsequence {
  if (detail === undefined) return linked;
  return {
    ...linked,
    statistics: detail.statistics,
    overridesLink: true,
    ...(detail.changeReason === undefined ? {} : { changeReason: detail.changeReason }),
  };
}

function consequencesView(saved: RiInputConsequence[], details: RiLinkedConsequenceDetail[], linked: RiInputConsequence[] | undefined): RiTableView<RiInputConsequence, RiLinkedConsequenceDetail> {
  if (linked === undefined) return { rows: saved, leftovers: details };
  const ids = new Set(linked.map(consequenceId));
  const detailOf = new Map(details.map((detail): [string, RiLinkedConsequenceDetail] => [consequenceId(detail), detail]));
  const copies = saved.filter((row) => row.manual === undefined);
  const copyOf = new Map(copies.map((row): [string, RiInputConsequence] => [consequenceId(row), row]));
  const rows = linked.map((row) => {
    const key = consequenceId(row);
    const copy = copyOf.get(key);
    return consequenceFromDetail(row, detailOf.get(key) ?? (copy === undefined ? undefined : consequenceDetailOf(copy)));
  });
  const stranded = copies.filter((row) => !ids.has(consequenceId(row)) && !detailOf.has(consequenceId(row))).flatMap((row) => {
    const detail = consequenceDetailOf(row);
    return detail === undefined ? [] : [detail];
  });
  return {
    rows: [...rows, ...saved.filter((row) => row.manual !== undefined)],
    leftovers: [...details.filter((detail) => !ids.has(consequenceId(detail))), ...stranded],
  };
}

function consequencesSaved(view: RiInputConsequence[], leftovers: RiLinkedConsequenceDetail[], linked: RiInputConsequence[] | undefined): RiTableSaved<RiInputConsequence, RiLinkedConsequenceDetail> {
  if (linked === undefined) return { rows: view, details: leftovers };
  const ids = new Set(linked.map(consequenceId));
  const rows: RiInputConsequence[] = [];
  const details: RiLinkedConsequenceDetail[] = [];
  const seen = new Set<string>();
  for (const row of view) {
    if (row.manual !== undefined) {
      rows.push(row);
      continue;
    }
    const key = consequenceId(row);
    if (!ids.has(key) || seen.has(key)) continue;
    seen.add(key);
    const detail = consequenceDetailOf(row);
    if (detail !== undefined) details.push(detail);
  }
  for (const leftover of leftovers) {
    const key = consequenceId(leftover);
    if (!ids.has(key) && !details.some((detail) => consequenceId(detail) === key)) details.push(leftover);
  }
  return { rows, details };
}

function typedOnly<Row extends { manual?: { source: string } }>(rows: Row[] | undefined): Row[] {
  return (rows ?? []).filter((row) => row.manual !== undefined);
}

function inputsHoldCopies(inputs: RiInputs | undefined): boolean {
  if (inputs === undefined) return false;
  return inputs.families.some((row) => row.manual === undefined)
    || inputs.sequences.some((row) => row.manual === undefined)
    || inputs.consequences.some((row) => row.manual === undefined)
    || (inputs.contributors ?? []).some((row) => row.manual === undefined)
    || (inputs.importance ?? []).some((row) => row.manual === undefined);
}

function inputsHaveContent(inputs: RiInputs): boolean {
  return inputs.families.length > 0
    || inputs.sequences.length > 0
    || inputs.consequences.length > 0
    || (inputs.contributors ?? []).length > 0
    || (inputs.importance ?? []).length > 0
    || (inputs.unavailable ?? []).length > 0
    || (inputs.linkedFamilyDetails ?? []).length > 0
    || (inputs.linkedSequenceDetails ?? []).length > 0
    || (inputs.linkedConsequenceDetails ?? []).length > 0;
}

function inputsView(ri: RiskIntegration, upstream: RiUpstream): RiInputs | undefined {
  const saved = ri.inputs;
  const rc = upstream.rc;
  const fromEs = upstream.es !== undefined;
  const fromEsq = upstream.esq !== undefined;
  if (saved === undefined && !fromEs && !fromEsq && rc === undefined) return undefined;
  const linked = linkedRowsOf(upstream);
  const families = familiesView(saved?.families ?? [], saved?.linkedFamilyDetails ?? [], fromEs ? linked.families : undefined);
  const sequences = sequencesView(saved?.sequences ?? [], saved?.linkedSequenceDetails ?? [], fromEs ? linked.sequences : undefined);
  const consequences = consequencesView(saved?.consequences ?? [], saved?.linkedConsequenceDetails ?? [], rc === undefined ? undefined : consequenceInputs(ri, rc));
  const contributors: RiInputContributor[] | undefined = fromEsq ? [...linked.contributors, ...typedOnly(saved?.contributors)] : saved?.contributors;
  const importance: RiInputImportance[] | undefined = fromEsq ? [...linked.importance, ...typedOnly(saved?.importance)] : saved?.importance;
  return {
    ...(saved?.importedAt === undefined ? {} : { importedAt: saved.importedAt }),
    sources: saved?.sources ?? [],
    families: families.rows,
    sequences: sequences.rows,
    consequences: consequences.rows,
    ...(contributors === undefined ? {} : { contributors }),
    ...(importance === undefined ? {} : { importance }),
    ...(saved?.unavailable === undefined ? {} : { unavailable: saved.unavailable }),
    ...(families.leftovers.length === 0 ? {} : { linkedFamilyDetails: families.leftovers }),
    ...(sequences.leftovers.length === 0 ? {} : { linkedSequenceDetails: sequences.leftovers }),
    ...(consequences.leftovers.length === 0 ? {} : { linkedConsequenceDetails: consequences.leftovers }),
  };
}

function inputsSaved(view: RiskIntegration, upstream: RiUpstream): RiInputs | undefined {
  const inputs = view.inputs;
  if (inputs === undefined) return undefined;
  const rc = upstream.rc;
  const fromEs = upstream.es !== undefined;
  const fromEsq = upstream.esq !== undefined;
  if (!fromEs && !fromEsq && rc === undefined) return inputs;
  const linked = linkedRowsOf(upstream);
  const families = familiesSaved(inputs.families, inputs.linkedFamilyDetails ?? [], fromEs ? linked.families : undefined);
  const sequences = sequencesSaved(inputs.sequences, inputs.linkedSequenceDetails ?? [], fromEs ? linked.sequences : undefined);
  const consequences = consequencesSaved(inputs.consequences, inputs.linkedConsequenceDetails ?? [], rc === undefined ? undefined : consequenceInputs(view, rc));
  const contributors = fromEsq ? typedOnly(inputs.contributors) : inputs.contributors;
  const importance = fromEsq ? typedOnly(inputs.importance) : inputs.importance;
  const rows: RiInputs = {
    sources: [],
    families: families.rows,
    sequences: sequences.rows,
    consequences: consequences.rows,
    ...(contributors === undefined || (fromEsq && contributors.length === 0) ? {} : { contributors }),
    ...(importance === undefined || (fromEsq && importance.length === 0) ? {} : { importance }),
    ...(inputs.unavailable === undefined ? {} : { unavailable: inputs.unavailable }),
    ...(families.details.length === 0 ? {} : { linkedFamilyDetails: families.details }),
    ...(sequences.details.length === 0 ? {} : { linkedSequenceDetails: sequences.details }),
    ...(consequences.details.length === 0 ? {} : { linkedConsequenceDetails: consequences.details }),
  };
  if (!inputsHaveContent(rows)) return undefined;
  if (!inputsHoldCopies(rows)) return rows;
  return { ...rows, sources: inputs.sources, ...(inputs.importedAt === undefined ? {} : { importedAt: inputs.importedAt }) };
}

function uncertaintyMatches(row: { originatingElement: ModelUncertaintySource["originatingElement"]; name: string }, candidate: RiRegisterCandidate): boolean {
  return row.originatingElement === candidate.element && sameItem(row.name, candidate.name);
}

function linkedUncertaintyId(candidate: RiRegisterCandidate): string {
  return `${ELEMENT_CODE_BY_TYPE[candidate.element] ?? candidate.element}:${candidate.name.trim().toLowerCase()}`;
}

function uncertaintyDetailOf(row: ModelUncertaintySource): RiLinkedUncertaintyDetail {
  return {
    uuid: row.uuid,
    originatingElement: row.originatingElement,
    name: row.name,
    ...(row.impactScope === undefined || row.impactScope.length === 0 ? {} : { impactScope: row.impactScope }),
    ...(row.affectedMetrics.length === 0 ? {} : { affectedMetrics: row.affectedMetrics }),
    ...(filled(row.impactAssessment) ? { impactAssessment: row.impactAssessment } : {}),
    ...(filled(row.frequencyImpactRef) ? { frequencyImpactRef: row.frequencyImpactRef } : {}),
    ...(filled(row.consequenceImpactRef) ? { consequenceImpactRef: row.consequenceImpactRef } : {}),
    ...(filled(row.characterizationMethod) ? { characterizationMethod: row.characterizationMethod } : {}),
    ...(row.alternatives === undefined || row.alternatives.length === 0 ? {} : { alternatives: row.alternatives }),
    ...(row.recommendations === undefined || row.recommendations.length === 0 ? {} : { recommendations: row.recommendations }),
  };
}

function uncertaintyDetailHasContent(detail: RiLinkedUncertaintyDetail, candidate: RiRegisterCandidate): boolean {
  return Object.keys(detail).length > 3 || detail.uuid !== linkedUncertaintyId(candidate);
}

function linkedUncertainty(candidate: RiRegisterCandidate, own: RiLinkedUncertaintyDetail | undefined): ModelUncertaintySource {
  return {
    uuid: own?.uuid ?? linkedUncertaintyId(candidate),
    name: candidate.name,
    description: candidate.description,
    originatingElement: candidate.element,
    ...(own?.impactScope === undefined ? {} : { impactScope: own.impactScope }),
    affectedMetrics: own?.affectedMetrics ?? [],
    impactAssessment: own?.impactAssessment ?? "",
    ...(own?.frequencyImpactRef === undefined ? {} : { frequencyImpactRef: own.frequencyImpactRef }),
    ...(own?.consequenceImpactRef === undefined ? {} : { consequenceImpactRef: own.consequenceImpactRef }),
    ...(own?.characterizationMethod === undefined ? {} : { characterizationMethod: own.characterizationMethod }),
    ...(candidate.assumptions.length === 0 ? {} : { relatedAssumptions: candidate.assumptions }),
    ...(own?.alternatives === undefined ? {} : { alternatives: own.alternatives }),
    ...(own?.recommendations === undefined ? {} : { recommendations: own.recommendations }),
    implementsSrs: REGISTER_SRS,
  };
}

function uncertaintiesView(saved: RiskIntegration, candidates: RiRegisterCandidate[]): RiTableView<ModelUncertaintySource, RiLinkedUncertaintyDetail> {
  const rows = saved.modelUncertaintySources;
  const details = saved.linkedUncertaintyDetails ?? [];
  if (candidates.length === 0) return { rows, leftovers: details };
  const used = new Set<ModelUncertaintySource>();
  const attached = new Set<RiLinkedUncertaintyDetail>();
  const linked = candidates.map((candidate): ModelUncertaintySource => {
    const typed = rows.find((row) => row.overridesLink === true && uncertaintyMatches(row, candidate));
    if (typed !== undefined) {
      used.add(typed);
      return typed;
    }
    const detail = details.find((entry) => uncertaintyMatches(entry, candidate));
    if (detail !== undefined) {
      attached.add(detail);
      return linkedUncertainty(candidate, detail);
    }
    const copy = rows.find((row) => row.overridesLink !== true && uncertaintyMatches(row, candidate));
    if (copy === undefined) return linkedUncertainty(candidate, undefined);
    used.add(copy);
    const unchanged = copy.description === candidate.description && sameList(copy.relatedAssumptions ?? [], candidate.assumptions);
    return unchanged ? linkedUncertainty(candidate, uncertaintyDetailOf(copy)) : { ...copy, overridesLink: true };
  });
  return {
    rows: [...linked, ...rows.filter((row) => !used.has(row))],
    leftovers: details.filter((detail) => !attached.has(detail)),
  };
}

function uncertaintiesSaved(view: RiskIntegration, candidates: RiRegisterCandidate[]): RiTableSaved<ModelUncertaintySource, RiLinkedUncertaintyDetail> {
  const leftovers = view.linkedUncertaintyDetails ?? [];
  if (candidates.length === 0) return { rows: view.modelUncertaintySources, details: leftovers };
  const taken = new Set<RiRegisterCandidate>();
  const rows: ModelUncertaintySource[] = [];
  const details: RiLinkedUncertaintyDetail[] = [];
  for (const row of view.modelUncertaintySources) {
    const candidate = candidates.find((entry) => !taken.has(entry) && uncertaintyMatches(row, entry));
    if (candidate === undefined) {
      rows.push(row);
      continue;
    }
    taken.add(candidate);
    if (row.overridesLink === true) {
      rows.push(row);
      continue;
    }
    const detail = uncertaintyDetailOf(row);
    if (uncertaintyDetailHasContent(detail, candidate)) details.push(detail);
  }
  for (const leftover of leftovers) {
    if (!details.some((detail) => detail.originatingElement === leftover.originatingElement && sameItem(detail.name, leftover.name))) details.push(leftover);
  }
  return { rows, details };
}

function screenedItemMatches(row: { itemType: ScreenedItemLedgerEntry["itemType"]; itemRef: string }, candidate: RiScreenCandidate): boolean {
  return row.itemType === candidate.itemType && sameItem(row.itemRef, candidate.itemRef);
}

function linkedScreenedItem(candidate: RiScreenCandidate, own: RiLinkedScreenedItemDetail | undefined): ScreenedItemLedgerEntry {
  const effect = candidate.impact ?? own?.impactOnRiskMetrics;
  return {
    uuid: `${candidate.itemType}:${candidate.itemRef.trim().toLowerCase()}`,
    itemType: candidate.itemType,
    itemRef: candidate.itemRef,
    screeningElementCode: candidate.code,
    screeningBasis: candidate.basis,
    ...(filled(effect) ? { impactOnRiskMetrics: effect } : {}),
    implementsSrs: LEDGER_SRS,
  };
}

function screenedItemDetailOf(row: ScreenedItemLedgerEntry, candidate: RiScreenCandidate): RiLinkedScreenedItemDetail | undefined {
  const effect = row.impactOnRiskMetrics;
  if (candidate.impact !== undefined || !filled(effect)) return undefined;
  return { itemType: candidate.itemType, itemRef: candidate.itemRef, impactOnRiskMetrics: effect };
}

function screenedCopyUnchanged(copy: ScreenedItemLedgerEntry, candidate: RiScreenCandidate): boolean {
  return copy.screeningElementCode === candidate.code
    && copy.screeningBasis === candidate.basis
    && (candidate.impact === undefined || (copy.impactOnRiskMetrics ?? "").trim() === candidate.impact.trim());
}

function screenedItemsView(saved: RiskIntegration, candidates: RiScreenCandidate[]): RiTableView<ScreenedItemLedgerEntry, RiLinkedScreenedItemDetail> {
  const rows = saved.screenedItemsLedger ?? [];
  const details = saved.linkedScreenedItemDetails ?? [];
  if (candidates.length === 0) return { rows, leftovers: details };
  const used = new Set<ScreenedItemLedgerEntry>();
  const attached = new Set<RiLinkedScreenedItemDetail>();
  const linked = candidates.map((candidate): ScreenedItemLedgerEntry => {
    const typed = rows.find((row) => row.overridesLink === true && screenedItemMatches(row, candidate));
    if (typed !== undefined) {
      used.add(typed);
      return typed;
    }
    const detail = details.find((entry) => screenedItemMatches(entry, candidate));
    if (detail !== undefined) {
      attached.add(detail);
      return linkedScreenedItem(candidate, detail);
    }
    const copy = rows.find((row) => row.overridesLink !== true && screenedItemMatches(row, candidate));
    if (copy === undefined) return linkedScreenedItem(candidate, undefined);
    used.add(copy);
    return screenedCopyUnchanged(copy, candidate) ? linkedScreenedItem(candidate, screenedItemDetailOf(copy, candidate)) : { ...copy, overridesLink: true };
  });
  return {
    rows: [...linked, ...rows.filter((row) => !used.has(row))],
    leftovers: details.filter((detail) => !attached.has(detail)),
  };
}

function screenedItemsSaved(view: RiskIntegration, candidates: RiScreenCandidate[]): RiTableSaved<ScreenedItemLedgerEntry, RiLinkedScreenedItemDetail> {
  const leftovers = view.linkedScreenedItemDetails ?? [];
  const ledger = view.screenedItemsLedger ?? [];
  if (candidates.length === 0) return { rows: ledger, details: leftovers };
  const taken = new Set<RiScreenCandidate>();
  const rows: ScreenedItemLedgerEntry[] = [];
  const details: RiLinkedScreenedItemDetail[] = [];
  for (const row of ledger) {
    const candidate = candidates.find((entry) => !taken.has(entry) && screenedItemMatches(row, entry));
    if (candidate === undefined) {
      rows.push(row);
      continue;
    }
    taken.add(candidate);
    if (row.overridesLink === true) {
      rows.push(row);
      continue;
    }
    const detail = screenedItemDetailOf(row, candidate);
    if (detail !== undefined) details.push(detail);
  }
  for (const leftover of leftovers) {
    if (!details.some((detail) => detail.itemType === leftover.itemType && sameItem(detail.itemRef, leftover.itemRef))) details.push(leftover);
  }
  return { rows, details };
}

function riWithLinkedData(saved: RiskIntegration, upstream: RiUpstream = NO_UPSTREAM): RiskIntegration {
  const inputs = inputsView(saved, upstream);
  const register = uncertaintiesView(saved, registerCandidates(upstream));
  const ledger = screenedItemsView(saved, screeningCandidates(upstream));
  const { inputs: _inputs, modelUncertaintySources: _register, linkedUncertaintyDetails: _uncertainties, screenedItemsLedger, linkedScreenedItemDetails: _screened, ...rest } = saved;
  return {
    ...rest,
    ...(inputs === undefined ? {} : { inputs }),
    modelUncertaintySources: register.rows,
    ...(register.leftovers.length === 0 ? {} : { linkedUncertaintyDetails: register.leftovers }),
    ...(screenedItemsLedger === undefined && ledger.rows.length === 0 ? {} : { screenedItemsLedger: ledger.rows }),
    ...(ledger.leftovers.length === 0 ? {} : { linkedScreenedItemDetails: ledger.leftovers }),
  };
}

function riWithoutLinkedData(view: RiskIntegration, upstream: RiUpstream = NO_UPSTREAM): RiskIntegration {
  const inputs = inputsSaved(view, upstream);
  const register = uncertaintiesSaved(view, registerCandidates(upstream));
  const ledger = screenedItemsSaved(view, screeningCandidates(upstream));
  const { inputs: _inputs, modelUncertaintySources: _register, linkedUncertaintyDetails: _uncertainties, screenedItemsLedger, linkedScreenedItemDetails: _screened, ...rest } = view;
  return {
    ...rest,
    ...(inputs === undefined ? {} : { inputs }),
    modelUncertaintySources: register.rows,
    ...(register.details.length === 0 ? {} : { linkedUncertaintyDetails: register.details }),
    ...(screenedItemsLedger === undefined && ledger.rows.length === 0 ? {} : { screenedItemsLedger: ledger.rows }),
    ...(ledger.details.length === 0 ? {} : { linkedScreenedItemDetails: ledger.details }),
  };
}

function riShowsSavedCopies(ri: RiskIntegration): boolean {
  return ri.workflowState !== "DRAFT" && ri.workflowState !== "REVISION_REQUIRED" && inputsHoldCopies(ri.inputs);
}

function riUncertaintyLink(row: ModelUncertaintySource, upstream: RiUpstream): RiRegisterCandidate | undefined {
  return registerCandidates(upstream).find((candidate) => uncertaintyMatches(row, candidate));
}

function riScreenedItemLink(row: ScreenedItemLedgerEntry, upstream: RiUpstream): RiScreenCandidate | undefined {
  return screeningCandidates(upstream).find((candidate) => screenedItemMatches(row, candidate));
}

function withUncertaintyLinked(row: ModelUncertaintySource, candidate: RiRegisterCandidate): ModelUncertaintySource {
  const { overridesLink: _typed, overrideReason: _reason, relatedAssumptions: _assumptions, ...rest } = row;
  return {
    ...rest,
    name: candidate.name,
    description: candidate.description,
    ...(candidate.assumptions.length === 0 ? {} : { relatedAssumptions: candidate.assumptions }),
  };
}

function withScreenedItemLinked(row: ScreenedItemLedgerEntry, candidate: RiScreenCandidate): ScreenedItemLedgerEntry {
  const { overridesLink: _typed, overrideReason: _reason, impactOnRiskMetrics, ...rest } = row;
  const effect = candidate.impact ?? impactOnRiskMetrics;
  return {
    ...rest,
    itemRef: candidate.itemRef,
    screeningElementCode: candidate.code,
    screeningBasis: candidate.basis,
    ...(filled(effect) ? { impactOnRiskMetrics: effect } : {}),
  };
}

function countText(count: number, one: string, many: string): string | undefined {
  return count === 0 ? undefined : `${String(count)} ${count === 1 ? one : many}`;
}

function riRowsReplacedByLink(ri: RiskIntegration, code: RiLinkCode): string | undefined {
  const inputs = ri.inputs;
  if (inputs === undefined || applicationContextOf(ri).linkedWorkbooks[code] !== undefined) return undefined;
  const parts: (string | undefined)[] = code === "ES"
    ? [countText(inputs.families.length, "family", "families"), countText(inputs.sequences.length, "sequence", "sequences")]
    : code === "ESQ"
      ? [countText((inputs.contributors ?? []).length, "contributor", "contributors"), countText((inputs.importance ?? []).length, "importance measure", "importance measures")]
      : code === "RC"
        ? [countText(inputs.consequences.length, "result", "results")]
        : [];
  const named = parts.filter(filled);
  return named.length === 0 ? undefined : named.join(" and ");
}

function withFamilyRowsReplaced(ri: RiskIntegration, linkedIds: ReadonlySet<string>): RiskIntegration {
  const inputs = ri.inputs;
  if (inputs === undefined) return ri;
  const excluded = inputs.families
    .filter((row) => !row.included && linkedIds.has(row.id))
    .map((row): RiLinkedFamilyDetail => ({ familyId: row.id, included: false, ...(filled(row.exclusionReason) ? { exclusionReason: row.exclusionReason } : {}) }));
  const kept = (inputs.linkedFamilyDetails ?? []).filter((detail) => !excluded.some((entry) => entry.familyId === detail.familyId));
  const { linkedFamilyDetails: _details, ...rest } = inputs;
  const details = [...kept, ...excluded];
  return { ...ri, inputs: { ...rest, families: [], sequences: [], ...(details.length === 0 ? {} : { linkedFamilyDetails: details }) } };
}

function withQuantificationRowsReplaced(ri: RiskIntegration): RiskIntegration {
  const inputs = ri.inputs;
  if (inputs === undefined) return ri;
  const { contributors: _contributors, importance: _importance, ...rest } = inputs;
  return { ...ri, inputs: rest };
}

function withConsequenceRowsReplaced(ri: RiskIntegration): RiskIntegration {
  const inputs = ri.inputs;
  return inputs === undefined ? ri : { ...ri, inputs: { ...inputs, consequences: [] } };
}

function unchanged(ri: RiskIntegration): RiskIntegration {
  return ri;
}

async function loadRiLinkReplacement(code: RiLinkCode, workbookId: string): Promise<RiMutation> {
  if (code === "ES") {
    const es = await loadLinkedEs(workbookId);
    const ids = new Set(es.eventSequenceFamilies.map((family) => family.uuid));
    return (ri) => withFamilyRowsReplaced(ri, ids);
  }
  if (code === "ESQ") {
    await loadLinkedEsq(workbookId);
    return withQuantificationRowsReplaced;
  }
  if (code === "RC") {
    await loadLinkedRc(workbookId);
    return withConsequenceRowsReplaced;
  }
  if (code === "MS") {
    await loadLinkedMs(workbookId);
    return unchanged;
  }
  await loadLinkedPos(workbookId);
  return unchanged;
}

export {
  loadRiLinkReplacement,
  riRowsReplacedByLink,
  riScreenedItemLink,
  riShowsSavedCopies,
  riUncertaintyLink,
  riWithLinkedData,
  riWithoutLinkedData,
  withScreenedItemLinked,
  withUncertaintyLinked,
  type RiMutation,
};
