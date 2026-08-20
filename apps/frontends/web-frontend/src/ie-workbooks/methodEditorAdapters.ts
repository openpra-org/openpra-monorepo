import { type FailureModesEffectAnalysis } from "interfaces-mef-types/cross-cutting/methods/fmea";
import { type HazardOperabilityStudy, type HazopGuideword as MefGuideword } from "interfaces-mef-types/cross-cutting/methods/hazop";
import { type ProcessHazardAnalysis } from "interfaces-mef-types/cross-cutting/methods/process-hazard-analysis";
import { type OperatingExperienceReview, type OeApplicability } from "interfaces-mef-types/cross-cutting/methods/operating-experience-review";
import { type GenericInitiatorCatalogue } from "interfaces-mef-types/cross-cutting/methods/generic-initiator-catalogue";
import { type WorksheetModel, type FmeaRow, type HazopRow, type FmeaSeverity, type HazopGuideword } from "../newly-developed-methods/worksheet/worksheetTypes";
import { type PhaModel } from "../newly-developed-methods/process-hazard-analysis/phaTypes";
import { type OeModel, type OeApplic } from "../newly-developed-methods/operating-experience/operatingExperienceTypes";
import { type CatalogueModel } from "../newly-developed-methods/generic-catalogue/genericCatalogueTypes";

function severityBand(n: number): FmeaSeverity {
  if (n >= 7) return "HIGH";
  if (n >= 5) return "MED";
  return "LOW";
}

const GUIDEWORD_LABEL: Record<MefGuideword, HazopGuideword> = {
  NO: "NO",
  MORE: "MORE",
  LESS: "LESS",
  REVERSE: "REVERSE",
  AS_WELL_AS: "AS WELL AS",
  PART_OF: "PART OF",
  OTHER_THAN: "OTHER THAN",
  EARLY: "EARLY",
  LATE: "LATE",
};

const APPLIC_LABEL: Record<OeApplicability, OeApplic> = {
  HIGH: "high",
  MEDIUM: "med",
  SCREENED: "screen",
  OPEN: "open",
};

function fmeaRows(fmea: FailureModesEffectAnalysis | undefined): FmeaRow[] {
  if (fmea === undefined) return [];
  return fmea.failureModes.map((fm) => ({
    component: fm.componentId,
    mode: fm.mode,
    cause: fm.causes.join("; "),
    local: fm.localEffects.join("; "),
    effect: fm.systemEffects.join("; "),
    detect: fm.detection.join("; "),
    safeguard: fm.safeguards.join("; "),
    sev: severityBand(fm.severity),
    ie: fm.derivedInitiatorIds.join(", "),
  }));
}

function hazopRows(hazop: HazardOperabilityStudy | undefined): HazopRow[] {
  if (hazop === undefined) return [];
  return hazop.deviations.map((d) => ({
    node: d.node,
    param: d.parameter,
    guide: GUIDEWORD_LABEL[d.guideword],
    dev: d.deviation,
    cause: d.causes.join("; "),
    cons: d.consequence,
    safeguard: d.safeguards.join("; "),
    ie: d.derivedInitiatorIds.join(", "),
  }));
}

export function buildWorksheetModel(fmea: FailureModesEffectAnalysis | undefined, hazop: HazardOperabilityStudy | undefined): WorksheetModel {
  return { fmea: fmeaRows(fmea), hazop: hazopRows(hazop) };
}

export function buildPhaModel(
  pha: ProcessHazardAnalysis,
  fmeas: FailureModesEffectAnalysis[],
  hazops: HazardOperabilityStudy[],
): PhaModel {
  const fmeaName = (id: string): string => fmeas.find((f) => f.uuid === id)?.name ?? id;
  const hazopName = (id: string): string => hazops.find((h) => h.uuid === id)?.name ?? id;
  return {
    scope: pha.scope,
    reconciledFmea: pha.reconciledFmeaIds.map(fmeaName),
    reconciledHazop: pha.reconciledHazopIds.map(hazopName),
    directInitiators: pha.directInitiatorIds,
    items: pha.reconciliationItems.map((it) => ({
      topic: it.topic,
      fmea: it.fmeaCoverage,
      hazop: it.hazopCoverage,
      resolution: it.resolution,
      ie: it.derivedInitiatorIds.join(", "),
    })),
  };
}

export function buildOeModel(oe: OperatingExperienceReview): OeModel {
  const nameById = new Map(oe.sources.map((s) => [s.id, s.name]));
  return {
    sources: oe.sources.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      period: s.period,
      events: s.eventsReviewed,
      applic: APPLIC_LABEL[s.applicability],
      note: s.note,
    })),
    precursors: oe.precursors.map((p) => ({
      id: p.id,
      event: p.event,
      sourceId: p.sourceId,
      source: nameById.get(p.sourceId) ?? p.sourceId,
      date: p.date,
      maps: p.derivedInitiatorIds.length > 0 ? p.derivedInitiatorIds.join(", ") : "(open)",
      disp: p.disposition,
    })),
  };
}

export function buildCatalogueModel(cat: GenericInitiatorCatalogue): CatalogueModel {
  return {
    entries: cat.entries.map((e) => ({
      gid: e.id,
      name: e.name,
      src: e.source,
      applic: e.applicable,
      maps: e.applicable ? e.derivedInitiatorIds.join(", ") : "—",
      rationale: e.rationale,
    })),
  };
}
