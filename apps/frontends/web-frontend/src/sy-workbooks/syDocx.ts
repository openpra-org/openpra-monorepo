import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import { carriesUncertainExpression, type CommonCauseFailureGroup, type SystemBasicEvent, type SystemDefinition, type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { analysisModelBasicEvents, ccfSources, dependencySources, modelSources, plantItems, systemStudies, type PlantList } from "./syUncertainty";
import { isSystemLevelModel } from "./sySelectors";
import { CONFIRM_METHODS, RESOURCE_TYPE_LABELS, SCREENING_CRITERIA, toExp } from "./syViewData";
import { ccfFactorText, ccfModelText, memberEvents, sharedCauseLines } from "./syCcf";
import {
  DEPENDENCY_TREATMENT_LABELS,
  SUPPORT_KIND_LABELS,
  dependencyLinks,
  inventoryHours,
  linkDescription,
  treatmentOf,
  type DependencyLink,
} from "./syDependencyLinks";
import { TREATMENT_LABELS, integrationFor, systemOutages, systemTree } from "./syFailureRecords";
import { BOUNDARY_STATUS_LABELS, DESIGNATOR_KIND_LABELS, EVENT_TYPE_LABELS, boundaryRows, confirmationRecords, detailRecords } from "./syIntegrityChecks";
import type { SyControlledComponentBoundaryOption, SyControlledParameterOption, SyLinkedInputs } from "./syWorkbookContext";
import { AnalysisRunDetailsSchema, AnalysisRunProvenanceListSchema } from "interfaces-shared-types/newly-developed-methods/shared";
import { FaultTreeAnalysisResultSchema } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import { fetchJson } from "../api/client";
import { evaluateResolved } from "../newly-developed-methods/shared/uncertaintyLinks";
import { parametersFor } from "../newly-developed-methods/shared/useUncertainty";
import { expressionText } from "../newly-developed-methods/shared/uncertainText";
import { linkedOptions } from "./syBasicEventValues";
import { syValueSources } from "./syMissionTimes";
import { pointsOf } from "../newly-developed-methods/shared/uncertaintyPoints";
import { numberText } from "../newly-developed-methods/shared/uncertainText";

type ReportKind = "methodology" | "system";
interface ReportLinks {
  parameters: readonly SyControlledParameterOption[];
  boundaries: readonly SyControlledComponentBoundaryOption[];
  missionTimes: Pick<SyLinkedInputs, "scMissionTimeOptions" | "scMissionTimeTable"> | null;
}
type Heading = (typeof HeadingLevel)[keyof typeof HeadingLevel];
interface UncertaintySummary { modelId: string; mean: number; lower: number; upper: number; samples: number }

async function eventPoints(events: readonly SystemBasicEvent[], links: ReportLinks): Promise<Map<string, string>> {
  const valued = events.flatMap((event) => (carriesUncertainExpression(event.failureMode) && event.expression !== undefined ? [{ id: event.uuid, expression: event.expression }] : []));
  if (valued.length === 0) return new Map();
  try {
    const response = await evaluateResolved({
      parameters: parametersFor(valued.map(({ expression }) => expression), syValueSources(links.parameters, links.missionTimes).table),
      laws: [],
      expressions: valued.map(({ expression }, index) => ({ id: String(index), expression, unit: "PROBABILITY", probabilities: [] })),
      operations: [],
    });
    return new Map(valued.map(({ id }, index) => {
      const answer = response.expressions.find((entry) => entry.id === String(index));
      return [id, answer === undefined ? "Not available" : "error" in answer ? `Not available: ${answer.error}` : toExp(answer.point)];
    }));
  } catch (error) {
    const reason = error instanceof Error ? `Not available: ${error.message}` : "Not available";
    return new Map(valued.map(({ id }) => [id, reason]));
  }
}

function eventValueRow(event: SystemBasicEvent, links: ReportLinks, points: ReadonlyMap<string, string>): string[] {
  const mode = String(event.failureMode ?? "—");
  if (!carriesUncertainExpression(event.failureMode)) return [event.code, mode, event.controlledDataSource === undefined ? "Typed probability" : "Linked probability", event.probability === undefined ? "—" : toExp(event.probability)];
  if (event.expression === undefined) return [event.code, mode, "No value", "—"];
  return [event.code, mode, expressionText(event.expression, syValueSources(links.parameters, links.missionTimes).label), points.get(event.uuid) ?? "—"];
}

async function systemHours(systems: readonly SystemDefinition[], links: ReportLinks): Promise<Map<string, string>> {
  const entries = systems.flatMap((system) => (system.missionTime === undefined ? [] : [{ key: system.uuid, expression: system.missionTime, unit: "HOURS" as const }]));
  const text = new Map(systems.map((system) => [system.uuid, system.missionTime === undefined ? "Not set" : "Not available"]));
  try {
    const points = await pointsOf(entries, syValueSources(links.parameters, links.missionTimes).table);
    points.forEach((point, key) => text.set(key, `${numberText(point)} h`));
    return text;
  } catch (error) {
    const reason = error instanceof Error ? `Not available: ${error.message}` : "Not available";
    entries.forEach((entry) => text.set(entry.key, reason));
    return text;
  }
}

function missionTimeText(system: SystemDefinition, hours: ReadonlyMap<string, string>, links: ReportLinks): string {
  const point = hours.get(system.uuid) ?? "Not set";
  return system.missionTime === undefined ? point : `${point} (${expressionText(system.missionTime, syValueSources(links.parameters, links.missionTimes).label)})`;
}

async function currentUncertaintySummaries(workbookId: string | null, revision: number | null): Promise<UncertaintySummary[]> {
  if (workbookId === null || revision === null) return [];
  const base = `/api/sy-workbooks/${encodeURIComponent(workbookId)}/analysis-runs`;
  const summaries = new Map<string, UncertaintySummary>();
  let cursor: string | undefined;
  try {
    for (let page = 0; page < 10; page++) {
      const list = AnalysisRunProvenanceListSchema.parse(await fetchJson<unknown>(base + (cursor === undefined ? "" : `?cursor=${encodeURIComponent(cursor)}`)));
      for (const { run } of list.runs) {
        if (run.methodType !== "FAULT_TREE" || run.status !== "SUCCEEDED" || run.owner.workbookRevision !== revision
          || run.freshness?.status !== "CURRENT" || summaries.has(run.owner.modelId)) continue;
        const details = AnalysisRunDetailsSchema.parse(await fetchJson<unknown>(`${base}/${run.id}/details`));
        if (details.request["calculationType"] !== "UNCERTAINTY" || details.request["uncertaintyInputSource"] !== "DA") continue;
        const result = FaultTreeAnalysisResultSchema.safeParse(details.result);
        if (!result.success || result.data.uncertainty === undefined) continue;
        const quantiles = result.data.uncertainty.quantiles;
        summaries.set(run.owner.modelId, { modelId: run.owner.modelId, mean: result.data.uncertainty.mean,
          lower: quantiles.find((item) => item.probability === 0.05)?.value ?? quantiles[0]?.value ?? result.data.uncertainty.mean,
          upper: quantiles.find((item) => item.probability === 0.95)?.value ?? quantiles[quantiles.length - 1]?.value ?? result.data.uncertainty.mean,
          samples: result.data.uncertainty.sampleCount });
      }
      if (list.nextCursor === undefined || list.nextCursor === null) break;
      cursor = list.nextCursor;
    }
  } catch { return [...summaries.values()]; }
  return [...summaries.values()];
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 }, pageBreakBefore: level === HeadingLevel.HEADING_1 });
}

