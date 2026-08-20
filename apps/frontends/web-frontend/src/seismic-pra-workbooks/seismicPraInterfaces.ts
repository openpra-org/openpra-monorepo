import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { seismicPraVariant, type SeismicPraLinkedInputs } from "./seismicPraWorkbookContext";

interface SeismicPraInterfaceRow {
  id: string;
  name: string;
  values: string[];
}

interface SeismicPraInterfaceLane {
  code: string;
  element: string;
  role: string;
  direction: "in" | "out";
  columns: string[];
  rows: SeismicPraInterfaceRow[];
  empty: string;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function label(value: string): string {
  const normalized = value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\bex control room\b/g, "ex-control-room");
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
    .replace(/\bssc\b/gi, "SSC")
    .replace(/\bhfe\b/gi, "HFE");
}

function list(values: string[]): string {
  const items = unique(values);
  return items.length === 0 ? "—" : items.join(" · ");
}

function scientific(value: number | undefined): string {
  return value === undefined ? "—" : value.toExponential(2).replace("e", "E");
}

function frequency(value: number | undefined): string {
  return value === undefined ? "—" : `${scientific(value)} /plant-yr`;
}

function percentage(value: number | undefined): string {
  return value === undefined ? "—" : `${(value * 100).toFixed(1)} %`;
}

function validateLanes(lanes: SeismicPraInterfaceLane[]): SeismicPraInterfaceLane[] {
  for (const lane of lanes) {
    for (const row of lane.rows) {
      if (row.values.length !== lane.columns.length - 1) {
        throw new Error(
          `Seismic PRA interface ${lane.code} row ${row.id} has ${String(row.values.length)} values for ${String(lane.columns.length)} columns`,
        );
      }
    }
  }
  return lanes;
}

