import type {
  ComponentBoundaryReview,
  ComponentBoundaryReviewStatus,
  ModelValidation,
  ModularizationRecord,
  NomenclatureDesignator,
  NomenclatureDesignatorKind,
  NomenclatureEventType,
  SystemBasicEvent,
  SystemConfirmationRecord,
  SystemLogicModel,
  SystemsAnalysis,
} from "interfaces-mef-types/sy/systems-analysis";
import { systemLogicModelBasicEvents } from "interfaces-mef-types/sy/system-models";
import type { SyControlledComponentBoundaryOption, SyControlledParameterOption } from "./syWorkbookContext";
import { linkedOptions } from "./syBasicEventValues";

type IntegrityAnalysis = Pick<SystemsAnalysis,
  | "plantStage"
  | "capabilityCategory"
  | "systemDefinitions"
  | "systemLogicModels"
  | "systemBasicEvents"
  | "systemConfirmationRecords"
  | "modelValidations"
  | "componentBoundaryReviews"
  | "modularizationRecords"
  | "nomenclatureDesignators">;

interface IntegrityIssue {
  code: string;
  severity: "ERROR" | "WARNING";
  message: string;
}

interface BoundaryRow {
  key: string;
  boundaryId?: string;
  boundary?: SyControlledComponentBoundaryOption;
  parameters: SyControlledParameterOption[];
  events: SystemBasicEvent[];
  review?: ComponentBoundaryReview;
  issues: IntegrityIssue[];
}

interface NamingRow {
  event: SystemBasicEvent;
  issues: IntegrityIssue[];
}

const BOUNDARY_STATUSES: readonly ComponentBoundaryReviewStatus[] = ["MATCHES", "ACCOUNTED", "OPEN", "NOT_VERIFIED"];

const BOUNDARY_STATUS_LABELS: Record<ComponentBoundaryReviewStatus, string> = {
  MATCHES: "Matches the data",
  ACCOUNTED: "Differs, accounted for",
  OPEN: "Differs, still open",
  NOT_VERIFIED: "Not verified against the data",
};

const BOUNDARY_NOTE_LABELS: Record<ComponentBoundaryReviewStatus, string> = {
  MATCHES: "Note",
  ACCOUNTED: "How the difference is accounted for",
  OPEN: "What differs",
  NOT_VERIFIED: "What cannot be verified",
};

const DESIGNATOR_KINDS: readonly NomenclatureDesignatorKind[] = ["SYSTEM", "FAILURE_MODE", "EVENT_TYPE"];

const DESIGNATOR_KIND_LABELS: Record<NomenclatureDesignatorKind, string> = {
  SYSTEM: "System code",
  FAILURE_MODE: "Failure mode designator",
  EVENT_TYPE: "Event type designator",
};

const EVENT_TYPES: readonly NomenclatureEventType[] = ["HUMAN_ERROR", "TEST_MAINTENANCE", "COMMON_CAUSE_FAILURE"];

const EVENT_TYPE_LABELS: Record<NomenclatureEventType, string> = {
  HUMAN_ERROR: "Human failure event",
  TEST_MAINTENANCE: "Test or maintenance outage",
  COMMON_CAUSE_FAILURE: "Common cause failure",
};

const DETAIL_SRS = new Set(["SY-A9", "SY-A10", "SY-A11"]);

function isEventType(value: string): value is NomenclatureEventType {
  return EVENT_TYPES.some((type) => type === value);
}

function isComponentEvent(event: Pick<SystemBasicEvent, "failureMode">): boolean {
  return !isEventType(event.failureMode ?? "");
}

function issue(code: string, severity: IntegrityIssue["severity"], message: string): IntegrityIssue {
  return { code, severity, message };
}

function blank(value: string | undefined): boolean {
  return (value ?? "").trim().length === 0;
}

function isSystemLevel(model: Pick<SystemLogicModel, "nonDetailedModelJustification">): boolean {
  return typeof model.nonDetailedModelJustification === "string";
}

