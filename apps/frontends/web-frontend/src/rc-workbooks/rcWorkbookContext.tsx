import type { RcCaseRecords, RcCaseSelection, RcCaseTable, RcCaseTextPage, RcCaseDataset, RcCaseReview, RcLinkedResultValues } from "interfaces-mef-types/rc/case-records";
import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from "react";
import { type RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import type { EventSequenceFamilySource, ReleaseCategorySource } from "../workbooks/riskWorkbookConnections";
import type { ReleaseCategoryInputs } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcSourceTermValues } from "interfaces-mef-types/rc/source-term";
import type { RcSiteReceptors, RcSiteSettings } from "interfaces-mef-types/rc/site-receptors";
import type { RcWeatherInputs, RcWeatherSettings, RcWeatherPage } from "interfaces-mef-types/rc/weather";
import type { RcDoseInputs, RcDoseSettings, RcDosePathway, RcDoseFilePage, RcDoseRecord } from "interfaces-mef-types/rc/dose-inputs";
import type { RcTransportInputs, RcTransportSettings, RcLinkedDeposition, RcDecayDetail } from "interfaces-mef-types/rc/transport";

export interface RcCaseActions {
  saveSnapshot: (revision: number, selection: RcCaseSelection) => Promise<{ records: RcCaseRecords; snapshotId: string }>;
  saveResult: (revision: number, values: RcLinkedResultValues, file: File) => Promise<RcCaseRecords>;
  readTable: (selection: RcCaseSelection, kind: RcCaseDataset, offset: number) => Promise<RcCaseTable>;
  readText: (selection: RcCaseSelection, fileId: string, offset: number) => Promise<RcCaseTextPage>;
  readReview: (selection: RcCaseSelection) => Promise<RcCaseReview>;
  readChoices: (snapshotId: string, kind: "receptors" | "weather", search: string) => Promise<{ ids: string[]; total: number }>;
  readOutput: (resultId: string, offset: number) => Promise<RcCaseTextPage>;
}
export interface RcResultDraft { snapshotId: string; receptorId: string; trialId: string; doseText: string; unit: RcLinkedResultValues["unit"]; version: string; reference: string; confirmed: boolean; file?: File }

export interface RcDoseActions {
  importFile: (kind: "exposure" | RcDosePathway, revision: number, file: File, categoryId?: string, sourceRevision?: number) => Promise<RcDoseInputs>;
  saveSettings: (revision: number, categoryId: string, sourceRevision: number, settings: RcDoseSettings) => Promise<RcDoseInputs>;
  readOriginal: (documentId: string, offset: number) => Promise<RcDoseFilePage>;
  readRecords: (documentId: string, nuclide: string) => Promise<RcDoseRecord[]>;
}
interface DoseDraft { baseRevision: number; sourceRevision: number; settings: RcDoseSettings }
export interface RcTransportActions {
  importFiles: (kind: "deposition" | "dispersion" | "decay", revision: number, files: File[], categoryId?: string, sourceRevision?: number) => Promise<RcTransportInputs>;
  saveSettings: (revision: number, categoryId: string, sourceRevision: number, settings: RcTransportSettings) => Promise<RcTransportInputs>;
  unlink: (revision: number, kind: "decay" | "deposition", documentId?: string, categoryId?: string) => Promise<RcTransportInputs>;
  readSource: (categoryId: string) => Promise<RcLinkedDeposition>;
  readOriginal: (documentId: string) => Promise<string>;
  readDecay: (documentId: string, index: number, offset: number) => Promise<RcDecayDetail>;
}
interface TransportDraft { baseRevision: number; sourceRevision: number; settings: RcTransportSettings }

export interface RcWeatherActions {
  importFile: (kind: "weather" | "configuration", revision: number, file: File) => Promise<RcWeatherInputs>;
  saveSettings: (revision: number, settings: RcWeatherSettings, confirm: boolean) => Promise<RcWeatherInputs>;
  prepareCollection: (revision: number, siteRevision: number, dates: { start: string; end: string }) => Promise<RcWeatherInputs>;
  readOriginal: (documentId: string) => Promise<string>;
  readRecords: (offset: number) => Promise<RcWeatherPage>;
}
interface WeatherDraft { baseRevision: number; settings: RcWeatherSettings }

export interface RcSiteReceptorActions {
  importFile: (kind: "location" | "geometry", revision: number, file: File) => Promise<RcSiteReceptors>;
  saveSettings: (revision: number, settings: RcSiteSettings) => Promise<RcSiteReceptors>;
  readOriginal: (documentId: string) => Promise<string>;
}
interface SiteReceptorDraft { baseRevision: number; settings: RcSiteSettings }

export interface RcSourceTermActions {
  importFile: (categoryId: string, revision: number, file: File) => Promise<ReleaseCategoryInputs>;
  saveValues: (categoryId: string, revision: number, values: RcSourceTermValues) => Promise<ReleaseCategoryInputs>;
  downloadOriginal: (documentId: string) => Promise<void>;
}
interface SourceTermDraft { baseRevision: number; values: RcSourceTermValues }