function seismicPraInterfaceLanes(
  mef: SeismicPRA,
  linkedInputs: SeismicPraLinkedInputs | null,
): SeismicPraInterfaceLane[] {
  const spr = mef.seismicPlantResponseAnalysis;
  const sha = mef.seismicHazardAnalysis;
  const variant = seismicPraVariant(mef);
  const links = variant !== null && linkedInputs?.variant === variant ? linkedInputs : null;
  const posStates = links?.posStates ?? [];
  const totalPosHours = posStates.reduce((total, state) => total + state.durationHours, 0);
  const baseFloodModels = spr.plantResponseModel.baseNonSeismicHazardModelRefs.filter((ref) => ref.toUpperCase().includes("FLOOD"));
  const baseFireModels = spr.plantResponseModel.baseNonSeismicHazardModelRefs.filter((ref) => ref.toUpperCase().includes("FIRE"));
  const floodInputs = [
    ...unique(baseFloodModels).map((ref) => ({ id: `model-${ref}`, name: ref, type: "Base PRA model" })),
    ...unique(spr.seismicEquipmentListDevelopment.internalFloodSourceRefs).map((ref) => ({ id: `source-${ref}`, name: ref, type: "SEL flood source" })),
  ];
  const fireInputs = [
    ...unique(baseFireModels).map((ref) => ({ id: `model-${ref}`, name: ref, type: "Base PRA model" })),
    ...unique(spr.seismicEquipmentListDevelopment.internalFireIgnitionSourceRefs).map((ref) => ({ id: `source-${ref}`, name: ref, type: "SEL ignition source" })),
  ];
  const externalFloodHazards = sha.secondaryHazardEvaluation.hazards.filter(
    (hazard) =>
      hazard.screening.disposition === "RETAINED"
      && (hazard.hazardType === "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING"
        || hazard.externalFloodingInterface !== undefined),
  );
  const otherRetainedHazards = sha.secondaryHazardEvaluation.hazards.filter(
    (hazard) => hazard.screening.disposition === "RETAINED"
      && hazard.hazardType !== "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING",
  );

  return validateLanes([
    {
      code: "POS",
      element: "Plant Operating States",
      role: "Operating states & source scope",
      direction: "in",
      columns: ["Operating state", "Mode", "Time fraction", "Radioactive-material sources"],
      rows: posStates.map((state) => ({
        id: state.id,
        name: `${state.id} · ${state.name}`,
        values: [
          label(state.mode),
          totalPosHours > 0 ? `${((state.durationHours / totalPosHours) * 100).toFixed(1)} %` : "—",
          list(state.materialSources),
        ],
      })),
      empty: "No linked plant operating-state data are available.",
    },
    {
      code: "IE",
      element: "Initiating Event Analysis",
      role: "Initiator groups & frequencies",
      direction: "in",
      columns: ["Initiating-event group", "Mean frequency", "Applicable states", "Risk importance"],
      rows: (links?.ieGroups ?? []).map((group) => ({
        id: group.id,
        name: `${group.id} · ${group.name}`,
        values: [
          frequency(group.meanFrequency),
          list(group.applicableStates),
          label(group.riskImportance),
        ],
      })),
      empty: "No linked initiating-event groups are available.",
    },
    {
      code: "ES",
      element: "Event Sequence Analysis",
      role: "Event-sequence families",
      direction: "in",
      columns: ["Event-sequence family", "End state", "Member-sequence count"],
      rows: (links?.esFamilies ?? []).map((family) => ({
        id: family.id,
        name: `${family.id} · ${family.name}`,
        values: [label(family.endState), family.memberCount === undefined ? "—" : String(family.memberCount)],
      })),
      empty: "No linked event-sequence families are available.",
    },
    {
      code: "SC",
      element: "Success Criteria Development",
      role: "Mission times",
      direction: "in",
      columns: ["Mission-time record", "Event sequence", "Mission hours", "Risk significance"],
      rows: (links?.scMissionTimes ?? []).map((mission) => ({
        id: mission.id,
        name: mission.id,
        values: [
          mission.eventSequence,
          `${mission.hours} h`,
          mission.riskSignificant === undefined ? "—" : mission.riskSignificant ? "Yes" : "No",
        ],
      })),
      empty: "No linked success-criteria mission times are available.",
    },
    {
      code: "SY",
      element: "Systems Analysis",
      role: "System models",
      direction: "in",
      columns: ["System", "Mission hours", "Applicable states", "Basic-event count"],
      rows: (links?.sySystems ?? []).map((system) => ({
        id: system.id,
        name: `${system.id} · ${system.name}`,
        values: [
          system.missionTimeHours === undefined ? "—" : `${system.missionTimeHours} h`,
          list(system.applicableStates),
          system.basicEventCount === undefined ? "—" : String(system.basicEventCount),
        ],
      })),
      empty: "No linked systems-analysis models are available.",
    },
    {
      code: "HR",
      element: "Human Reliability Analysis",
      role: "Human failure events & HEPs",
      direction: "in",
      columns: ["Human failure event", "Timing", "Affected systems", "HEP"],
      rows: (links?.hrActions ?? []).map((action) => ({
        id: action.id,
        name: `${action.id} · ${action.name}`,
        values: [
          label(action.timing),
          list(action.affectedSystems),
          scientific(action.humanErrorProbability),
        ],
      })),
      empty: "No linked human failure events are available.",
    },
    {
      code: "DA",
      element: "Data Analysis",
      role: "Parameter estimates",
      direction: "in",
      columns: ["Parameter", "Basic event", "System", "Estimate with parameter type"],
      rows: (links?.daParameters ?? []).map((parameter) => ({
        id: parameter.id,
        name: `${parameter.id} · ${parameter.name}`,
        values: [
          parameter.basicEvent,
          parameter.system,
          `${scientific(parameter.value)} · ${label(parameter.parameterType).toLowerCase()}`,
        ],
      })),
      empty: "No linked data-analysis parameters are available.",
    },
    {
      code: "FL",
      element: "Internal Flood PRA",
      role: "Base flood model & SEL sources",
      direction: "in",
      columns: ["Stored internal-flood model/source", "Input type"],
      rows: floodInputs.map((input) => ({
        id: input.id,
        name: input.name,
        values: [input.type],
      })),
      empty: "No internal-flood model or SEL flood source is linked.",
    },
    {
      code: "F",
      element: "Internal Fire PRA",
      role: "Base fire model & SEL sources",
      direction: "in",
      columns: ["Stored internal-fire model/source", "Input type"],
      rows: fireInputs.map((input) => ({
        id: input.id,
        name: input.name,
        values: [input.type],
      })),
      empty: "No internal-fire model or SEL ignition source is linked.",
    },
    {
      code: "XF",
      element: "External Flooding PRA",
      role: "Earthquake-induced flooding",
      direction: "out",
      columns: ["Earthquake-induced flooding hazard", "Mechanism", "Hazard-result references", "Fragility-mechanism references"],
      rows: externalFloodHazards.map((hazard) => ({
        id: hazard.uuid,
        name: hazard.name,
        values: [
          hazard.externalFloodingInterface?.mechanismDescription ?? list(hazard.initiatingMechanisms),
          list(hazard.externalFloodingInterface?.hazardParameterResultsRefs ?? []),
          list(hazard.externalFloodingInterface?.fragilityFailureMechanismRefs ?? []),
        ],
      })),
      empty: "No earthquake-induced external-flood transfer is defined.",
    },
    {
      code: "O",
      element: "Other Hazards PRA",
      role: "Retained secondary hazards",
      direction: "out",
      columns: ["Retained secondary hazard", "Hazard parameter", "Affected SSCs", "Failure mechanisms"],
      rows: otherRetainedHazards.map((hazard) => ({
        id: hazard.uuid,
        name: hazard.name,
        values: [
          hazard.retainedAnalysis === undefined
            ? "—"
            : `${hazard.retainedAnalysis.hazardParameter} (${hazard.retainedAnalysis.parameterUnits})`,
          list(hazard.potentiallyAffectedSeismicEquipmentListItemRefs),
          list(hazard.retainedAnalysis?.failureMechanisms.map((mechanism) => mechanism.name) ?? []),
        ],
      })),
      empty: "No retained secondary-hazard transfer is defined.",
    },
    {
      code: "ESQ",
      element: "Event Sequence Quantification",
      role: "Seismic family frequencies",
      direction: "out",
      columns: ["Seismic event-sequence family", "Point estimate", "Mean frequency", "Release category"],
      rows: spr.quantification.eventSequenceFamilyQuantifications.map((result) => ({
        id: result.uuid,
        name: `${result.eventSequenceFamilyRef} · ${result.name}`,
        values: [
          frequency(result.pointEstimateFrequency),
          frequency(result.meanFrequency),
          result.releaseCategoryRef ?? "—",
        ],
      })),
      empty: "No seismic event-sequence-family frequencies are available.",
    },
    {
      code: "RI",
      element: "Risk Integration",
      role: "Risk-significant contributors",
      direction: "out",
      columns: ["Risk contributor", "Contributor type", "Contribution", "Importance"],
      rows: spr.quantification.riskSignificantContributors.map((contributor) => ({
        id: contributor.uuid,
        name: contributor.name,
        values: [
          label(contributor.contributorType),
          percentage(contributor.contributionValue),
          label(String(contributor.importance)),
        ],
      })),
      empty: "No seismic risk contributors are available.",
    },
  ]);
}

export { seismicPraInterfaceLanes };
export type { SeismicPraInterfaceLane, SeismicPraInterfaceRow };