function treeEvents(sy: Pick<SystemsAnalysis, "systemLogicModels" | "systemBasicEvents">, systemId: string): SystemBasicEvent[] {
  const model = sy.systemLogicModels.find((candidate) => candidate.systemReference === systemId);
  if (model === undefined || isSystemLevel(model)) return [];
  return systemLogicModelBasicEvents(sy, model);
}

function eventSystems(sy: Pick<SystemsAnalysis, "systemLogicModels">): Map<string, string[]> {
  const owners = new Map<string, string[]>();
  sy.systemLogicModels.forEach((model) => model.leafNodes.forEach((leaf) => {
    if (leaf.kind !== "BASIC_EVENT_REFERENCE") return;
    const current = owners.get(leaf.basicEventId) ?? [];
    if (!current.includes(model.systemReference)) owners.set(leaf.basicEventId, [...current, model.systemReference]);
  }));
  return owners;
}

function systemName(sy: Pick<SystemsAnalysis, "systemDefinitions">, systemId: string): string {
  return sy.systemDefinitions.find((system) => system.uuid === systemId)?.name ?? systemId;
}

function eventParameter(event: SystemBasicEvent, parameters: readonly SyControlledParameterOption[]): SyControlledParameterOption | undefined {
  return linkedOptions(event.expression, parameters)[0];
}

function reviewIssues(review: ComponentBoundaryReview | undefined, preOperational: boolean): IntegrityIssue[] {
  if (review === undefined) return [issue("BOUNDARY_UNREVIEWED", "WARNING", "Not reviewed against the data boundary yet.")];
  const missingNote = review.status !== "MATCHES" && blank(review.note);
  const issues: IntegrityIssue[] = [];
  if (review.status === "OPEN") issues.push(issue("BOUNDARY_OPEN", "WARNING", "Differs from the data and is still open."));
  if (review.status === "NOT_VERIFIED" && !preOperational) issues.push(issue("BOUNDARY_VERIFY", "WARNING", "Verify against plant data. The SY-A13 flag applies only before operation."));
  if (missingNote) issues.push(issue("BOUNDARY_NOTE", "ERROR", `${BOUNDARY_NOTE_LABELS[review.status]} is not recorded.`));
  return issues;
}