function para(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)], spacing: { after: 120 } });
}

function bullet(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)], bullet: { level: 0 } });
}

function cell(text: string, header: boolean): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: header, size: 18 })] })],
    shading: header ? { fill: "F0E8FF" } : undefined,
  });
}

function dataTable(headers: string[], rows: string[][]): Table {
  const headerRow = new TableRow({ tableHeader: true, children: headers.map((h) => cell(h, true)) });
  const bodyRows = rows.map((r) => new TableRow({ children: r.map((c) => cell(c, false)) }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "D9CEE2" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "D9CEE2" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "D9CEE2" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "D9CEE2" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "EDE6F2" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "EDE6F2" },
    },
  });
}

function introSection(a: SystemsAnalysis, stageLabel: string): (Paragraph | Table)[] {
  const doc = a.documentation;
  return [
    heading("Introduction", HeadingLevel.HEADING_1),
    heading("Purpose", HeadingLevel.HEADING_2),
    para(doc.processDescription),
    heading("Scope", HeadingLevel.HEADING_2),
    para(a.praScope),
    heading("Relationship to other documents", HeadingLevel.HEADING_2),
    para(doc.praTaskInterfaces),
    heading("Document layout", HeadingLevel.HEADING_2),
    para("This report covers the assumptions and limitations, the system breakdown structure and the methodologies, followed by the data sources and references."),
    heading("Quality assurance", HeadingLevel.HEADING_2),
    para(doc.informationSources),
    heading("Freeze date", HeadingLevel.HEADING_2),
    para(`Model version ${a.version}. Analysis date: ${a.metadata.analysisDate}. Stage: ${stageLabel}.`),
    heading("Assumptions & limitations", HeadingLevel.HEADING_1),
    para(doc.asBuiltLimitations),
  ];
}

function modelLabel(a: SystemsAnalysis, systemId: string): string {
  const model = a.systemLogicModels.find((candidate) => candidate.systemReference === systemId);
  if (model === undefined) return "Not built";
  return isSystemLevelModel(model) ? "System-level" : "Fault tree";
}

