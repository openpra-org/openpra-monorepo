import type { DepletionModel, SupportKind, SystemDependency, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { SyLinkedInputs } from "./syWorkbookContext";

type DependencyTreatment = NonNullable<SystemDependency["modeledIn"]>;

type DependencyAnalysis = Pick<SystemsAnalysis, "systemDefinitions" | "systemLogicModels" | "systemDependencies" | "supportSystemSuccessCriteria">;

interface SupportTransfer {
  dependentSystem: string;
  supportingSystem: string;
  leafId: string;
  name: string;
}

interface DependencyLink {
  dependentSystem: string;
  supportingSystem: string;
  transfers: SupportTransfer[];
  records: SystemDependency[];
  scNature?: string;
}

interface DependencyIssue {
  code: string;
  severity: "ERROR" | "WARNING";
  message: string;
}

const SUPPORT_KINDS: readonly SupportKind[] = ["ACTUATION", "CONTROL", "MOTIVE_POWER", "COOLING", "OPERATOR_INTERFACE", "OTHER"];

const SUPPORT_KIND_LABELS: Record<SupportKind, string> = {
  ACTUATION: "Actuation signal",
  CONTROL: "Control power",
  MOTIVE_POWER: "Motive power",
  COOLING: "Cooling",
  OPERATOR_INTERFACE: "Operator interface",
  OTHER: "Other support",
};

const DEPENDENCY_TREATMENTS: readonly DependencyTreatment[] = ["SYSTEM_MODEL", "EVENT_SEQUENCE", "EXCLUDED"];

const DEPENDENCY_TREATMENT_LABELS: Record<DependencyTreatment, string> = {
  SYSTEM_MODEL: "Transfer in the fault tree",
  EVENT_SEQUENCE: "In the sequence model",
  EXCLUDED: "Left out",
};

function isSupportKind(value: string): value is SupportKind {
  return SUPPORT_KINDS.some((kind) => kind === value);
}

function linkKey(dependentSystem: string, supportingSystem: string): string {
  return JSON.stringify([dependentSystem, supportingSystem]);
}

function supportTransfers(sy: Pick<SystemsAnalysis, "systemLogicModels">): SupportTransfer[] {
  const systemOfModel = new Map(sy.systemLogicModels.map((model) => [model.uuid, model.systemReference]));
  return sy.systemLogicModels.flatMap((model) => model.leafNodes.flatMap((leaf): SupportTransfer[] => {
    if (leaf.kind !== "TRANSFER_REFERENCE") return [];
    const supportingSystem = systemOfModel.get(leaf.target.modelId);
    if (supportingSystem === undefined || supportingSystem === model.systemReference) return [];
    return [{ dependentSystem: model.systemReference, supportingSystem, leafId: leaf.id, name: leaf.name }];
  }));
}

function dependencyLinks(sy: DependencyAnalysis, links: SyLinkedInputs | null): DependencyLink[] {
  const inScope = new Set(sy.systemDefinitions.map((system) => system.uuid));
  const byKey = new Map<string, DependencyLink>();
  const ensure = (dependentSystem: string, supportingSystem: string): DependencyLink => {
    const key = linkKey(dependentSystem, supportingSystem);
    const existing = byKey.get(key);
    if (existing !== undefined) return existing;
    const created: DependencyLink = { dependentSystem, supportingSystem, transfers: [], records: [] };
    byKey.set(key, created);
    return created;
  };
  supportTransfers(sy).forEach((transfer) => ensure(transfer.dependentSystem, transfer.supportingSystem).transfers.push(transfer));
  sy.systemDependencies.forEach((record) => ensure(record.dependentSystem, record.supportingSystem).records.push(record));
  (links?.scSystems ?? []).forEach((criterion) => criterion.supports.forEach((support) => {
    if (!inScope.has(criterion.systemId) || !inScope.has(support.systemId) || criterion.systemId === support.systemId) return;
    const link = ensure(criterion.systemId, support.systemId);
    if (link.scNature === undefined) link.scNature = support.nature;
  }));
  return [...byKey.values()];
}

function treatmentOf(record: SystemDependency, link: DependencyLink): DependencyTreatment | undefined {
  return record.modeledIn ?? (link.transfers.length > 0 ? "SYSTEM_MODEL" : undefined);
}

function linkIsCredited(link: DependencyLink): boolean {
  if (link.records.length === 0) return link.transfers.length > 0;
  return link.records.some((record) => treatmentOf(record, link) !== "EXCLUDED");
}

function linkDescription(link: DependencyLink, record: SystemDependency | undefined): string | undefined {
  const typed = record?.details;
  if (typed !== undefined && typed.trim().length > 0) return typed;
  return link.scNature ?? link.transfers[0]?.name;
}

function systemName(sy: Pick<SystemsAnalysis, "systemDefinitions">, id: string): string {
  const system = sy.systemDefinitions.find((candidate) => candidate.uuid === id);
  return system?.abbreviation ?? system?.name ?? id;
}

function linkIssues(link: DependencyLink, record: SystemDependency | undefined, sy: DependencyAnalysis, allLinks: readonly DependencyLink[]): DependencyIssue[] {
  const issues: DependencyIssue[] = [];
  const support = systemName(sy, link.supportingSystem);
  const dependent = systemName(sy, link.dependentSystem);
  const hasTransfer = link.transfers.length > 0;
  if (record === undefined) {
    if (hasTransfer) {
      issues.push({ code: "DEP_UNRECORDED", severity: "WARNING", message: `The fault tree transfers to ${support}, but the kind of support is not recorded.` });
    } else if (link.scNature !== undefined) {
      issues.push({ code: "DEP_SC_ONLY", severity: "WARNING", message: "Success Criteria lists this support, but the model does not carry it." });
    }
  } else {
    const treatment = treatmentOf(record, link);
    if (record.supportingSystem === record.dependentSystem) {
      issues.push({ code: "DEP_SELF", severity: "ERROR", message: "A system cannot support itself." });
    }
    if (!sy.systemDefinitions.some((system) => system.uuid === record.supportingSystem)) {
      issues.push({ code: "DEP_SUPPORT", severity: "ERROR", message: "Select the support system." });
    }
    if (treatment === undefined) {
      issues.push({ code: "DEP_TREATMENT", severity: "WARNING", message: "Record where the model carries this support." });
    } else if (treatment === "SYSTEM_MODEL" && !hasTransfer) {
      issues.push({ code: "DEP_NO_TRANSFER", severity: "ERROR", message: `The fault tree has no transfer to ${support}. Add it in Step 02, or change the treatment.` });
    } else if (treatment !== "SYSTEM_MODEL" && hasTransfer) {
      issues.push({ code: "DEP_TRANSFER_LEFT", severity: "ERROR", message: `The fault tree still transfers to ${support}. Remove the transfer in Step 02, or carry it in this fault tree.` });
    }
    if (treatment === "EXCLUDED" && (record.exclusionJustification ?? "").trim().length === 0) {
      issues.push({ code: "DEP_REASON", severity: "ERROR", message: "Reason required." });
    }
    if (record.supportKind === undefined) {
      issues.push({ code: "DEP_KIND", severity: "WARNING", message: "Record the kind of support." });
    }
  }
  const reverse = allLinks.find((candidate) => candidate.dependentSystem === link.supportingSystem && candidate.supportingSystem === link.dependentSystem);
  if (hasTransfer && reverse !== undefined && reverse.transfers.length > 0) {
    issues.push({ code: "DEP_LOOP", severity: "ERROR", message: `${support} also transfers back into ${dependent}. Leave one direction out with a reason to break the loop.` });
  }
  return issues;
}

function coverageIssue(link: DependencyLink, sy: DependencyAnalysis): DependencyIssue | null {
  if (!linkIsCredited(link)) return null;
  const covered = (sy.supportSystemSuccessCriteria ?? []).some((criterion) =>
    criterion.systemReference === link.supportingSystem && criterion.supportedSystems.includes(link.dependentSystem));
  return covered ? null : {
    code: "DEP_CRITERION",
    severity: "WARNING",
    message: `No success criterion of ${systemName(sy, link.supportingSystem)} covers ${systemName(sy, link.dependentSystem)}.`,
  };
}

function dependencyErrors(sy: DependencyAnalysis, links: SyLinkedInputs | null): DependencyIssue[] {
  const all = dependencyLinks(sy, links);
  return all.flatMap((link) => {
    const rows: (SystemDependency | undefined)[] = link.records.length === 0 ? [undefined] : link.records;
    return rows.flatMap((record) => linkIssues(link, record, sy, all));
  }).filter((issue) => issue.severity === "ERROR");
}

function inventoryHours(item: Pick<DepletionModel, "initialQuantity" | "consumptionRate" | "units">): number | null {
  if (!Number.isFinite(item.initialQuantity) || item.initialQuantity <= 0) return null;
  if (item.units === "hours") return item.initialQuantity;
  return Number.isFinite(item.consumptionRate) && item.consumptionRate > 0 ? item.initialQuantity / item.consumptionRate : null;
}

function newDependency(link: Pick<DependencyLink, "dependentSystem" | "supportingSystem" | "transfers" | "scNature">, uuid: string): SystemDependency {
  const details = link.scNature ?? link.transfers[0]?.name;
  return {
    uuid,
    dependentSystem: link.dependentSystem,
    supportingSystem: link.supportingSystem,
    type: "FUNCTIONAL",
    ...(details === undefined ? {} : { details }),
    ...(link.transfers.length > 0 ? { modeledIn: "SYSTEM_MODEL" as const } : {}),
    implementsSrs: [{ sr: "SY-B5", hlr: "B" }],
  };
}

export {
  DEPENDENCY_TREATMENTS,
  DEPENDENCY_TREATMENT_LABELS,
  SUPPORT_KINDS,
  SUPPORT_KIND_LABELS,
  coverageIssue,
  dependencyErrors,
  dependencyLinks,
  inventoryHours,
  isSupportKind,
  linkDescription,
  linkIsCredited,
  linkIssues,
  linkKey,
  newDependency,
  supportTransfers,
  systemName,
  treatmentOf,
  type DependencyAnalysis,
  type DependencyIssue,
  type DependencyLink,
  type DependencyTreatment,
  type SupportTransfer,
};