function boundaryRows(
  sy: IntegrityAnalysis,
  systemId: string,
  parameters: readonly SyControlledParameterOption[],
  boundaries: readonly SyControlledComponentBoundaryOption[],
): BoundaryRow[] {
  const preOperational = sy.plantStage !== "OPERATIONAL";
  const reviews = (sy.componentBoundaryReviews ?? []).filter((review) => review.systemReference === systemId);
  if (parameters.length === 0) {
    return reviews.map((review) => ({ key: `review:${review.uuid}`, boundaryId: review.componentBoundaryRef, parameters: [], events: [], review, issues: reviewIssues(review, preOperational) }));
  }
  const rows = new Map<string, BoundaryRow>();
  const unlinked: SystemBasicEvent[] = [];
  treeEvents(sy, systemId).filter(isComponentEvent).forEach((event) => {
    const parameter = eventParameter(event, parameters);
    if (parameter === undefined) {
      unlinked.push(event);
      return;
    }
    const boundary = parameter.componentBoundaryId === undefined
      ? undefined
      : boundaries.find((candidate) => candidate.workbookId === parameter.workbookId && candidate.boundaryId === parameter.componentBoundaryId);
    const key = boundary === undefined ? `parameter:${parameter.workbookId}:${parameter.parameterId}` : `boundary:${boundary.workbookId}:${boundary.boundaryId}`;
    const row = rows.get(key) ?? { key, boundaryId: boundary?.boundaryId, boundary, parameters: [], events: [], issues: [] };
    const known = row.parameters.some((candidate) => candidate.workbookId === parameter.workbookId && candidate.parameterId === parameter.parameterId);
    rows.set(key, { ...row, parameters: known ? row.parameters : [...row.parameters, parameter], events: [...row.events, event] });
  });
  const linked = [...rows.values()].map((row): BoundaryRow => {
    if (row.boundary === undefined) {
      return { ...row, issues: [issue("BOUNDARY_NONE", "WARNING", `DA has no component boundary for ${row.parameters[0]?.parameterName ?? "this estimate"}.`)] };
    }
    const boundaryId = row.boundary.boundaryId;
    const review = reviews.find((candidate) => candidate.componentBoundaryRef === boundaryId);
    return { ...row, review, issues: reviewIssues(review, preOperational) };
  });
  const used = new Set(linked.flatMap((row) => (row.boundaryId === undefined ? [] : [row.boundaryId])));
  const orphans = reviews.filter((review) => !used.has(review.componentBoundaryRef)).map((review): BoundaryRow => ({
    key: `review:${review.uuid}`,
    boundaryId: review.componentBoundaryRef,
    boundary: boundaries.find((candidate) => candidate.boundaryId === review.componentBoundaryRef),
    parameters: [],
    events: [],
    review,
    issues: [issue("BOUNDARY_UNUSED", "WARNING", "No event in this fault tree uses this boundary any more.")],
  }));
  const missing = unlinked.length === 0 ? [] : [{
    key: "unlinked",
    parameters: [],
    events: unlinked,
    issues: [issue("BOUNDARY_NO_ESTIMATE", "WARNING", "No DA estimate is linked, so the boundary cannot be checked. Link one in Step 02.")],
  }];
  return [...linked, ...orphans, ...missing];
}

function segments(code: string): string[] {
  return code.split("-").filter((part) => part.length > 0);
}

function designatorsOf(sy: Pick<SystemsAnalysis, "nomenclatureDesignators">, kind: NomenclatureDesignatorKind): NomenclatureDesignator[] {
  return (sy.nomenclatureDesignators ?? []).filter((designator) => designator.kind === kind && !blank(designator.designator));
}

function eventNamingIssues(
  sy: IntegrityAnalysis,
  event: SystemBasicEvent,
  parameters: readonly SyControlledParameterOption[],
  owners: ReadonlyMap<string, readonly string[]>,
): IntegrityIssue[] {
  const code = event.code.trim();
  if (code.length === 0) return [issue("NAME_EMPTY", "ERROR", "The event has no code.")];
  const parts = segments(code);
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  const issues: IntegrityIssue[] = [];
  const systems = owners.get(event.uuid) ?? [];
  const systemCodes = designatorsOf(sy, "SYSTEM").filter((designator) => designator.systemReference !== undefined && systems.includes(designator.systemReference));
  if (systemCodes.length > 0 && !systemCodes.some((designator) => designator.designator === first)) {
    issues.push(issue("NAME_SYSTEM", "ERROR", `Starts with ${first}, not the system code ${systemCodes.map((designator) => designator.designator).join(" or ")}.`));
  }
  const mode = event.failureMode ?? "";
  if (isEventType(mode)) {
    const typeCodes = designatorsOf(sy, "EVENT_TYPE").filter((designator) => designator.eventType === mode).map((designator) => designator.designator);
    const carries = mode === "TEST_MAINTENANCE" ? typeCodes.includes(last) : parts.some((part) => typeCodes.includes(part));
    if (typeCodes.length > 0 && !carries) {
      issues.push(issue("NAME_TYPE", "ERROR", mode === "TEST_MAINTENANCE" ? `Should end in ${typeCodes.join(" or ")}.` : `Should carry ${typeCodes.join(" or ")}.`));
    }
  } else {
    const failureCodes = designatorsOf(sy, "FAILURE_MODE");
    const match = failureCodes.find((designator) => designator.designator === last);
    if (failureCodes.length > 0 && match === undefined) issues.push(issue("NAME_MODE", "ERROR", `${last} is not a failure mode designator.`));
    const parameter = eventParameter(event, parameters);
    const refs = match?.failureModeRefs ?? [];
    if (match !== undefined && parameter?.failureModeId !== undefined && refs.length > 0 && !refs.includes(parameter.failureModeId)) {
      issues.push(issue("NAME_DATA", "ERROR", `${last} means ${match.meaning.toLowerCase()}, but its DA estimate is ${(parameter.failureModeName ?? parameter.failureModeId).toLowerCase()}.`));
    }
    if (parts.length < 3) issues.push(issue("NAME_SHAPE", "WARNING", "Should read system, component and failure mode."));
  }
  const twin = sy.systemBasicEvents.find((other) => other.uuid !== event.uuid && other.code.trim() === code);
  if (twin !== undefined) issues.push(issue("NAME_DUPLICATE", "ERROR", `Same code as ${twin.name}.`));
  return issues;
}