function commonCauseTable(a: SystemsAnalysis, groups: readonly CommonCauseFailureGroup[], links: ReportLinks): Table {
  const label = syValueSources(links.parameters, links.missionTimes).label;
  const systemName = (id: string): string => {
    const system = a.systemDefinitions.find((candidate) => candidate.uuid === id);
    return system?.abbreviation ?? system?.name ?? id;
  };
  return dataTable(
    ["Group", "Member events", "Shared causes", "Defenses", "Parameters", "Source"],
    groups.length === 0 ? [["None", "—", "—", "—", "—", "—"]] : groups.map((group) => {
      const reference = group.dataAnalysisCCFParameterRef ?? "";
      return [
        group.scope === "INTERSYSTEM" ? `${group.name} (across ${group.affectedSystems.map(systemName).join(", ")})` : group.name,
        memberEvents(group, a).map((event) => event.name).join(", ") || "—",
        sharedCauseLines(group).join(", ") || "—",
        (group.defenseMechanisms ?? []).join(", ") || "—",
        [ccfModelText(group.factors), ccfFactorText(group.factors, label), `Qₜ ${expressionText(group.total, label)}`].join(" · "),
        reference.length > 0 ? `DA ${reference}` : (group.dataSources?.[0]?.reference ?? "Typed"),
      ];
    }),
  );
}

function linkTreatmentText(link: DependencyLink, record: DependencyLink["records"][number] | undefined): string {
  const treatment = record === undefined ? (link.transfers.length > 0 ? "SYSTEM_MODEL" : undefined) : treatmentOf(record, link);
  if (treatment === undefined) return "—";
  const reason = treatment === "EXCLUDED" ? record?.exclusionJustification : undefined;
  return reason === undefined ? DEPENDENCY_TREATMENT_LABELS[treatment] : `${DEPENDENCY_TREATMENT_LABELS[treatment]}. ${reason}`;
}

function linkRowsFor(a: SystemsAnalysis, links: readonly DependencyLink[], other: (link: DependencyLink) => string): string[][] {
  const nameOf = (id: string): string => a.systemDefinitions.find((candidate) => candidate.uuid === id)?.name ?? id;
  return links.flatMap((link) => {
    const records = link.records.length === 0 ? [undefined] : link.records;
    return records.map((record) => [
      nameOf(other(link)),
      record?.supportKind === undefined ? "—" : SUPPORT_KIND_LABELS[record.supportKind],
      linkDescription(link, record) ?? "—",
      linkTreatmentText(link, record),
    ]);
  });
}

function dependencyContent(a: SystemsAnalysis, system: SystemDefinition, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const nameOf = (id: string): string => a.systemDefinitions.find((candidate) => candidate.uuid === id)?.name ?? id;
  const links = dependencyLinks(a, null);
  const needs = links.filter((link) => link.dependentSystem === system.uuid);
  const neededBy = links.filter((link) => link.supportingSystem === system.uuid);
  out.push(heading("Support it needs", level));
  out.push(dataTable(["Support system", "Kind", "What it provides", "Treatment"], needs.length > 0 ? linkRowsFor(a, needs, (link) => link.supportingSystem) : [["None", "—", "—", "—"]]));
  if (neededBy.length > 0) {
    out.push(heading("Systems that need it", level));
    out.push(dataTable(["System", "Kind", "What it needs", "Treatment"], linkRowsFor(a, neededBy, (link) => link.dependentSystem)));
  }
  const criteria = (a.supportSystemSuccessCriteria ?? []).filter((item) => item.systemReference === system.uuid);
  if (criteria.length > 0) {
    out.push(heading("Support success criteria", level));
    out.push(dataTable(["Criterion", "Basis", "Serves"], criteria.map((item) => [
      item.successCriteria || "—",
      item.criteriaType === "REALISTIC" ? "Realistic" : "Conservative",
      item.supportedSystems.map(nameOf).join(", ") || "—",
    ])));
  }
  const analyses = (a.supportSystemNeedAnalyses ?? []).filter((item) => item.systemReference === system.uuid);
  if (analyses.length > 0) {
    out.push(heading("Support need analyses", level));
    out.push(dataTable(["Analysis", "Conditions it covers"], analyses.map((item) => [item.analysisReference || "—", item.conditionsRepresented.join("; ") || "—"])));
  }
  const eventNames = new Map(a.systemBasicEvents.map((event) => [event.uuid, event.name]));
  const couplings = (a.environmentalDesignBasisConsiderations ?? []).filter((item) => item.systemReference === system.uuid);
  if (couplings.length > 0) {
    out.push(heading("Shared spaces and harsh conditions", level));
    out.push(dataTable(["Condition", "Events it affects", "Initiating events", "In the model"], couplings.map((item) => [
      item.environmentalConditions || "—",
      (item.basicEventIds ?? []).map((id) => eventNames.get(id) ?? id).join(", ") || "—",
      (item.initiatingEventIds ?? []).join(", ") || "—",
      (item.dependentFailuresIncluded === true ? "Yes" : "Not yet") + (item.beyondQualification === true ? ", beyond environmental qualification" : ""),
    ])));
  }
  const inventories = (a.depletionModels ?? []).filter((item) => item.associatedSystem === system.uuid);
  if (inventories.length > 0) {
    out.push(heading("Inventories", level));
    out.push(dataTable(["Inventory", "Lasts", "Carries the mission", "Basis"], inventories.map((item) => {
      const hours = inventoryHours(item);
      const lasts = item.initialQuantity <= 0 ? "Does not deplete" : hours === null ? "—" : `${Number(hours.toPrecision(4))} h`;
      const carries = item.missionTimeSupported === undefined ? "Not assessed" : item.missionTimeSupported ? "Yes" : "No";
      return [item.description ?? RESOURCE_TYPE_LABELS[item.resourceType], lasts, carries, item.basis ?? "—"];
    })));
  }
  const actuations = (a.initiationActuationSystems ?? []).filter((item) => item.systemReference === system.uuid);
  const digital = (a.digitalInstrumentationAndControl ?? []).filter((item) => item.systemReference === system.uuid);
  if (actuations.length > 0 || digital.length > 0) {
    out.push(heading("Actuation and software", level));
    const actuationRows = actuations.map((item) => {
      const detail = item.detailedModeling ? "Modeled in detail." : `Modeled without detail. ${item.justificationForNonDetailedModeling ?? ""}`.trim();
      const software = item.softwareModelingApproach === undefined ? "" : ` Software: ${item.softwareModelingApproach}`;
      return [item.name || "—", `${detail}${software}`];
    });
    const digitalRows = digital.map((item) => [item.name || "—", item.methodology || "—"]);
    out.push(dataTable(["Record", "How the model treats it"], [...actuationRows, ...digitalRows]));
  }
  return out;
}