interface RcWorkbookData {
  rc: RadiologicalConsequenceAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

type RcMutator = (rc: RadiologicalConsequenceAnalysis) => RadiologicalConsequenceAnalysis;

interface RcWorkbookContextValue extends RcWorkbookData {
  caseRecords?: RcCaseActions;
  resultDraft?: RcResultDraft;
  setResultDraft: (draft: RcResultDraft | undefined) => void;
  doseInputs?: RcDoseActions;
  doseDrafts: Record<string, DoseDraft | undefined>;
  setDoseDraft: (categoryId: string, draft: DoseDraft | undefined) => void;
  transport?: RcTransportActions;
  transportDrafts: Record<string, TransportDraft | undefined>;
  setTransportDraft: (categoryId: string, draft: TransportDraft | undefined) => void;
  rebaseTransportDrafts: (fromRevision: number, toRevision: number) => void;
  weather?: RcWeatherActions;
  weatherDraft?: WeatherDraft;
  setWeatherDraft: (draft: WeatherDraft | undefined) => void;
  weatherDates?: { start: string; end: string };
  setWeatherDates: (dates: { start: string; end: string } | undefined) => void;
  siteReceptors?: RcSiteReceptorActions;
  siteReceptorDraft?: SiteReceptorDraft;
  setSiteReceptorDraft: (draft: SiteReceptorDraft | undefined) => void;
  sourceTermDrafts: Record<string, SourceTermDraft | undefined>;
  setSourceTermDraft: (categoryId: string, draft: SourceTermDraft | undefined) => void;
  sourceTerms?: RcSourceTermActions;
  editable: boolean;
  mutateRc: (mutator: RcMutator) => void;
  eventSequenceFamilySources: EventSequenceFamilySource[];
  releaseCategorySources: ReleaseCategorySource[];
}

const RcWorkbookContext = createContext<RcWorkbookContextValue | null>(null);

function RcWorkbookProvider({ data, editable, mutateRc, eventSequenceFamilySources = [], releaseCategorySources = [], sourceTerms, siteReceptors, weather, transport, doseInputs, caseRecords, children }: {
  data: RcWorkbookData;
  editable: boolean;
  mutateRc: (mutator: RcMutator) => void;
  eventSequenceFamilySources?: EventSequenceFamilySource[];
  releaseCategorySources?: ReleaseCategorySource[];
  sourceTerms?: RcSourceTermActions;
  siteReceptors?: RcSiteReceptorActions;
  weather?: RcWeatherActions;
  transport?: RcTransportActions;
  doseInputs?: RcDoseActions;
  caseRecords?: RcCaseActions;
  children: React.ReactNode;
}): JSX.Element {
  const [resultDraft, setResultDraft] = useState<RcResultDraft>();
  const [sourceTermDrafts, setDrafts] = useState<Record<string, SourceTermDraft | undefined>>({});
  const [siteReceptorDraft, setSiteReceptorDraft] = useState<SiteReceptorDraft>();
  const [weatherDraft, setWeatherDraft] = useState<WeatherDraft>();
  const [weatherDates, setWeatherDates] = useState<{ start: string; end: string }>();
  const [doseDrafts, setDoseDrafts] = useState<Record<string, DoseDraft | undefined>>({});
  const setDoseDraft = useCallback((categoryId: string, draft: DoseDraft | undefined) => setDoseDrafts(previous => ({ ...previous, [categoryId]: draft })), []);
  const [transportDrafts, setTransportDrafts] = useState<Record<string, TransportDraft | undefined>>({});
  const setTransportDraft = useCallback((categoryId: string, draft: TransportDraft | undefined) => setTransportDrafts(previous => ({ ...previous, [categoryId]: draft })), []);
  const rebaseTransportDrafts = useCallback((fromRevision: number, toRevision: number) => {
    if (fromRevision === toRevision) return;
    // Reference-file imports leave settings unchanged. Preserve the latest local edits and existing conflicts.
    setTransportDrafts(previous => Object.fromEntries(Object.entries(previous).map(([categoryId, draft]) => [categoryId,
      draft?.baseRevision === fromRevision ? { ...draft, baseRevision: toRevision } : draft,
    ])));
  }, []);
  const setSourceTermDraft = useCallback((categoryId: string, draft: SourceTermDraft | undefined) => {
    setDrafts((previous) => ({ ...previous, [categoryId]: draft }));
  }, []);
  useEffect(() => {
    if (!resultDraft && !Object.values(sourceTermDrafts).some(Boolean) && !siteReceptorDraft && !weatherDraft && !weatherDates && !Object.values(transportDrafts).some(Boolean) && !Object.values(doseDrafts).some(Boolean)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sourceTermDrafts, siteReceptorDraft, weatherDraft, weatherDates, transportDrafts, doseDrafts, resultDraft]);
  const value = useMemo<RcWorkbookContextValue>(
    () => ({ ...data, caseRecords, resultDraft, setResultDraft, editable, mutateRc, eventSequenceFamilySources, releaseCategorySources, sourceTerms, sourceTermDrafts, setSourceTermDraft, siteReceptors, siteReceptorDraft, setSiteReceptorDraft,
      weather, weatherDraft, setWeatherDraft, weatherDates, setWeatherDates, transport, transportDrafts, setTransportDraft, rebaseTransportDrafts, doseInputs, doseDrafts, setDoseDraft }),
    [data, caseRecords, resultDraft, editable, mutateRc, eventSequenceFamilySources, releaseCategorySources, sourceTerms, sourceTermDrafts, setSourceTermDraft, siteReceptors, siteReceptorDraft, weather, weatherDraft, weatherDates, transport, transportDrafts, setTransportDraft, rebaseTransportDrafts, doseInputs, doseDrafts, setDoseDraft],
  );
  return <RcWorkbookContext.Provider value={value}>{children}</RcWorkbookContext.Provider>;
}

function useRcWorkbook(): RcWorkbookContextValue {
  const ctx = useContext(RcWorkbookContext);
  if (ctx === null) throw new Error("useRcWorkbook must be used inside RcWorkbookProvider");
  return ctx;
}

export { RcWorkbookProvider, useRcWorkbook, type RcWorkbookData, type RcMutator };