function namingRows(sy: IntegrityAnalysis, systemId: string, parameters: readonly SyControlledParameterOption[]): NamingRow[] {
  const owners = eventSystems(sy);
  return treeEvents(sy, systemId).map((event) => ({ event, issues: eventNamingIssues(sy, event, parameters, owners) }));
}

function systemCodeIssue(sy: IntegrityAnalysis, systemId: string): IntegrityIssue | null {
  if (treeEvents(sy, systemId).length === 0) return null;
  const codes = designatorsOf(sy, "SYSTEM").filter((designator) => designator.systemReference === systemId);
  return codes.length === 0 ? issue("NAME_NO_SYSTEM_CODE", "WARNING", "No code for this system in the naming scheme.") : null;
}

function designatorIssues(sy: IntegrityAnalysis, designator: NomenclatureDesignator, failureModeNames: ReadonlyMap<string, string>): IntegrityIssue[] {
  const all = sy.nomenclatureDesignators ?? [];
  const text = designator.designator.trim();
  const others = all.filter((candidate) => candidate.uuid !== designator.uuid && candidate.kind === designator.kind);
  const issues: IntegrityIssue[] = [];
  if (text.length === 0) issues.push(issue("DESIGNATOR_EMPTY", "ERROR", "The designator is empty."));
  if (text.includes("-")) issues.push(issue("DESIGNATOR_HYPHEN", "ERROR", "A designator cannot hold a hyphen, which separates the parts of a code."));
  if (text.length > 0 && others.some((candidate) => candidate.designator.trim() === text)) issues.push(issue("DESIGNATOR_TWICE", "ERROR", "Listed twice."));
  if (designator.kind === "SYSTEM") {
    const systemId = designator.systemReference;
    if (systemId === undefined) issues.push(issue("DESIGNATOR_SYSTEM", "ERROR", "Pick the system."));
    const twin = systemId === undefined ? undefined : others.find((candidate) => candidate.systemReference === systemId);
    if (systemId !== undefined && twin !== undefined) issues.push(issue("DESIGNATOR_SYSTEM_TWICE", "ERROR", `${systemName(sy, systemId)} also has the code ${twin.designator}.`));
    return issues;
  }
  if (blank(designator.meaning)) issues.push(issue("DESIGNATOR_MEANING", "WARNING", "Meaning not recorded."));
  if (designator.kind === "EVENT_TYPE") {
    const type = designator.eventType;
    if (type === undefined) issues.push(issue("DESIGNATOR_TYPE", "ERROR", "Pick the event type."));
    const twin = type === undefined ? undefined : others.find((candidate) => candidate.eventType === type);
    if (type !== undefined && twin !== undefined) issues.push(issue("DESIGNATOR_TYPE_TWICE", "ERROR", `${EVENT_TYPE_LABELS[type]} also has ${twin.designator}.`));
    return issues;
  }
  const refs = designator.failureModeRefs ?? [];
  if (refs.length === 0) issues.push(issue("DESIGNATOR_MODES", "WARNING", "Pick the DA failure modes it stands for."));
  refs.forEach((ref) => {
    const twin = others.find((candidate) => (candidate.failureModeRefs ?? []).includes(ref));
    if (twin !== undefined) issues.push(issue("DESIGNATOR_MODE_TWICE", "ERROR", `${failureModeNames.get(ref) ?? ref} also carries ${twin.designator}. One failure mode takes one designator.`));
  });
  return issues;
}