function dependencySummary(a: SystemsAnalysis): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const method = a.dependencySearchMethodology;
  if (method.description.length > 0) out.push(para(`${method.description} Reference: ${method.reference.length > 0 ? method.reference : "not recorded"}.`));
  const nameOf = (id: string): string => a.systemDefinitions.find((candidate) => candidate.uuid === id)?.name ?? id;
  const links = dependencyLinks(a, null);
  out.push(dataTable(["System", "Support it needs"], a.systemDefinitions.map((system) => {
    const needs = links.filter((link) => link.dependentSystem === system.uuid).map((link) => {
      const record = link.records[0];
      const kind = record?.supportKind === undefined ? "" : ` (${SUPPORT_KIND_LABELS[record.supportKind].toLowerCase()})`;
      const leftOut = record !== undefined && treatmentOf(record, link) === "EXCLUDED" ? ", left out" : "";
      return `${nameOf(link.supportingSystem)}${kind}${leftOut}`;
    });
    return [system.name, needs.length > 0 ? needs.join("; ") : "None"];
  })));
  return out;
}

function failureModeContent(a: SystemsAnalysis, system: SystemDefinition, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const tree = systemTree(a, system.uuid);
  const eventNames = new Map(tree.events.map((event) => [event.uuid, event.name]));
  const lists: [string, string[] | undefined][] = [
    ["Failures left out", system.justificationForExclusionOfComponents],
    ["Flow diversion paths", system.flowDiversionConsiderations],
    ["Conditions that defeat the function", system.functionLossConditions],
  ];
  for (const [title, items] of lists) {
    if (items === undefined || items.length === 0) continue;
    out.push(heading(title, level));
    for (const item of items) out.push(bullet(item));
  }
  const screenings = (a.componentScreeningJustifications ?? []).filter((item) => item.systemReference === system.uuid);
  if (screenings.length > 0) {
    out.push(heading("Screened out", level));
    out.push(dataTable(["Left out", "Criterion", "Justification"], screenings.map((item) => [
      item.componentId || "—",
      `Criterion ${item.screeningCriterion}: ${SCREENING_CRITERIA.find((criterion) => criterion.code === item.screeningCriterion)?.short ?? ""}`,
      item.quantitativeJustification || "—",
    ])));
  }
  const signals = (a.isolationTripConditions ?? []).filter((item) => item.systemReference === system.uuid);
  if (signals.length > 0) {
    out.push(heading("Isolation and trip signals", level));
    out.push(dataTable(["Signal", "Treatment", "Why left out"], signals.map((item) => [item.condition || "—", TREATMENT_LABELS[item.modeledIn], item.exclusionJustification ?? "—"])));
  }
  const outages = systemOutages(a, system.uuid, new Set(eventNames.keys()));
  if (outages.length > 0) {
    out.push(heading("Out of service together", level));
    out.push(dataTable(["Planned activity", "Maintenance events", "DA record", "Basis"], outages.map((item) => [
      item.description || "—",
      item.componentIds.map((id) => eventNames.get(id) ?? id).join(", ") || "—",
      item.dataAnalysisRef ?? "—",
      item.plannedActivityBasis || "—",
    ])));
  }
  const integrations = a.humanFailureEventIntegrations.filter((item) => item.system === system.uuid);
  const humanEvents = tree.events.filter((event) => event.failureMode === "HUMAN_ERROR");
  if (humanEvents.length > 0) {
    out.push(heading("Human failure events", level));
    out.push(dataTable(["Event", "Type", "HR event", "Effect on the system"], humanEvents.map((event) => {
      const integration = integrationFor(integrations, event);
      return [
        event.name,
        integration === undefined ? "—" : `${integration.hfeType === "PRE_INITIATOR" ? "Pre-initiator" : "Post-initiator"}${integration.isTestMaintenance ? ", after test or maintenance" : ""}`,
        integration?.hfeReference || "—",
        integration?.impact ?? "—",
      ];
    })));
  }
  return out;
}

function integrityContent(a: SystemsAnalysis, system: SystemDefinition, level: Heading, links: ReportLinks): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const codeOf = (eventId: string): string => a.systemBasicEvents.find((event) => event.uuid === eventId)?.code ?? eventId;
  const records = confirmationRecords(a, system.uuid);
  out.push(heading("Confirmation against the plant", level));
  if (records.length === 0) out.push(para("Not confirmed against the plant yet."));
  else out.push(dataTable(["Method", "Who took part", "Findings", "Date"], records.map((record) => [CONFIRM_METHODS[record.method] ?? record.method, record.personnelRoles.join(", ") || "—", record.findings || "—", record.date || "—"])));
  const details = detailRecords(a, system.uuid);
  if (details.length > 0) {
    out.push(heading("Level of detail", level));
    out.push(dataTable(["What the model includes", "Checked against", "Finding"], details.map((record) => [record.description || "—", record.techniques.join("; ") || "—", record.results || "—"])));
  }
  const reviewed = boundaryRows(a, system.uuid, links.parameters, links.boundaries).flatMap((row) => (row.review === undefined ? [] : [{ row, review: row.review }]));
  if (reviewed.length > 0) {
    out.push(heading("Component boundaries", level));
    out.push(dataTable(["Events", "Data boundary", "Review", "Note"], reviewed.map(({ row, review }) => [
      row.events.map((event) => event.code).join(", ") || "—",
      row.boundary?.name ?? review.componentBoundaryRef,
      BOUNDARY_STATUS_LABELS[review.status],
      review.note ?? "—",
    ])));
  }
  const modules = (a.modularizationRecords ?? []).filter((record) => record.systemReference === system.uuid);
  if (modules.length > 0) {
    out.push(heading("Supercomponents", level));
    out.push(dataTable(["Supercomponent", "Stands for", "Events", "Basis"], modules.map((record) => [
      record.moduleId || "—",
      record.representedComponentIds.join(", ") || "—",
      (record.basicEventIds ?? []).map(codeOf).join(", ") || "—",
      record.justification || "—",
    ])));
  }
  return out;
}

function namingTable(a: SystemsAnalysis, links: ReportLinks): Table {
  const systems = new Map(a.systemDefinitions.map((system) => [system.uuid, system.name]));
  const modes = new Map(links.parameters.flatMap((parameter) => (parameter.failureModeId === undefined ? [] : [[parameter.failureModeId, parameter.failureModeName ?? parameter.failureModeId] as const])));
  const designators = a.nomenclatureDesignators ?? [];
  return dataTable(["Designator", "Kind", "Meaning", "Applies to"], designators.length === 0 ? [["None listed", "—", "—", "—"]] : designators.map((designator) => [
    designator.designator || "—",
    DESIGNATOR_KIND_LABELS[designator.kind],
    designator.meaning || "—",
    designator.kind === "SYSTEM"
      ? systems.get(designator.systemReference ?? "") ?? "—"
      : designator.kind === "EVENT_TYPE"
        ? designator.eventType === undefined ? "—" : EVENT_TYPE_LABELS[designator.eventType]
        : (designator.failureModeRefs ?? []).map((ref) => modes.get(ref) ?? ref).join(", ") || "—",
  ]));
}

function systemUncertaintyContent(a: SystemsAnalysis, systemId: string, level: Heading): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const groupName = (groupId: string): string => a.commonCauseFailureGroups.find((group) => group.uuid === groupId)?.name ?? groupId;
  const systemName = (id: string): string => a.systemDefinitions.find((system) => system.uuid === id)?.name ?? id;
  const sources = modelSources(a, systemId);
  out.push(heading("Model uncertainty", level));
  if (sources.length === 0) out.push(para("No model uncertainty recorded."));
  else out.push(dataTable(["Source and assumption", "Effect on the results", "Treatment"], sources.map((item) => [
    item.description || "—",
    item.impact || "—",
    `${item.treatmentApproach || "Open"}${item.isQuantified ? " Quantified." : ""}`,
  ])));
  const coupling = [
    ...ccfSources(a, systemId).map((item) => [groupName(item.ccfGroupId), item.description || "—", item.impact || "—"]),
    ...dependencySources(a, systemId).map((item) => [item.supportingSystem === undefined ? "Shared space or condition" : systemName(item.supportingSystem), item.description || "—", item.impact || "—"]),
  ];
  if (coupling.length > 0) {
    out.push(heading("Common cause and dependency uncertainty", level));
    out.push(dataTable(["Group or support", "Source", "Effect on the results"], coupling));
  }
  const studies = systemStudies(a, systemId);
  if (studies.length > 0) {
    out.push(heading("Sensitivity studies", level));
    out.push(dataTable(["Study", "What it varies", "Result"], studies.map((study) => [
      study.name ?? "—",
      study.variedParameters.map((parameter) => {
        const range = study.parameterRanges[parameter];
        return range === undefined ? parameter : `${parameter}: ${range[0]} to ${range[1]}`;
      }).join("; ") || "—",
      study.results ?? "—",
    ])));
  }
  return out;
}

const PLANT_TABLES: readonly [PlantList, string, string, string][] = [
  ["sources", "Sources across systems", "Source", "Effect on the results"],
  ["assumptions", "Related assumptions", "Assumption", "Basis"],
  ["alternatives", "Reasonable alternatives", "Alternative", "Why it was not selected"],
];