function schemeIssues(sy: IntegrityAnalysis): IntegrityIssue[] {
  const events = sy.systemLogicModels.flatMap((model) => (isSystemLevel(model) ? [] : systemLogicModelBasicEvents(sy, model)));
  const issues: IntegrityIssue[] = [];
  if (events.some(isComponentEvent) && designatorsOf(sy, "FAILURE_MODE").length === 0) issues.push(issue("SCHEME_MODES", "WARNING", "No failure mode designators yet."));
  EVENT_TYPES.forEach((type) => {
    const used = events.some((event) => event.failureMode === type);
    const listed = designatorsOf(sy, "EVENT_TYPE").some((designator) => designator.eventType === type);
    if (used && !listed) issues.push(issue(`SCHEME_${type}`, "WARNING", `No designator for ${EVENT_TYPE_LABELS[type].toLowerCase()}s.`));
  });
  return issues;
}

function moduleIssues(sy: IntegrityAnalysis, record: ModularizationRecord): IntegrityIssue[] {
  const owners = eventSystems(sy);
  const issues: IntegrityIssue[] = [];
  if (!record.avoidsMixedRecoveryPotential) issues.push(issue("MODULE_RECOVERY", "ERROR", "Its components have different recovery potential (SY-A14)."));
  if (!record.avoidsEventsRequiredByOtherSystems) issues.push(issue("MODULE_SHARED", "ERROR", "It holds events another system needs (SY-A14)."));
  (record.basicEventIds ?? []).forEach((eventId) => {
    const event = sy.systemBasicEvents.find((candidate) => candidate.uuid === eventId);
    if (event === undefined) {
      issues.push(issue("MODULE_EVENT_GONE", "WARNING", "An event it names is no longer in the model."));
      return;
    }
    (owners.get(eventId) ?? []).filter((systemId) => systemId !== record.systemReference).forEach((systemId) => {
      issues.push(issue("MODULE_EVENT_SHARED", "ERROR", `${event.code} is also in the ${systemName(sy, systemId)} fault tree.`));
    });
  });
  if (record.representedComponentIds.length < 2) issues.push(issue("MODULE_COMPONENTS", "WARNING", "A supercomponent stands for two or more components."));
  if ((record.basicEventIds ?? []).length === 0) issues.push(issue("MODULE_EVENTS", "WARNING", "Pick the events that stand for it."));
  if (blank(record.justification)) issues.push(issue("MODULE_BASIS", "ERROR", "Basis not recorded."));
  return issues;
}

function confirmationRecords(sy: Pick<SystemsAnalysis, "systemConfirmationRecords">, systemId: string): SystemConfirmationRecord[] {
  return (sy.systemConfirmationRecords ?? []).filter((record) => record.systemReference === systemId);
}

function confirmationIssues(sy: IntegrityAnalysis, systemId: string): IntegrityIssue[] {
  const records = confirmationRecords(sy, systemId);
  if (records.length === 0) return [issue("CONFIRM_NONE", "WARNING", "Not confirmed against the plant yet.")];
  if (sy.plantStage !== "OPERATIONAL") return [];
  const issues: IntegrityIssue[] = [];
  if (records.every((record) => record.method === "DESIGN_REVIEW")) issues.push(issue("CONFIRM_STAFF", "WARNING", "An operating plant needs discussions with plant staff, not only a design review (SY-A5)."));
  if (sy.capabilityCategory !== "CC-I" && !records.some((record) => record.method === "WALKDOWN" || record.method === "PLANT_INVESTIGATION")) {
    issues.push(issue("CONFIRM_WALKDOWN", "WARNING", "CC-II needs a walkdown or plant investigation (SY-A5)."));
  }
  return issues;
}