function plantUncertaintyContent(a: SystemsAnalysis): (Paragraph | Table)[] {
  const short = (id: string): string => a.systemDefinitions.find((system) => system.uuid === id)?.abbreviation ?? id;
  return PLANT_TABLES.flatMap(([list, title, text, detail]) => {
    const items = plantItems(a, list);
    return items.length === 0 ? [] : [
      heading(title, HeadingLevel.HEADING_2),
      dataTable([text, detail, "Applies to"], items.map((item) => [item.text || "—", item.detail || "—", item.systems.map(short).join(", ") || "—"])),
    ];
  });
}

function systemDescriptions(a: SystemsAnalysis, links: ReportLinks, hours: ReadonlyMap<string, string>): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [heading("System descriptions", HeadingLevel.HEADING_1)];
  for (const system of a.systemDefinitions) {
    const model = a.systemLogicModels.find((candidate) => candidate.systemReference === system.uuid);
    const variants = (a.variableSuccessCriteria ?? []).filter((criterion) => criterion.systemReference === system.uuid);
    const alignments = system.alignments ?? [];
    const limits = (a.overCapacityConsiderations ?? []).filter((item) => item.system === system.uuid);
    const assumptions = (a.preOperationalAssumptions ?? []).filter((item) => item.affectedElementIds.includes(system.uuid));
    out.push(heading(system.abbreviation === undefined ? system.name : `${system.name} (${system.abbreviation})`, HeadingLevel.HEADING_2));
    out.push(para(`Top event: ${system.description ?? "Not set"}`));
    out.push(para(`Success criterion: ${system.successCriterion ?? "Not set"}`));
    out.push(para(`Mission time: ${missionTimeText(system, hours, links)}. Model: ${modelLabel(a, system.uuid)}${model !== undefined && isSystemLevelModel(model) ? `, because ${model.nonDetailedModelJustification ?? ""}` : ""}.`));
    out.push(para(`Operating states: ${(system.applicablePlantOperatingStates ?? []).length === 0 ? "every operating state" : (system.applicablePlantOperatingStates ?? []).join(", ")}.`));
    if (variants.length > 0) {
      out.push(heading("Success criterion by operating state", HeadingLevel.HEADING_3));
      out.push(dataTable(["Operating state", "Condition", "Success criterion"], variants.map((criterion) => [criterion.plantOperatingStateId ?? "Any", criterion.scenarioCondition ?? "—", criterion.basis || "—"])));
    }
    out.push(heading("Model boundary", HeadingLevel.HEADING_3));
    if (system.boundaries.length === 0) out.push(para("No boundary recorded."));
    for (const item of system.boundaries) out.push(bullet(item));
    if ((system.diagrams ?? []).length > 0) {
      out.push(heading("Diagrams", HeadingLevel.HEADING_3));
      out.push(dataTable(["Diagram", "Source document", "Page"], (system.diagrams ?? []).map((diagram) => [diagram.title, diagram.filename, String(diagram.page)])));
    }
    if (alignments.length > 0) {
      out.push(heading("Alignments", HeadingLevel.HEADING_3));
      out.push(dataTable(["Alignment", "Normal", "Modeled", "Why not modeled"], alignments.map((alignment) => [alignment.name, alignment.isNormalAlignment ? "Yes" : "No", alignment.modeled ? "Yes" : "No", alignment.modeled ? "—" : alignment.justificationIfNotModeled ?? "—"])));
    }
    const operation: [string, string[] | undefined][] = [
      ["Operating procedures", system.operatingProcedures],
      ["Test and maintenance", system.testAndMaintenanceProcedures],
      ["Operating limits", system.operatingLimitations],
    ];
    for (const [title, items] of operation) {
      if (items === undefined || items.length === 0) continue;
      out.push(heading(title, HeadingLevel.HEADING_3));
      for (const item of items) out.push(bullet(item));
    }
    out.push(...failureModeContent(a, system, HeadingLevel.HEADING_3));
    out.push(...dependencyContent(a, system, HeadingLevel.HEADING_3));
    out.push(...integrityContent(a, system, HeadingLevel.HEADING_3, links));
    out.push(...systemUncertaintyContent(a, system.uuid, HeadingLevel.HEADING_3));
    if (limits.length > 0) {
      out.push(heading("Capacity limits", HeadingLevel.HEADING_3));
      out.push(dataTable(["Exceedance scenario", "Treatment", "Justification"], limits.map((item) => [item.potentialExceedanceScenarios.join("; ") || "—", item.treatment === "REALISTIC_JUSTIFIED" ? "Realistic" : "Conservative", item.justificationForCapability ?? "—"])));
    }
    if (a.plantStage === "PRE_OPERATIONAL" && assumptions.length > 0) {
      out.push(heading("Pre-operational assumptions", HeadingLevel.HEADING_3));
      out.push(dataTable(["Assumption", "Status", "Closure basis"], assumptions.map((item) => [item.description || "—", item.status, item.closureBasis || "—"])));
    }
  }
  return out;
}

function buildMethodology(a: SystemsAnalysis, final: boolean, summaries: UncertaintySummary[], links: ReportLinks, hours: ReadonlyMap<string, string>): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const stageLabel = a.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational";
  const ccLabel = a.capabilityCategory ?? "N/A";
  const doc = a.documentation;

  out.push(
    new Paragraph({ children: [new TextRun({ text: `${a.name} — Systems Analysis Methodology`, bold: true, size: 48 })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: `${stageLabel} PRA Model`, size: 28, color: "4C4452" })], spacing: { after: 120 } }),
    para(`Capability category target: ${ccLabel}. Scope: ${a.praScope}`),
    para(final ? "Status: final — all required items satisfied." : "Status: draft — open items flagged inline."),
  );

  out.push(heading("Executive summary", HeadingLevel.HEADING_1));
  out.push(para(`This document presents the preliminary Systems Analysis (SY) methodology for ${a.name}, prepared during the ${stageLabel.toLowerCase()} stage. ${a.systemDefinitions.length} systems, ${a.commonCauseFailureGroups.length} common cause groups and ${a.systemDependencies.length} support dependencies have been recorded against the ${ccLabel} capability target.`));

  out.push(...introSection(a, stageLabel));
  for (const l of a.metadata.limitations) out.push(bullet(l));

  out.push(heading("System breakdown structure & systems analysis", HeadingLevel.HEADING_1));
  out.push(heading("Selected systems", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["System", "Safety functions", "Model", "Mission time"],
    a.systemDefinitions.map((s) => [
      s.name,
      (a.systemToSafetyFunctionMappings.find((mapping) => mapping.systemReference === s.uuid)?.safetyFunctions ?? []).join(", ") || "—",
      modelLabel(a, s.uuid),
      hours.get(s.uuid) ?? "Not set",
    ]),
  ));
  out.push(heading("Grouping retained systems", HeadingLevel.HEADING_2));
  out.push(para(doc.modeledComponentsAndFailureModes));

  out.push(...systemDescriptions(a, links, hours));

  out.push(heading("Methodologies & guidelines", HeadingLevel.HEADING_1));
  out.push(heading("Constructing fault trees", HeadingLevel.HEADING_2));
  out.push(para(doc.successCriteriaRelationship));
  out.push(heading("Dependencies", HeadingLevel.HEADING_2));
  out.push(para(doc.dependencySearchAndTables));
  out.push(...dependencySummary(a));
  out.push(heading("Boundaries", HeadingLevel.HEADING_2));
  out.push(para(doc.systemFunctionsAndBoundaries));
  out.push(heading("Labeling scheme", HeadingLevel.HEADING_2));
  out.push(para(doc.nomenclatureConventions));
  out.push(namingTable(a, links));

  out.push(heading("Common cause failure groups", HeadingLevel.HEADING_1));
  out.push(commonCauseTable(a, a.commonCauseFailureGroups, links));

  out.push(heading("Uncertainty analysis", HeadingLevel.HEADING_1));
  out.push(para("Data Analysis owns parameter estimates and distributions. Systems Analysis links those inputs to basic events and records uncertainty in model assumptions."));
  out.push(...plantUncertaintyContent(a));
  out.push(heading("Current uncertainty results", HeadingLevel.HEADING_2));
  out.push(dataTable(["Fault tree", "Mean", "5%", "95%", "Samples"], summaries.length === 0 ? [["No current saved run", "—", "—", "—", "—"]] :
    summaries.map((item) => [a.systemLogicModels.find((model) => model.uuid === item.modelId)?.code ?? item.modelId,
      item.mean.toExponential(3), item.lower.toExponential(3), item.upper.toExponential(3), item.samples.toLocaleString()])));

  out.push(heading("Conformance summary", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["SR", "HLR", "Category", "Status", "Evidence"],
    a.conformanceMatrix.map((c) => [c.sr, c.hlr, c.capabilityCategory, c.status, c.evidence]),
  ));

  out.push(heading("References", HeadingLevel.HEADING_1));
  out.push(bullet("System design descriptions and P&IDs"));
  out.push(bullet("Failure mode and effects analyses"));
  out.push(bullet("Common cause parameter dossier (Data Analysis)"));
  out.push(bullet("Digital I&C reliability method (Part II Subpart 2.7)"));
  return out;
}