function recordIssues(record: SystemConfirmationRecord): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  if (record.personnelRoles.length === 0) issues.push(issue("CONFIRM_ROLES", "WARNING", "Who took part is not recorded."));
  if (blank(record.findings)) issues.push(issue("CONFIRM_FINDINGS", "WARNING", "Findings not recorded."));
  if (blank(record.date)) issues.push(issue("CONFIRM_DATE", "WARNING", "Date not recorded."));
  return issues;
}

function detailRecords(sy: Pick<SystemsAnalysis, "modelValidations">, systemId: string): ModelValidation[] {
  return (sy.modelValidations ?? []).filter((record) => record.systemReference === systemId && record.implementsSrs.some((reference) => DETAIL_SRS.has(reference.sr)));
}

function detailIssues(record: ModelValidation): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  if (blank(record.description)) issues.push(issue("DETAIL_WHAT", "ERROR", "Say what the model includes."));
  if (record.techniques.length === 0) issues.push(issue("DETAIL_CHECKS", "WARNING", "Say what the detail was checked against."));
  if (blank(record.results)) issues.push(issue("DETAIL_FINDING", "WARNING", "Finding not recorded."));
  (record.issuesIdentified ?? []).forEach((item) => issues.push(issue("DETAIL_OPEN", "WARNING", `Open: ${item}`)));
  return issues;
}

function integrityErrors(sy: IntegrityAnalysis): IntegrityIssue[] {
  const systems = sy.systemDefinitions.map((system) => system.uuid);
  const owners = eventSystems(sy);
  const failureModeNames = new Map<string, string>();
  return [
    ...systems.flatMap((systemId) => [
      ...(confirmationRecords(sy, systemId).length === 0 ? [issue("CONFIRM_NONE", "ERROR", `${systemName(sy, systemId)} is not confirmed against the plant.`)] : []),
      ...(detailRecords(sy, systemId).length === 0 ? [issue("DETAIL_NONE", "ERROR", `${systemName(sy, systemId)} has no level of detail record.`)] : []),
      ...treeEvents(sy, systemId).flatMap((event) => eventNamingIssues(sy, event, [], owners)),
    ]),
    ...(sy.nomenclatureDesignators ?? []).flatMap((designator) => designatorIssues(sy, designator, failureModeNames)),
    ...(sy.modularizationRecords ?? []).flatMap((record) => moduleIssues(sy, record)),
    ...(sy.componentBoundaryReviews ?? []).flatMap((review) => reviewIssues(review, sy.plantStage !== "OPERATIONAL")),
    ...(sy.modelValidations ?? []).flatMap(detailIssues),
  ].filter((item) => item.severity === "ERROR");
}

function newBoundaryReview(systemId: string, boundaryId: string, uuid: string): ComponentBoundaryReview {
  return { uuid, systemReference: systemId, componentBoundaryRef: boundaryId, status: "MATCHES", implementsSrs: [{ sr: "SY-A12", hlr: "A" }] };
}

export {
  BOUNDARY_NOTE_LABELS,
  BOUNDARY_STATUSES,
  BOUNDARY_STATUS_LABELS,
  DESIGNATOR_KINDS,
  DESIGNATOR_KIND_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  boundaryRows,
  confirmationIssues,
  confirmationRecords,
  designatorIssues,
  detailIssues,
  detailRecords,
  eventParameter,
  integrityErrors,
  isComponentEvent,
  moduleIssues,
  namingRows,
  newBoundaryReview,
  recordIssues,
  reviewIssues,
  schemeIssues,
  systemCodeIssue,
  treeEvents,
  type BoundaryRow,
  type IntegrityAnalysis,
  type IntegrityIssue,
  type NamingRow,
};