function buildSystemReport(a: SystemsAnalysis, systemId: string, final: boolean, summaries: UncertaintySummary[], links: ReportLinks, points: ReadonlyMap<string, string>): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const stageLabel = a.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational";
  const sysDef = a.systemDefinitions.find((s) => s.uuid === systemId) ?? a.systemDefinitions[0];
  const logic = a.systemLogicModels.find((m) => m.systemReference === sysDef.uuid);
  const logicBasicEvents = logic === undefined ? [] : analysisModelBasicEvents(a, logic);
  const ccfGroups = a.commonCauseFailureGroups.filter((g) => g.affectedSystems.includes(sysDef.uuid));

  out.push(
    new Paragraph({ children: [new TextRun({ text: `${a.name} — Preliminary Systems Analysis`, bold: true, size: 48 })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: sysDef.name, size: 28, color: "4C4452" })], spacing: { after: 120 } }),
    para(final ? "Status: final — all required items satisfied." : "Status: draft — open items flagged inline."),
  );

  out.push(heading("Executive summary", HeadingLevel.HEADING_1));
  out.push(para(`This report documents the system logic model for ${sysDef.name} during the ${stageLabel.toLowerCase()} stage, including its boundary, dependencies, common cause groups and modeled basic events.`));

  out.push(...introSection(a, stageLabel));

  out.push(heading("System description", HeadingLevel.HEADING_1));
  out.push(para(sysDef.description ?? sysDef.name));
  out.push(heading("System boundary", HeadingLevel.HEADING_2));
  for (const b of sysDef.boundaries) out.push(bullet(b));
  if ((sysDef.diagrams ?? []).length > 0) {
    out.push(heading("Diagrams", HeadingLevel.HEADING_2));
    out.push(dataTable(["Diagram", "Source document", "Page"], (sysDef.diagrams ?? []).map((diagram) => [diagram.title, diagram.filename, String(diagram.page)])));
  }
  out.push(heading("Dependencies", HeadingLevel.HEADING_2));
  out.push(...dependencyContent(a, sysDef, HeadingLevel.HEADING_3));

  out.push(heading("Model development", HeadingLevel.HEADING_1));
  out.push(heading("Modeling approach", HeadingLevel.HEADING_2));
  out.push(para(logic?.description ?? sysDef.description ?? sysDef.name));
  out.push(...failureModeContent(a, sysDef, HeadingLevel.HEADING_2));
  out.push(...integrityContent(a, sysDef, HeadingLevel.HEADING_2, links));
  out.push(heading("Common cause failures", HeadingLevel.HEADING_2));
  out.push(commonCauseTable(a, ccfGroups, links));
  out.push(heading("Basic event data", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["Basic event", "Failure mode", "Value", "Point value"],
    logicBasicEvents.length > 0
      ? logicBasicEvents.map((event) => eventValueRow(event, links, points))
      : [["None", "—", "—", "—"]],
  ));

  out.push(heading("Uncertainty analysis", HeadingLevel.HEADING_1));
  out.push(para("Parameter uncertainty distributions are maintained in Data Analysis and sampled through the linked basic events. Run results and source revisions are recorded in the workbook analysis history."));
  out.push(dataTable(["Basic event", "DA parameter", "Source workbook"],
    logicBasicEvents.flatMap((event) => (carriesUncertainExpression(event.failureMode) ? linkedOptions(event.expression, links.parameters) : []).map((option) => [
      event.code, option.parameterName, option.workbookName,
    ]))));
  out.push(...systemUncertaintyContent(a, sysDef.uuid, HeadingLevel.HEADING_2));
  if (a.plantStage === "PRE_OPERATIONAL") {
    out.push(heading("Pre-operational assumptions", HeadingLevel.HEADING_2));
    out.push(dataTable(["Assumption", "Status", "Closure basis"],
      (a.preOperationalAssumptions ?? []).filter((item) => item.affectedElementIds.includes(sysDef.uuid) || (item.affectedElementIds.length === 0 && sysDef.uuid === a.systemDefinitions[0]?.uuid))
        .map((item) => [item.description || "—", item.status, item.closureBasis || "—"])));
  }

  out.push(heading("Results", HeadingLevel.HEADING_1));
  out.push(para("The system fault tree is quantified standalone, with the full-plant quantification performed by Event Sequence Quantification."));
  const summary = logic === undefined ? undefined : summaries.find((item) => item.modelId === logic.uuid);
  if (summary !== undefined) out.push(para(`Current uncertainty run: mean top-event probability ${summary.mean.toExponential(3)}, 5% quantile ${summary.lower.toExponential(3)}, 95% quantile ${summary.upper.toExponential(3)}, ${summary.samples.toLocaleString()} samples.`));

  out.push(heading("References", HeadingLevel.HEADING_1));
  out.push(bullet("System design description and P&ID"));
  out.push(bullet("Failure mode and effects analysis"));
  out.push(bullet("Common cause parameter dossier (Data Analysis)"));
  return out;
}

async function generateSyReport(sy: SystemsAnalysis, report: ReportKind, systemId: string, final: boolean, workbookId: string | null = null, revision: number | null = null, links: ReportLinks = { parameters: [], boundaries: [], missionTimes: null }): Promise<void> {
  const summaries = await currentUncertaintySummaries(workbookId, revision);
  const reportedSystem = sy.systemDefinitions.find((system) => system.uuid === systemId) ?? sy.systemDefinitions[0];
  const logic = sy.systemLogicModels.find((model) => model.systemReference === reportedSystem?.uuid);
  const points = report === "methodology" || logic === undefined ? new Map<string, string>() : await eventPoints(analysisModelBasicEvents(sy, logic), links);
  const children = report === "methodology" ? buildMethodology(sy, final, summaries, links, await systemHours(sy.systemDefinitions, links)) : buildSystemReport(sy, systemId, final, summaries, links, points);
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const label = report === "methodology" ? "Methodology" : "Per-system";
  link.href = url;
  link.download = `${sy.name} — SY ${label}${final ? "" : " (draft)"}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { generateSyReport, type ReportKind };
