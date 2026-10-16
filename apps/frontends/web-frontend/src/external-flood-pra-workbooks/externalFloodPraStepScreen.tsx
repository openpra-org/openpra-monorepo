import {
  type ExternalFloodAnalysisRecord,
  type ExternalFloodPRA,
  type ExternalFloodPraApplication,
  type ExternalFloodRecordStatus,
} from "interfaces-mef-types/external-flood/external-flood-pra";
import { synchronizeExternalFloodPraDerivedRegisters } from "interfaces-mef-types/external-flood/external-flood-pra-validation";
import { ExternalFloodPRASchema } from "interfaces-mef-types/zod/external-flood/external-flood-pra";
import { type JSX, useState } from "react";
import { type z } from "zod";
import { POSIcon } from "../pos-workbooks/posIcons";
import { removeStructuredRecord, StructuredEditorDrawer, type EditorPath } from "../seismic-pra-workbooks/seismicPraStructuredEditor";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { HazardEventTreeEditor, HazardFaultTreeEditor } from "../workbooks/hazardConditionedModelEditors";
import { Drawer, Field, NumberInput, Section, SelectInput, TextArea, TextInput } from "./externalFloodPraFields";
import { useExternalFloodPraWorkbook } from "./externalFloodPraWorkbookContext";
import "../seismic-pra-workbooks/css/seismicPra.css";

type SemanticRecord = ExternalFloodAnalysisRecord & Record<string, unknown>;
interface RecordSection { title: string; path: EditorPath; singular: string; empty: string; columns: Array<{ label: string; key: string }> }
interface StepConfig { root: string; sections: RecordSection[] }
interface EditorTarget { title: string; focus: EditorPath; createAt?: EditorPath; removeLabel?: string; visibleRootFields?: string[] }

const HIDDEN_FIELDS = ["uuid", "implementsSrs", "standardRequirementRefs", "transferBasis", "stoppingBasis"];

function display(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (value.every((item) => item !== null && typeof item === "object")) {
      const points = value as Array<Record<string, unknown>>;
      const speeds = points.map((item) => item["windSpeed"]).filter((item): item is number => typeof item === "number");
      return speeds.length === points.length ? `${String(points.length)} points · ${display(Math.min(...speeds))}–${display(Math.max(...speeds))}` : `${String(points.length)} structured entries`;
    }
    return value.map(String).join(" · ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value !== 0 && (Math.abs(value) < 0.001 || Math.abs(value) >= 1_000_000) ? value.toExponential(2).replace("e", "E") : value.toLocaleString(undefined, { maximumSignificantDigits: 5 });
  if (value !== null && typeof value === "object") return Object.values(value as Record<string, unknown>).map(display).join(" · ");
  const text = String(value ?? "");
  return text.trim().length === 0 ? "—" : text.replace(/_/g, " ");
}

function valueAt(root: unknown, path: EditorPath): unknown {
  let current = root;
  for (const segment of path) current = (current as Record<string | number, unknown> | undefined)?.[segment];
  return current;
}

function statusTone(status: ExternalFloodRecordStatus): string {
  if (status === "DRAFT" || status === "OPEN") return "fltag--warn";
  if (status === "SCREENED") return "fltag--neutral";
  return "fltag--good";
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={onClick}><POSIcon.Plus /> {label}</button>;
}

function EditButton({ label = "Edit", onClick }: { label?: string; onClick: () => void }): JSX.Element {
  return <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={onClick}><POSIcon.Pencil /> {label}</button>;
}

function AnalysisRow({ label, value }: { label: string; value: unknown }): JSX.Element {
  return <div className="sanalysisbasis__row"><span>{label}</span><strong title={display(value)}>{display(value)}</strong></div>;
}

function collectionTarget(section: RecordSection, index?: number): EditorTarget {
  return index === undefined
    ? { title: `Add ${section.singular}`, focus: [], createAt: section.path }
    : { title: `Edit ${section.singular}`, focus: [...section.path, index], removeLabel: `Remove ${section.singular}` };
}

function Editor({ target, onClose }: { target: EditorTarget | null; onClose: () => void }): JSX.Element | null {
  const { mef, editable, mutate } = useExternalFloodPraWorkbook();
  if (target === null) return null;
  return <StructuredEditorDrawer
    eyebrow="External Flood PRA · Flat record editor"
    title={target.title}
    schema={ExternalFloodPRASchema}
    value={mef as unknown as z.output<typeof ExternalFloodPRASchema>}
    editable={editable}
    initialFocus={target.focus}
    createAt={target.createAt}
    hiddenRootFields={HIDDEN_FIELDS}
    visibleRootFields={target.visibleRootFields}
    inlinePrimitiveArrays
    onClose={onClose}
    onApply={(value) => mutate(() => synchronizeExternalFloodPraDerivedRegisters(value as unknown as ExternalFloodPRA))}
    onRemove={target.removeLabel === undefined ? undefined : () => mutate((current) => synchronizeExternalFloodPraDerivedRegisters(removeStructuredRecord(current, target.focus) as ExternalFloodPRA))}
    removeLabel={target.removeLabel}
  />;
}

function RecordTable({ records, section, onEdit }: { records: SemanticRecord[]; section: RecordSection; onEdit: (index: number) => void }): JSX.Element {
  if (records.length === 0) return <div className="flempty"><strong>{section.empty}</strong><p>Add a complete structured record with the section action.</p></div>;
  return <div className="fltablewrap"><table className="fltable" aria-label={section.title}><thead><tr><th>Record</th>{section.columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>Status</th><th><span className="sr-only">Edit</span></th></tr></thead><tbody>{records.map((record, index) => <tr key={record.uuid}><td><button type="button" className="fltable__record" onClick={() => onEdit(index)}><strong>{record.name}</strong><code>{record.code}</code></button></td>{section.columns.map((column) => <td key={`${record.uuid}-${column.key}`}>{display(record[column.key])}</td>)}<td><span className={`fltag ${statusTone(record.status)}`}>{record.status.replace(/_/g, " ")}</span></td><td><button type="button" className="fltable__edit" aria-label={`Edit ${record.name}`} onClick={() => onEdit(index)}><POSIcon.Pencil /></button></td></tr>)}</tbody></table></div>;
}

function RecordSectionView({ section, setTarget }: { section: RecordSection; setTarget: (target: EditorTarget) => void }): JSX.Element {
  const { mef, editable } = useExternalFloodPraWorkbook();
  const records = (valueAt(mef, section.path) ?? []) as SemanticRecord[];
  return <Section title={section.title} actions={editable ? <AddButton label={`Add ${section.singular}`} onClick={() => setTarget(collectionTarget(section))} /> : undefined}><RecordTable records={records} section={section} onEdit={(index) => setTarget(collectionTarget(section, index))} /></Section>;
}

const section = (title: string, path: EditorPath, singular: string, columns: Array<{ label: string; key: string }>): RecordSection => ({ title, path, singular, empty: `No ${title.toLowerCase()} recorded`, columns });
const common = (root: string): RecordSection[] => [
  section("Model uncertainties", [root, "modelUncertainties"], "uncertainty", [{ label: "Type", key: "uncertaintyType" }, { label: "Affected records", key: "affectedRecordRefs" }, { label: "Potential impact", key: "potentialImpact" }, { label: "Importance", key: "importance" }]),
  section("Pre-operational assumptions", [root, "preOperationalAssumptions"], "assumption", [{ label: "Missing information", key: "missingDesignInformation" }, { label: "Closure action", key: "closureAction" }, { label: "Phase", key: "closurePhase" }, { label: "Status", key: "closureStatus" }]),
];


const XF_STEP_CONFIG: Record<string, StepConfig> = {
  "site-evidence": { root: "analysisBasis", sections: [
    section("Controlled evidence", ["analysisBasis", "evidenceRegister"], "evidence record", [{ label: "Type", key: "evidenceType" }, { label: "Source", key: "sourceReference" }, { label: "Application", key: "applicability" }, { label: "Controlled", key: "controlled" }]),
    section("Model uncertainties", ["analysisBasis", "modelUncertainties"], "uncertainty", [{ label: "Type", key: "uncertaintyType" }, { label: "Affected records", key: "affectedRecordRefs" }, { label: "Potential impact", key: "potentialImpact" }, { label: "Importance", key: "importance" }]),
    section("Pre-operational assumptions", ["analysisBasis", "preOperationalAssumptions"], "assumption", [{ label: "Missing information", key: "missingDesignInformation" }, { label: "Closure action", key: "closureAction" }, { label: "Phase", key: "closurePhase" }, { label: "Status", key: "closureStatus" }]),
  ] },
  "hazard-screening": { root: "hazardScreening", sections: [
    section("External-flood hazard candidates", ["hazardScreening", "hazardCandidates"], "hazard candidate", [{ label: "Hazard", key: "hazardType" }, { label: "Sources", key: "sourceLocations" }, { label: "Flood effects", key: "floodEffects" }, { label: "Disposition", key: "disposition" }]),
    section("Causal and coincident combinations", ["hazardScreening", "hazardCombinations"], "hazard combination", [{ label: "Primary", key: "primaryHazardType" }, { label: "Combined hazards", key: "combinedHazards" }, { label: "Relationship", key: "relationship" }, { label: "Disposition", key: "disposition" }]),
    section("Hazard screening decisions", ["hazardScreening", "screeningDecisions"], "screening decision", [{ label: "Hazards", key: "hazardTypes" }, { label: "Criterion", key: "criterion" }, { label: "Value", key: "quantitativeValue" }, { label: "Disposition", key: "disposition" }]),
    section("Aggregate screening checks", ["hazardScreening", "aggregateScreeningChecks"], "aggregate check", [{ label: "Objects", key: "screenedObjectRefs" }, { label: "Aggregate /yr", key: "aggregateFrequencyPerPlantYear" }, { label: "Threshold", key: "threshold" }, { label: "Disposition", key: "disposition" }]),
    section("Configuration confirmations", ["hazardScreening", "confirmations"], "confirmation", [{ label: "Decision", key: "screeningDecisionRef" }, { label: "Method", key: "confirmationMethod" }, { label: "Confirmed", key: "confirmed" }, { label: "Discrepancies", key: "discrepancies" }]),
    section("Screening investigations", ["hazardScreening", "investigations"], "investigation", [{ label: "Type", key: "investigationType" }, { label: "Locations", key: "locations" }, { label: "Date", key: "performedDate" }, { label: "Findings", key: "findingRefs" }]),
  ] },
  "site-model": { root: "siteFloodModel", sections: [
    section("Site flood data sources", ["siteFloodModel", "dataSources"], "data source", [{ label: "Type", key: "sourceType" }, { label: "Dataset", key: "datasetId" }, { label: "Period", key: "periodStart" }, { label: "Completeness", key: "recordCompleteness" }]),
    section("Common site parameters", ["siteFloodModel", "siteParameters"], "site parameter", [{ label: "Type", key: "parameterType" }, { label: "Location", key: "location" }, { label: "Value", key: "value" }, { label: "Bounds", key: "upperBound" }]),
    section("Datum conversions", ["siteFloodModel", "datumConversions"], "datum conversion", [{ label: "Source datum", key: "sourceDatum" }, { label: "Target datum", key: "targetDatum" }, { label: "Offset (m)", key: "verticalOffsetMetres" }, { label: "Verification", key: "verificationRef" }]),
    section("Hydrologic assumptions", ["siteFloodModel", "hydrologicAssumptions"], "hydrologic assumption", [{ label: "Process", key: "process" }, { label: "Assumption", key: "assumption" }, { label: "Parameters", key: "parameterValues" }, { label: "Sensitivity", key: "sensitivityRef" }]),
    section("Numerical flood models", ["siteFloodModel", "numericalModels"], "numerical model", [{ label: "Software", key: "software" }, { label: "Model type", key: "modelType" }, { label: "Resolution (m)", key: "gridResolutionMetres" }, { label: "Quality", key: "qualityStatus" }]),
    section("Data and model qualification checks", ["siteFloodModel", "qualificationChecks"], "qualification check", [{ label: "Subject", key: "subjectRef" }, { label: "Check", key: "checkType" }, { label: "Findings", key: "findings" }, { label: "Disposition", key: "disposition" }]),
  ] },
  lip: { root: "localIntensePrecipitationAnalysis", sections: [
    section("Precipitation-frequency inputs", ["localIntensePrecipitationAnalysis", "precipitationInputs"], "precipitation input", [{ label: "Duration (h)", key: "durationHours" }, { label: "AEP", key: "annualExceedanceProbability" }, { label: "Depth (mm)", key: "depthMillimetres" }, { label: "Uncertainty (%)", key: "uncertaintyPercent" }]),
    section("Drainage catchments", ["localIntensePrecipitationAnalysis", "drainageCatchments"], "catchment", [{ label: "Area (m²)", key: "areaSquareMetres" }, { label: "Impervious", key: "imperviousFraction" }, { label: "Drain capacity", key: "drainageCapacityCubicMetresPerSecond" }, { label: "Targets", key: "targetLocationRefs" }]),
    section("LIP hydraulic models", ["localIntensePrecipitationAnalysis", "hydraulicModels"], "hydraulic model", [{ label: "Model", key: "numericalModelRef" }, { label: "Drain availability", key: "drainageAvailability" }, { label: "Blocked inlets", key: "blockedInletFraction" }, { label: "Mass balance (%)", key: "massBalanceErrorPercent" }]),
    section("Surface flow paths", ["localIntensePrecipitationAnalysis", "surfaceFlowPaths"], "surface flow path", [{ label: "Origin", key: "origin" }, { label: "Destination", key: "destination" }, { label: "Type", key: "pathwayType" }, { label: "Capacity", key: "capacityCubicMetresPerSecond" }]),
    section("Local precipitation hazard results", ["localIntensePrecipitationAnalysis", "hazardResults"], "hazard result", [{ label: "Location", key: "location" }, { label: "AEP", key: "annualExceedanceProbability" }, { label: "Depth (m)", key: "depthMetres" }, { label: "Duration (h)", key: "durationHours" }]),
  ] },
  riverine: { root: "riverineFloodAnalysis", sections: [
    section("Watershed models", ["riverineFloodAnalysis", "watershedModels"], "watershed model", [{ label: "Area (km²)", key: "watershedAreaSquareKilometres" }, { label: "Hydrologic model", key: "hydrologicModel" }, { label: "Routing", key: "routingMethod" }, { label: "Calibration events", key: "calibrationEvents" }]),
    section("River discharge-frequency analyses", ["riverineFloodAnalysis", "frequencyAnalyses"], "frequency analysis", [{ label: "Method", key: "method" }, { label: "Years", key: "recordYears" }, { label: "AEPs", key: "annualExceedanceProbabilities" }, { label: "Peak discharges", key: "peakDischargesCubicMetresPerSecond" }]),
    section("Stage-discharge models", ["riverineFloodAnalysis", "stageDischargeModels"], "stage-discharge model", [{ label: "Location", key: "riverLocation" }, { label: "Model", key: "hydraulicModelRef" }, { label: "Discharges", key: "dischargesCubicMetresPerSecond" }, { label: "Stages", key: "stagesMetres" }]),
    section("Levee assessments", ["riverineFloodAnalysis", "leveeAssessments"], "levee assessment", [{ label: "Location", key: "leveeLocation" }, { label: "Crest (m)", key: "crestElevationMetres" }, { label: "Failure modes", key: "failureModes" }, { label: "Fragility", key: "fragilityRef" }]),
    section("Riverine hazard results", ["riverineFloodAnalysis", "hazardResults"], "hazard result", [{ label: "Location", key: "location" }, { label: "AEP", key: "annualExceedanceProbability" }, { label: "Depth (m)", key: "depthMetres" }, { label: "Velocity", key: "velocityMetresPerSecond" }]),
  ] },
  "dam-impoundment": { root: "damAndImpoundmentAnalysis", sections: [
    section("Dam and impoundment inventory", ["damAndImpoundmentAnalysis", "impoundmentInventory"], "impoundment", [{ label: "Facility", key: "facilityId" }, { label: "Type", key: "facilityType" }, { label: "Distance (km)", key: "distanceToSiteKilometres" }, { label: "Storage (m³)", key: "maximumStorageCubicMetres" }]),
    section("Impoundment failure modes", ["damAndImpoundmentAnalysis", "failureModes"], "failure mode", [{ label: "Impoundment", key: "impoundmentRef" }, { label: "Failure type", key: "failureType" }, { label: "Conditional probability", key: "conditionalFailureProbability" }, { label: "Warning", key: "warningBasis" }]),
    section("Breach models", ["damAndImpoundmentAnalysis", "breachModels"], "breach model", [{ label: "Failure mode", key: "failureModeRef" }, { label: "Width (m)", key: "breachWidthMetres" }, { label: "Formation (h)", key: "breachFormationTimeHours" }, { label: "Peak outflow", key: "peakOutflowCubicMetresPerSecond" }]),
    section("Dam-break routing models", ["damAndImpoundmentAnalysis", "routingModels"], "routing model", [{ label: "Breaches", key: "breachModelRefs" }, { label: "Distance (km)", key: "routingDistanceKilometres" }, { label: "Travel time (h)", key: "travelTimeHours" }, { label: "Model", key: "numericalModelRef" }]),
    section("Dam and impoundment hazard results", ["damAndImpoundmentAnalysis", "hazardResults"], "hazard result", [{ label: "Location", key: "location" }, { label: "AEP", key: "annualExceedanceProbability" }, { label: "Depth (m)", key: "depthMetres" }, { label: "Warning (h)", key: "warningTimeHours" }]),
  ] },
  "surge-seiche-tsunami": { root: "surgeSeicheTsunamiAnalysis", sections: [
    section("Coastal and enclosed-water sources", ["surgeSeicheTsunamiAnalysis", "coastalSources"], "coastal source", [{ label: "Type", key: "sourceType" }, { label: "Region", key: "sourceRegion" }, { label: "Occurrence", key: "occurrenceModel" }, { label: "Applicability", key: "applicability" }]),
    section("Storm-surge models", ["surgeSeicheTsunamiAnalysis", "stormSurgeModels"], "surge model", [{ label: "Sources", key: "sourceRefs" }, { label: "Tide", key: "tideTreatment" }, { label: "Waves", key: "waveTreatment" }, { label: "Years", key: "simulatedYears" }]),
    section("Seiche models", ["surgeSeicheTsunamiAnalysis", "seicheModels"], "seiche model", [{ label: "Water body", key: "waterBody" }, { label: "Excitation", key: "excitationMechanisms" }, { label: "Periods", key: "naturalPeriodsMinutes" }, { label: "Amplification", key: "shorelineAmplification" }]),
    section("Tsunami models", ["surgeSeicheTsunamiAnalysis", "tsunamiModels"], "tsunami model", [{ label: "Source model", key: "sourceModel" }, { label: "Propagation", key: "propagationModel" }, { label: "Runup", key: "runupMethod" }, { label: "Arrival times", key: "arrivalTimesHours" }]),
    section("Coastal hazard results", ["surgeSeicheTsunamiAnalysis", "hazardResults"], "hazard result", [{ label: "Hazard", key: "hazardType" }, { label: "Location", key: "location" }, { label: "AEP", key: "annualExceedanceProbability" }, { label: "Wave (m)", key: "waveHeightMetres" }]),
  ] },
  "hazard-integration": { root: "hazardIntegration", sections: [
    section("Hazard logic-tree branches", ["hazardIntegration", "logicTreeBranches"], "logic-tree branch", [{ label: "Hazard", key: "hazardType" }, { label: "Level", key: "branchLevel" }, { label: "Alternative", key: "alternative" }, { label: "Weight", key: "weight" }]),
    section("Integrated flood hazard curves", ["hazardIntegration", "hazardCurves"], "hazard curve", [{ label: "Hazard", key: "hazardType" }, { label: "Location", key: "location" }, { label: "Values", key: "values" }, { label: "Frequencies", key: "annualExceedanceFrequencies" }]),
    section("Spatial flood characterizations", ["hazardIntegration", "spatialCharacterizations"], "spatial characterization", [{ label: "Hazard", key: "hazardType" }, { label: "Curve", key: "hazardCurveRef" }, { label: "Locations", key: "locationRefs" }, { label: "Correlation", key: "spatialCorrelationTreatment" }]),
    section("Flood hazard intervals", ["hazardIntegration", "hazardIntervals"], "hazard interval", [{ label: "Curve", key: "hazardCurveRef" }, { label: "Bounds", key: "upperValue" }, { label: "Representative", key: "representativeValue" }, { label: "Frequency /yr", key: "intervalAnnualFrequency" }]),
    section("Hazard uncertainty studies", ["hazardIntegration", "uncertaintyStudies"], "uncertainty study", [{ label: "Hazards", key: "hazardTypes" }, { label: "Sources", key: "uncertaintySources" }, { label: "Samples", key: "sampleCount" }, { label: "Statistics", key: "outputStatistics" }]),
    section("Hazard convergence studies", ["hazardIntegration", "convergenceStudies"], "convergence study", [{ label: "Type", key: "studyType" }, { label: "Tested values", key: "testedValues" }, { label: "Relative change", key: "relativeChange" }, { label: "Converged", key: "converged" }]),
  ] },
  "preliminary-response": { root: "preliminaryPlantResponse", sections: [
    section("Preliminary flood initiating events", ["preliminaryPlantResponse", "preliminaryInitiatingEvents"], "preliminary initiator", [{ label: "Initiator", key: "initiatingEventRef" }, { label: "Hazards", key: "hazardTypes" }, { label: "Type", key: "directOrConsequential" }, { label: "Disposition", key: "disposition" }]),
    section("Baseline PRA model reviews", ["preliminaryPlantResponse", "modelReviews"], "model review", [{ label: "Area", key: "baselineModelArea" }, { label: "Question", key: "reviewQuestion" }, { label: "Findings", key: "findings" }, { label: "Changes", key: "requiredChanges" }]),
    section("External Flood Equipment List", ["preliminaryPlantResponse", "externalFloodEquipmentList"], "XFEL item", [{ label: "SSC type", key: "sscType" }, { label: "Location", key: "location" }, { label: "Hazards", key: "applicableHazardTypes" }, { label: "Disposition", key: "disposition" }]),
  ] },
  investigation: { root: "plantInvestigation", sections: [
    section("Plant investigations", ["plantInvestigation", "investigations"], "investigation", [{ label: "Type", key: "investigationType" }, { label: "Locations", key: "locations" }, { label: "Date", key: "performedDate" }, { label: "Findings", key: "findingRefs" }]),
    section("Investigation findings", ["plantInvestigation", "findings"], "finding", [{ label: "Type", key: "findingType" }, { label: "Location", key: "location" }, { label: "Observed condition", key: "observedCondition" }, { label: "Closure", key: "closureStatus" }]),
    section("Flood pathways", ["plantInvestigation", "floodPathways"], "flood pathway", [{ label: "Origin", key: "origin" }, { label: "Destination", key: "destination" }, { label: "Type", key: "pathwayType" }, { label: "Exposed SSCs", key: "exposedSscRefs" }]),
    section("Flood protection features", ["plantInvestigation", "protectionFeatures"], "protection feature", [{ label: "Type", key: "featureType" }, { label: "Location", key: "location" }, { label: "Passive", key: "passive" }, { label: "Fragility", key: "fragilityRef" }]),
    section("Drainage features", ["plantInvestigation", "drainageFeatures"], "drainage feature", [{ label: "Type", key: "featureType" }, { label: "Location", key: "location" }, { label: "Capacity", key: "capacityCubicMetresPerSecond" }, { label: "Power", key: "powerDependencyRefs" }]),
  ] },
  "fragility-basis": { root: "sscScreeningAndFragilityBasis", sections: [
    section("SSC screening decisions", ["sscScreeningAndFragilityBasis", "screeningDecisions"], "screening decision", [{ label: "Objects", key: "screenedObjectRefs" }, { label: "Effects", key: "floodEffects" }, { label: "Criterion", key: "criterion" }, { label: "Disposition", key: "disposition" }]),
    section("Fragility method selections", ["sscScreeningAndFragilityBasis", "methodSelections"], "method selection", [{ label: "SSCs", key: "sscRefs" }, { label: "Failure modes", key: "failureModeRefs" }, { label: "Method", key: "method" }, { label: "Correlation", key: "correlationTreatment" }]),
    section("External-flood failure modes", ["sscScreeningAndFragilityBasis", "failureModes"], "failure mode", [{ label: "SSC", key: "sscRef" }, { label: "Mode", key: "modeType" }, { label: "Effects", key: "floodEffects" }, { label: "Consequence", key: "functionalConsequence" }]),
    section("Fragility correlation groups", ["sscScreeningAndFragilityBasis", "correlationGroups"], "correlation group", [{ label: "Members", key: "memberSscRefs" }, { label: "Failures", key: "failureModeRefs" }, { label: "Model", key: "correlationModel" }, { label: "Coefficient", key: "correlationCoefficient" }]),
    section("Coexistent-hazard fragility assessments", ["sscScreeningAndFragilityBasis", "coexistentHazardAssessments"], "coexistent assessment", [{ label: "Primary", key: "primaryHazardType" }, { label: "Combined", key: "combinedHazards" }, { label: "Relationship", key: "relationship" }, { label: "Disposition", key: "disposition" }]),
  ] },
  fragility: { root: "floodFragilityAnalysis", sections: [
    section("Barrier and protection fragilities", ["floodFragilityAnalysis", "barrierFragilities"], "barrier fragility", [{ label: "Feature", key: "featureRef" }, { label: "Median", key: "medianCapacity" }, { label: "Randomness", key: "betaRandomness" }, { label: "Uncertainty", key: "betaUncertainty" }]),
    section("Equipment and structure fragilities", ["floodFragilityAnalysis", "equipmentFragilities"], "equipment fragility", [{ label: "SSC", key: "sscRef" }, { label: "Demand", key: "demandParameter" }, { label: "Threshold", key: "thresholdValue" }, { label: "Median", key: "medianCapacity" }]),
    section("Flood structural load models", ["floodFragilityAnalysis", "structuralLoadModels"], "load model", [{ label: "SSC", key: "sscRef" }, { label: "Hydrostatic", key: "hydrostaticLoadKilonewtons" }, { label: "Debris", key: "debrisImpactLoadKilonewtons" }, { label: "Combination", key: "loadCombination" }]),
    section("Seal and penetration assessments", ["floodFragilityAnalysis", "sealAssessments"], "seal assessment", [{ label: "Seal", key: "sealOrPenetrationRef" }, { label: "Type", key: "sealType" }, { label: "Head capacity", key: "differentialHeadCapacityMetres" }, { label: "Leakage", key: "leakageRateLitresPerMinute" }]),
    section("Conditional flood fragility curves", ["floodFragilityAnalysis", "fragilityCurves"], "fragility curve", [{ label: "SSC", key: "sscRef" }, { label: "Demand values", key: "demandValues" }, { label: "Failure probabilities", key: "conditionalFailureProbabilities" }, { label: "Correlations", key: "correlationGroupRefs" }]),
  ] },
  scenarios: { root: "scenarioDevelopment", sections: [
    section("External-flood scenario groups", ["scenarioDevelopment", "scenarioGroups"], "scenario group", [{ label: "Hazards", key: "hazardTypes" }, { label: "Pathways", key: "initialPathwayRefs" }, { label: "Exposed SSCs", key: "exposedSscRefs" }, { label: "Initiators", key: "initiatingEventRefs" }]),
    section("Flood propagation models", ["scenarioDevelopment", "propagationModels"], "propagation model", [{ label: "Scenario", key: "scenarioGroupRef" }, { label: "Source", key: "sourceLocation" }, { label: "Destinations", key: "destinationLocations" }, { label: "States", key: "outputLocationStates" }]),
    section("Scenario timelines", ["scenarioDevelopment", "scenarioTimelines"], "scenario timeline", [{ label: "Scenario", key: "scenarioGroupRef" }, { label: "Warning (h)", key: "warningTimeHours" }, { label: "Arrival (h)", key: "siteArrivalTimeHours" }, { label: "Mission (h)", key: "missionTimeHours" }]),
    section("Combined-hazard scenarios", ["scenarioDevelopment", "hazardCombinations"], "combined-hazard scenario", [{ label: "Primary", key: "primaryHazardType" }, { label: "Combined", key: "combinedHazards" }, { label: "Relationship", key: "relationship" }, { label: "Double counting", key: "doubleCountingControl" }]),
    section("Scenario screening decisions", ["scenarioDevelopment", "screeningDecisions"], "scenario screening decision", [{ label: "Scenarios", key: "screenedObjectRefs" }, { label: "Value", key: "quantitativeValue" }, { label: "Aggregate", key: "aggregateFrequencyPerPlantYear" }, { label: "Disposition", key: "disposition" }]),
  ] },
  "plant-response": { root: "plantResponseModel", sections: [
    section("Baseline peer-review dispositions", ["plantResponseModel", "peerReviewDispositions"], "peer-review disposition", [{ label: "Element", key: "sourcePraElement" }, { label: "Finding", key: "findingId" }, { label: "Relevance", key: "relevanceToExternalFlood" }, { label: "Closure", key: "closureStatus" }]),
    section("External-flood initiating-event models", ["plantResponseModel", "initiatingEventModels"], "initiating-event model", [{ label: "Initiator", key: "initiatingEventRef" }, { label: "Hazards", key: "hazardTypes" }, { label: "Intervals", key: "hazardIntervalRefs" }, { label: "Frequency", key: "frequencyTreatment" }]),
    section("External-flood event-sequence models", ["plantResponseModel", "eventSequenceModels"], "event-sequence model", [{ label: "Event tree", key: "eventTreeRef" }, { label: "Hazards", key: "hazardTypes" }, { label: "Sequences", key: "eventSequenceRefs" }, { label: "Mission", key: "missionTimeRef" }]),
    section("Flood success criteria", ["plantResponseModel", "successCriteria"], "success criterion", [{ label: "Function", key: "safetyFunctionRef" }, { label: "Criterion", key: "criterion" }, { label: "Required SSCs", key: "requiredSscRefs" }, { label: "Mission (h)", key: "missionTimeHours" }]),
    section("System-model modifications", ["plantResponseModel", "systemModelModifications"], "system modification", [{ label: "System", key: "systemRef" }, { label: "SSCs", key: "affectedSscRefs" }, { label: "Modification", key: "modification" }, { label: "Verification", key: "verificationRefs" }]),
    section("Flood mission times", ["plantResponseModel", "missionTimes"], "mission time", [{ label: "Hazards", key: "hazardTypes" }, { label: "Function", key: "safetyFunctionRef" }, { label: "Hours", key: "missionTimeHours" }, { label: "Families", key: "eventSequenceFamilyRefs" }]),
    section("Flood-adjusted data parameters", ["plantResponseModel", "dataParameters"], "data parameter", [{ label: "Parameter", key: "parameterRef" }, { label: "Type", key: "parameterType" }, { label: "Mean", key: "meanValue" }, { label: "Adjustment", key: "floodAdjustment" }]),
    section("Multi-unit and multi-source response", ["plantResponseModel", "multiUnitAssessments"], "multi-unit assessment", [{ label: "Units", key: "affectedReactorUnitRefs" }, { label: "Sources", key: "affectedSourceRefs" }, { label: "Shared SSCs", key: "sharedSscRefs" }, { label: "Resources", key: "sharedResourceRefs" }]),
  ] },
  "human-reliability": { root: "humanReliabilityAnalysis", sections: [
    section("External-flood human actions", ["humanReliabilityAnalysis", "humanActions"], "human action", [{ label: "Type", key: "actionType" }, { label: "Location", key: "actionLocation" }, { label: "Warning (min)", key: "warningTimeAvailableMinutes" }, { label: "Execution (min)", key: "executionTimeMinutes" }]),
    section("Human failure events", ["humanReliabilityAnalysis", "humanFailureEvents"], "human failure event", [{ label: "Action", key: "humanActionRef" }, { label: "Failure", key: "failureDescription" }, { label: "Sequences", key: "eventSequenceRefs" }, { label: "Exclusive recovery", key: "exclusiveRecovery" }]),
    section("Flood performance contexts", ["humanReliabilityAnalysis", "performanceContexts"], "performance context", [{ label: "Action", key: "humanActionRef" }, { label: "Hazards", key: "hazardTypes" }, { label: "Water/debris", key: "waterAndDebrisConditions" }, { label: "Access", key: "accessAndEgress" }]),
    section("Flood HEP estimates", ["humanReliabilityAnalysis", "hepEstimates"], "HEP estimate", [{ label: "HFE", key: "humanFailureEventRef" }, { label: "Method", key: "method" }, { label: "Nominal HEP", key: "nominalHep" }, { label: "Flood HEP", key: "externalFloodHep" }]),
    section("Action confirmations", ["humanReliabilityAnalysis", "confirmations"], "action confirmation", [{ label: "Actions", key: "humanActionRefs" }, { label: "Type", key: "confirmationType" }, { label: "Timing", key: "confirmedTiming" }, { label: "Changes", key: "modelChanges" }]),
    section("Recovery assessments", ["humanReliabilityAnalysis", "recoveryAssessments"], "recovery assessment", [{ label: "Action", key: "humanActionRef" }, { label: "Source model", key: "sourceRecoveryModelRef" }, { label: "Remains valid", key: "remainsValidUnderExternalFlood" }, { label: "Recovery value", key: "recoveryValue" }]),
    section("HRA dependencies", ["humanReliabilityAnalysis", "dependencyAssessments"], "dependency assessment", [{ label: "HFEs", key: "humanFailureEventRefs" }, { label: "Crews", key: "sharedCrews" }, { label: "Relationship", key: "temporalRelationship" }, { label: "Dependency", key: "dependencyLevel" }]),
  ] },
  quantification: { root: "eventSequenceQuantification", sections: [
    section("Quantification runs", ["eventSequenceQuantification", "quantificationRuns"], "quantification run", [{ label: "Model", key: "modelVersion" }, { label: "Hazards", key: "hazardTypes" }, { label: "Samples", key: "uncertaintySampleCount" }, { label: "Software", key: "softwareAndVersion" }]),
    section("Flood-interval results", ["eventSequenceQuantification", "hazardIntervalResults"], "interval result", [{ label: "Interval", key: "hazardIntervalRef" }, { label: "Hazard", key: "hazardType" }, { label: "Family", key: "eventSequenceFamilyRef" }, { label: "Frequency /yr", key: "sequenceFrequencyPerPlantYear" }]),
    section("Event-sequence-family results", ["eventSequenceQuantification", "eventSequenceFamilyResults"], "family result", [{ label: "Family", key: "eventSequenceFamilyRef" }, { label: "Hazards", key: "hazardTypes" }, { label: "Mean /yr", key: "meanFrequencyPerPlantYear" }, { label: "P95 /yr", key: "ninetyFifthPercentileFrequencyPerPlantYear" }]),
    section("Quantification convergence", ["eventSequenceQuantification", "convergenceStudies"], "convergence study", [{ label: "Type", key: "studyType" }, { label: "Tested values", key: "testedValues" }, { label: "Relative change", key: "relativeChange" }, { label: "Converged", key: "converged" }]),
    section("Integrated uncertainty results", ["eventSequenceQuantification", "uncertaintyResults"], "uncertainty result", [{ label: "Samples", key: "sampleCount" }, { label: "Mean /yr", key: "aggregateMeanFrequencyPerPlantYear" }, { label: "P95 /yr", key: "aggregateNinetyFifthPercentileFrequencyPerPlantYear" }, { label: "Variance", key: "varianceContributions" }]),
    section("External-flood risk contributors", ["eventSequenceQuantification", "riskContributors"], "risk contributor", [{ label: "Type", key: "contributorType" }, { label: "Contributor", key: "contributorRef" }, { label: "Rank", key: "rank" }, { label: "Fraction", key: "fractionalContribution" }]),
    section("Quantitative scenario screens", ["eventSequenceQuantification", "screeningDecisions"], "screening decision", [{ label: "Objects", key: "screenedObjectRefs" }, { label: "Value", key: "quantitativeValue" }, { label: "Aggregate", key: "aggregateFrequencyPerPlantYear" }, { label: "Disposition", key: "disposition" }]),
  ] },
  "risk-interpretation": { root: "riskInterpretation", sections: [
    section("External-flood risk insights", ["riskInterpretation", "riskInsights"], "risk insight", [{ label: "Type", key: "insightType" }, { label: "Contributors", key: "contributorRefs" }, { label: "Quantitative basis", key: "quantitativeBasis" }, { label: "Actions", key: "recommendedActions" }]),
    section("Model refinement actions", ["riskInterpretation", "refinementActions"], "refinement action", [{ label: "Trigger", key: "trigger" }, { label: "Change", key: "proposedChange" }, { label: "Priority", key: "priority" }, { label: "Closure", key: "closureStatus" }]),
    section("Quantification iterations", ["riskInterpretation", "quantificationIterations"], "quantification iteration", [{ label: "Iteration", key: "iterationNumber" }, { label: "Changes", key: "changes" }, { label: "Frequency change", key: "aggregateFrequencyChange" }, { label: "Decision", key: "decision" }]),
    section("Sensitivity studies", ["riskInterpretation", "sensitivityStudies"], "sensitivity study", [{ label: "Base run", key: "baseRunRef" }, { label: "Varied inputs", key: "variedInputs" }, { label: "Result changes", key: "resultChanges" }, { label: "Conclusion", key: "conclusion" }]),
  ] },
  "risk-integration": { root: "riskIntegration", sections: [
    section("Integrated risk results", ["riskIntegration", "integrationResults"], "integration result", [{ label: "Metric", key: "metric" }, { label: "XF contribution", key: "externalFloodContributionPerPlantYear" }, { label: "Total risk", key: "totalRiskPerPlantYear" }, { label: "Fraction", key: "fractionalContribution" }]),
    section("Risk-informed decisions", ["riskIntegration", "riskDecisions"], "risk decision", [{ label: "Type", key: "decisionType" }, { label: "Decision", key: "decision" }, { label: "Owner", key: "responsibleOrganization" }, { label: "Closure", key: "closureStatus" }]),
    section("End-to-end traceability", ["riskIntegration", "traceabilityPaths"], "traceability path", [{ label: "Hazards", key: "hazardRefs" }, { label: "Fragilities", key: "fragilityRefs" }, { label: "Decisions", key: "decisionRefs" }, { label: "Complete", key: "complete" }]),
    section("Controlled External Flood PRA baselines", ["riskIntegration", "controlledBaselines"], "controlled baseline", [{ label: "Model", key: "modelVersion" }, { label: "Freeze", key: "freezeDate" }, { label: "Control record", key: "configurationControlRecordId" }, { label: "Status", key: "releaseStatus" }]),
  ] },
  "technical-closure": { root: "technicalClosure", sections: [
    section("Conformance reviews", ["technicalClosure", "conformanceReviews"], "conformance review", [{ label: "Review", key: "name" }, { label: "Result", key: "description" }, { label: "Basis", key: "basis" }, { label: "Status", key: "status" }]),
    section("Documentation checks", ["technicalClosure", "documentationChecks"], "documentation check", [{ label: "Check", key: "name" }, { label: "Result", key: "description" }, { label: "Evidence", key: "evidenceRefs" }, { label: "Status", key: "status" }]),
    section("Interface closure checks", ["technicalClosure", "interfaceClosureChecks"], "interface closure check", [{ label: "Check", key: "name" }, { label: "Result", key: "description" }, { label: "Related records", key: "relatedRefs" }, { label: "Status", key: "status" }]),
    section("Peer-review team", ["technicalClosure", "peerReviewTeam"], "team member", [{ label: "Role", key: "role" }, { label: "Organization", key: "organization" }, { label: "Qualifications", key: "qualifications" }, { label: "Scope", key: "reviewScope" }]),
    section("Peer-review findings", ["technicalClosure", "peerReviewFindings"], "peer-review finding", [{ label: "Area", key: "reviewArea" }, { label: "Category", key: "findingCategory" }, { label: "Significance", key: "significance" }, { label: "Closure", key: "closureStatus" }]),
    section("Readiness checks", ["technicalClosure", "readinessChecks"], "readiness check", [{ label: "Check", key: "name" }, { label: "Result", key: "description" }, { label: "Evidence", key: "evidenceRefs" }, { label: "Status", key: "status" }]),
  ] },
};

interface InterfaceEditorSelection { interfaceIndex: number; transferIndex: number }

const INTERFACE_PRIMARY_COLUMNS: Record<ExternalFloodPRA["analysisBasis"]["interfaces"][number]["payloadType"], string> = {
  HAZARD_SCREENING_RESULT: "Retained hazard",
  OPERATING_STATE: "Operating state",
  INITIATING_EVENT: "Initiating-event group",
  EVENT_SEQUENCE: "Event-sequence family",
  SUCCESS_CRITERION: "Mission-time record",
  SYSTEM_MODEL: "System",
  HUMAN_FAILURE_EVENT: "Human failure event",
  DATA_PARAMETER: "Parameter",
  HAZARD_CURVE: "Hazard curve",
  FRAGILITY: "Fragility",
  EXTERNAL_FLOOD_EQUIPMENT_LIST: "External Flood Equipment List item",
  COEXISTENT_HAZARD: "Transferred model or hazard state",
  SEQUENCE_FAMILY_RESULT: "External Flood event-sequence family",
  RISK_CONTRIBUTOR: "Risk contributor",
};

function TechnicalInterfaceEditor({ selection, onClose }: { selection: InterfaceEditorSelection; onClose: () => void }): JSX.Element {
  const { mef, mutate } = useExternalFloodPraWorkbook();
  const sourceInterface = mef.analysisBasis.interfaces[selection.interfaceIndex];
  const sourceTransfer = sourceInterface?.transferItems[selection.transferIndex];
  const [direction, setDirection] = useState(sourceInterface?.direction ?? "INPUT");
  const [role, setRole] = useState(sourceInterface?.role ?? "");
  const [name, setName] = useState(sourceTransfer?.name ?? "");
  const [recordRef, setRecordRef] = useState(sourceTransfer?.recordRef ?? "");
  const [sourceModelRef, setSourceModelRef] = useState(sourceTransfer?.sourceModelRef ?? "");
  const [destinationRefs, setDestinationRefs] = useState(sourceTransfer?.destinationRefs.join("\n") ?? "");
  const [evidenceRefs, setEvidenceRefs] = useState(sourceTransfer?.evidenceRefs.join("\n") ?? "");
  const [status, setStatus] = useState(sourceTransfer?.status ?? "CONTROLLED");
  const [values, setValues] = useState(sourceTransfer?.values ?? []);
  if (sourceInterface === undefined || sourceTransfer === undefined) return <></>;
  function save(): void {
    mutate((current) => {
      const next = structuredClone(current);
      const targetInterface = next.analysisBasis.interfaces[selection.interfaceIndex];
      const targetTransfer = targetInterface?.transferItems[selection.transferIndex];
      if (targetInterface === undefined || targetTransfer === undefined) return current;
      targetInterface.direction = direction; targetInterface.role = role.trim(); targetInterface.producer = direction === "INPUT" ? targetInterface.technicalElementCode : "XF"; targetInterface.consumer = direction === "INPUT" ? "XF" : targetInterface.technicalElementCode;
      Object.assign(targetTransfer, { name: name.trim(), recordRef: recordRef.trim(), sourceModelRef: sourceModelRef.trim(), destinationRefs: technicalList(destinationRefs), evidenceRefs: technicalList(evidenceRefs), status, values });
      targetInterface.producerRefs = targetInterface.transferItems.map((item) => item.recordRef); targetInterface.consumerRefs = Array.from(new Set(targetInterface.transferItems.flatMap((item) => item.destinationRefs)));
      return synchronizeExternalFloodPraDerivedRegisters(next);
    });
    onClose();
  }
  return <Drawer title="Technical-element transfer record" onClose={onClose} footer={<><button type="button" className="posnav__btn" onClick={onClose}>Cancel</button><span className="fldrawer__footer-spacer" /><button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save changes</button></>}>
    <div className="sinlineeditor__body"><div className="sinlineeditor__group"><WorkbookSectionHeading title="Technical-element handoff" className="sinlineeditor__title" /><div className="sinlineeditor__grid"><Field label="Technical element"><TextInput value={`${sourceInterface.technicalElementCode} · ${sourceInterface.technicalElementName}`} disabled onChange={() => undefined} /></Field><Field label="Direction"><SelectInput value={direction} options={[{ value: "INPUT", label: "Input to External Flood PRA" }, { value: "OUTPUT", label: "Output from External Flood PRA" }]} onChange={(value) => setDirection(value as typeof direction)} /></Field><Field label="Interface role" wide><TextArea rows={3} value={role} onChange={setRole} /></Field></div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="Transferred record" className="sinlineeditor__title" /><div className="sinlineeditor__grid"><Field label="Record name" wide><TextInput value={name} onChange={setName} /></Field><Field label="Record reference"><TextInput value={recordRef} onChange={setRecordRef} /></Field><Field label="Transfer status"><SelectInput value={status} options={["CONTROLLED", "WORKING", "OPEN"].map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() }))} onChange={(value) => setStatus(value as typeof status)} /></Field><Field label="Source model or revision" wide><TextInput value={sourceModelRef} onChange={setSourceModelRef} /></Field><Field label="Destination records" wide><TextArea rows={4} value={destinationRefs} onChange={setDestinationRefs} /></Field><Field label="Evidence references" wide><TextArea rows={3} value={evidenceRefs} onChange={setEvidenceRefs} /></Field></div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="Transferred values" className="sinlineeditor__title" /><div className="sinlineeditor__grid">{sourceInterface.columns.map((column, index) => <Field key={column} label={column} wide><TextArea rows={2} value={values[index] ?? ""} onChange={(value) => setValues((current) => sourceInterface.columns.map((_, candidate) => candidate === index ? value : current[candidate] ?? ""))} /></Field>)}</div></div></div>
  </Drawer>;
}

function Interfaces({ setTarget, onEdit }: { setTarget: (target: EditorTarget) => void; onEdit: (selection: InterfaceEditorSelection) => void }): JSX.Element {
  const { mef, editable } = useExternalFloodPraWorkbook();
  const [selected, setSelected] = useState<number | null>(null);
  const current = selected === null ? undefined : mef.analysisBasis.interfaces[selected];
  return <Section title="Interfaces" actions={editable ? <AddButton label="Add interface" onClick={() => setTarget({ title: "Add technical-element interface", focus: [], createAt: ["analysisBasis", "interfaces"] })} /> : undefined}>
    <div className="poshandoff__grid">{mef.analysisBasis.interfaces.map((item, index) => <button key={item.uuid} type="button" className={`poshandoff__tile${selected === index ? " poshandoff__tile--active" : ""}`} onClick={() => setSelected(selected === index ? null : index)}><span className="poshandoff__tile-code">{item.direction === "INPUT" ? `${item.technicalElementCode} → XF` : `XF → ${item.technicalElementCode}`}</span><span className="poshandoff__tile-name">{item.technicalElementName}</span><span className="poshandoff__tile-role">{item.direction === "INPUT" ? "Receives" : "Provides"} · {item.role}</span></button>)}</div>
    {mef.analysisBasis.interfaces.length === 0 && <div className="flempty"><strong>No technical-element interfaces recorded</strong><p>Add inputs from HSA, POS, IE, ES, SC, SY, HR, DA, Internal Flood, Seismic PRA, and High Winds PRA, plus outputs to ESQ and Risk Integration.</p></div>}
    {current !== undefined && selected !== null && <div className="sinterface__details"><div className="sinterface__flow-title">{current.direction === "INPUT" ? `External Flood PRA receives ${current.role.toLowerCase()} from ${current.technicalElementName}` : `${current.technicalElementName} receives ${current.role.toLowerCase()} from External Flood PRA`}</div><div className="sinterface__table-wrap"><table className="postable postable--mid flinterface-table"><thead><tr><th>{INTERFACE_PRIMARY_COLUMNS[current.payloadType]}</th>{current.columns.map((column) => <th key={column}>{column}</th>)}<th>Status</th><th /></tr></thead><tbody>{current.transferItems.length === 0 ? <tr><td colSpan={current.columns.length + 3}>No controlled transfer records are available.</td></tr> : current.transferItems.map((item, transferIndex) => <tr key={item.uuid}><td className="stable__key"><strong>{item.name}</strong><small className="flcellnote">{item.recordRef} · {item.sourceModelRef}</small></td>{current.columns.map((column, columnIndex) => <td key={`${item.uuid}-${column}`}>{item.values[columnIndex] ?? "—"}</td>)}<td><span className={`fltag ${item.status === "CONTROLLED" ? "fltag--good" : "fltag--warn"}`}>{item.status}</span></td><td>{editable && <button type="button" className="fltable__edit" aria-label={`Edit ${item.name}`} onClick={() => onEdit({ interfaceIndex: selected, transferIndex })}><POSIcon.Pencil /></button>}</td></tr>)}</tbody></table></div></div>}
  </Section>;
}

type ScopeDraft = {
  applicationName: string; purpose: string; decisionContext: string; supportedRiskMetrics: string; plantName: string; siteName: string;
  vendor: string; reactorType: string; thermalPower: string; numberOfModules: number; praScope: string; capabilityCategory: NonNullable<ExternalFloodPRA["capabilityCategory"]>; plantStage: ExternalFloodPRA["plantStage"];
};
function technicalList(value: string): string[] { return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean); }
function defaultApplication(owner: string): ExternalFloodPraApplication {
  return { uuid: crypto.randomUUID(), code: "XF-APP-001", name: "", description: "", basis: "", owner, status: "DRAFT", evidenceRefs: [], relatedRefs: [], assumptionRefs: [], implementsSrs: [], purpose: "", decisionContext: "", supportedRiskMetrics: [], consumingElementRefs: [], configurationBasis: "", limitations: [] };
}

function AnalysisScopeEditor({ onClose }: { onClose: () => void }): JSX.Element {
  const { mef, editable, mutate } = useExternalFloodPraWorkbook();
  const application = mef.analysisBasis.applications[0];
  const identity = mef.metadata.plantIdentity ?? { name: mef.name, vendor: "", reactorType: "", thermalPower: "", primaryCoolant: "", numberOfModules: 1 };
  const operatingStates = mef.analysisBasis.baselinePra?.plantOperatingStateRefs.join("\n") ?? "";
  const materialSources = mef.analysisBasis.baselinePra?.radioactiveMaterialSourceRefs.join("\n") ?? "";
  const [draft, setDraft] = useState<ScopeDraft>(() => ({
    applicationName: application?.name ?? "", purpose: application?.purpose ?? "", decisionContext: application?.decisionContext ?? "", supportedRiskMetrics: application?.supportedRiskMetrics.join("\n") ?? "",
    plantName: identity.name, siteName: identity.siteName ?? mef.analysisBasis.siteBasis?.siteName ?? "", vendor: identity.vendor, reactorType: identity.reactorType, thermalPower: identity.thermalPower,
    numberOfModules: identity.numberOfModules ?? 1, praScope: mef.praScope, capabilityCategory: mef.capabilityCategory ?? "CC-II", plantStage: mef.plantStage,
  }));
  function save(): void {
    mutate((current) => {
      const next = structuredClone(current);
      const saved = { ...(next.analysisBasis.applications[0] ?? defaultApplication(next.owner ?? "External Flood PRA Team")), name: draft.applicationName, purpose: draft.purpose, description: draft.purpose, decisionContext: draft.decisionContext, basis: draft.decisionContext, supportedRiskMetrics: technicalList(draft.supportedRiskMetrics) };
      next.analysisBasis.applications = [saved, ...next.analysisBasis.applications.slice(1)];
      next.metadata.plantIdentity = { ...(next.metadata.plantIdentity ?? identity), name: draft.plantName, siteName: draft.siteName, vendor: draft.vendor, reactorType: draft.reactorType, thermalPower: draft.thermalPower, numberOfModules: Math.max(1, Math.round(draft.numberOfModules)) };
      next.praScope = draft.praScope; next.metadata.scope = draft.praScope; next.capabilityCategory = draft.capabilityCategory; next.plantStage = draft.plantStage;
      return synchronizeExternalFloodPraDerivedRegisters(next);
    });
    onClose();
  }
  return <Drawer title="PRA analysis and scope" onClose={onClose} footer={<><button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>{editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save changes</button>}</>}>
    <fieldset className="sinlineeditor" disabled={!editable}><div className="sinlineeditor__group"><WorkbookSectionHeading title="PRA application" className="sinlineeditor__title" /><Field label="Intended application"><TextInput value={draft.applicationName} onChange={(value) => setDraft((item) => ({ ...item, applicationName: value }))} /></Field><Field label="Purpose"><TextArea rows={3} value={draft.purpose} onChange={(value) => setDraft((item) => ({ ...item, purpose: value }))} /></Field><Field label="Decision supported"><TextArea rows={3} value={draft.decisionContext} onChange={(value) => setDraft((item) => ({ ...item, decisionContext: value }))} /></Field><Field label="Risk measures and endpoints"><TextArea rows={4} value={draft.supportedRiskMetrics} onChange={(value) => setDraft((item) => ({ ...item, supportedRiskMetrics: value }))} /></Field></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="Reference plant and site" className="sinlineeditor__title" /><div className="flfieldgrid"><Field label="Plant name"><TextInput value={draft.plantName} onChange={(value) => setDraft((item) => ({ ...item, plantName: value }))} /></Field><Field label="Site"><TextInput value={draft.siteName} onChange={(value) => setDraft((item) => ({ ...item, siteName: value }))} /></Field><Field label="Vendor or designer"><TextInput value={draft.vendor} onChange={(value) => setDraft((item) => ({ ...item, vendor: value }))} /></Field><Field label="Reactor type"><TextInput value={draft.reactorType} onChange={(value) => setDraft((item) => ({ ...item, reactorType: value }))} /></Field><Field label="Thermal power"><TextInput value={draft.thermalPower} onChange={(value) => setDraft((item) => ({ ...item, thermalPower: value }))} /></Field><Field label="Modules or units"><NumberInput value={draft.numberOfModules} onChange={(value) => setDraft((item) => ({ ...item, numberOfModules: value }))} /></Field></div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="Analysis boundary" className="sinlineeditor__title" /><Field label="PRA scope"><TextArea rows={5} value={draft.praScope} onChange={(value) => setDraft((item) => ({ ...item, praScope: value }))} /></Field><div className="flfieldgrid"><Field label="Capability category"><SelectInput value={draft.capabilityCategory} options={[{ value: "CC-I", label: "CC-I" }, { value: "CC-II", label: "CC-II" }]} onChange={(value) => setDraft((item) => ({ ...item, capabilityCategory: value as ScopeDraft["capabilityCategory"] }))} /></Field><Field label="Plant stage"><SelectInput value={draft.plantStage} options={[{ value: "PRE_OPERATIONAL", label: "Pre-operational" }, { value: "OPERATIONAL", label: "Operational" }]} onChange={(value) => setDraft((item) => ({ ...item, plantStage: value as ScopeDraft["plantStage"] }))} /></Field></div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="Imported baseline scope" className="sinlineeditor__title" /><Field label="Operating states"><TextArea rows={4} value={operatingStates} disabled onChange={() => undefined} /></Field><Field label="Radioactive-material sources"><TextArea rows={4} value={materialSources} disabled onChange={() => undefined} /></Field></div></fieldset>
  </Drawer>;
}

function AnalysisBasis(): JSX.Element {
  const { mef, editable } = useExternalFloodPraWorkbook();
  const [target, setTarget] = useState<EditorTarget | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [interfaceEditor, setInterfaceEditor] = useState<InterfaceEditorSelection | null>(null);
  const site = mef.analysisBasis.siteBasis;
  const baseline = mef.analysisBasis.baselinePra;
  const scopeSection = section("Analysis scope records", ["analysisBasis", "scopeRecords"], "scope record", [{ label: "Hazards", key: "hazardTypes" }, { label: "Effects", key: "floodEffects" }, { label: "Operating states", key: "plantOperatingStateRefs" }, { label: "Locations", key: "includedLocations" }]);
  const applicationSection = section("PRA applications", ["analysisBasis", "applications"], "application", [{ label: "Purpose", key: "purpose" }, { label: "Decision", key: "decisionContext" }, { label: "Metrics", key: "supportedRiskMetrics" }, { label: "Consumers", key: "consumingElementRefs" }]);
  const evidenceSection = section("Controlled evidence", ["analysisBasis", "evidenceRegister"], "evidence record", [{ label: "Type", key: "evidenceType" }, { label: "Source", key: "sourceReference" }, { label: "Subelements", key: "applicableSubelements" }, { label: "Controlled", key: "controlled" }]);
  return <div className="flstep">
    <Section title="PRA analysis and scope" actions={editable ? <EditButton label="Edit analysis scope" onClick={() => setScopeOpen(true)} /> : undefined}><div className="sanalysisbasis"><AnalysisRow label="Intended application" value={mef.analysisBasis.applications[0]?.name} /><AnalysisRow label="Purpose" value={mef.analysisBasis.applications[0]?.purpose} /><AnalysisRow label="Decision supported" value={mef.analysisBasis.applications[0]?.decisionContext} /><AnalysisRow label="PRA scope" value={mef.praScope} /><AnalysisRow label="Capability category" value={mef.capabilityCategory} /><AnalysisRow label="Plant stage" value={mef.plantStage} /><AnalysisRow label="Reference plant and site" value={[mef.metadata.plantIdentity?.name, mef.metadata.plantIdentity?.siteName].filter(Boolean)} /><AnalysisRow label="Operating states" value={baseline?.plantOperatingStateRefs} /><AnalysisRow label="Radioactive-material sources" value={baseline?.radioactiveMaterialSourceRefs} /><AnalysisRow label="Risk measures and endpoints" value={mef.analysisBasis.applications[0]?.supportedRiskMetrics} /></div></Section>
    <Section title="Site basis" actions={editable ? <EditButton label="Edit site basis" onClick={() => setTarget({ title: "External Flood site basis", focus: ["analysisBasis", "siteBasis"] })} /> : undefined}><div className="sanalysisbasis"><AnalysisRow label="Site" value={site?.siteName} /><AnalysisRow label="Basis type" value={site?.siteBasisType} /><AnalysisRow label="Selection status" value={site?.siteSelectionStatus} /><AnalysisRow label="Location" value={site === undefined ? "" : [site.latitudeDegrees, site.longitudeDegrees].filter((item) => item !== undefined).join(", ")} /><AnalysisRow label="Grade elevation" value={site?.gradeElevationMetres} /><AnalysisRow label="Watershed and coastal setting" value={site?.watershedAndCoastalSetting} /><AnalysisRow label="Topography and drainage" value={site?.topographyAndDrainageDescription} /><AnalysisRow label="Datum and survey basis" value={site?.datumAndSurveyBasis} /><AnalysisRow label="Operating states" value={site?.plantOperatingStateRefs} /></div></Section>
    <RecordSectionView section={scopeSection} setTarget={setTarget} />
    <Section title="Baseline PRA" actions={editable ? <EditButton label="Edit baseline PRA" onClick={() => setTarget({ title: "Baseline PRA definition", focus: ["analysisBasis", "baselinePra"] })} /> : undefined}><div className="sanalysisbasis"><AnalysisRow label="Model" value={baseline?.modelName} /><AnalysisRow label="Reference" value={baseline?.modelReference} /><AnalysisRow label="Revision" value={baseline?.revision} /><AnalysisRow label="Freeze date" value={baseline?.freezeDate} /><AnalysisRow label="Freeze status" value={baseline?.freezeStatus} /><AnalysisRow label="Record treatments" value={baseline?.recordTreatments.length} /></div></Section>
    <RecordSectionView section={applicationSection} setTarget={setTarget} />
    <RecordSectionView section={evidenceSection} setTarget={setTarget} />
    <Interfaces setTarget={setTarget} onEdit={setInterfaceEditor} />
    {scopeOpen && <AnalysisScopeEditor onClose={() => setScopeOpen(false)} />}
    {interfaceEditor !== null && <TechnicalInterfaceEditor key={`${String(interfaceEditor.interfaceIndex)}-${String(interfaceEditor.transferIndex)}`} selection={interfaceEditor} onClose={() => setInterfaceEditor(null)} />}
    <Editor target={target} onClose={() => setTarget(null)} />
  </div>;
}

function TechnicalStep({ stepId }: { stepId: string }): JSX.Element {
  const { mef, editable, mutate } = useExternalFloodPraWorkbook();
  const [target, setTarget] = useState<EditorTarget | null>(null);
  const config = XF_STEP_CONFIG[stepId];
  if (config === undefined) return <div className="flempty"><strong>Step configuration unavailable</strong></div>;
  const recordSections = config.root === "riskInterpretation" || config.root === "riskIntegration" || stepId === "site-evidence"
    ? config.sections
    : [...config.sections, ...common(config.root)];
  const updateModels = (hazardConditionedModels: ExternalFloodPRA["hazardConditionedModels"]): void => mutate((current) => ({ ...current, hazardConditionedModels }));
  return <div className="flstep">
    {stepId === "plant-response" && <>
      <Section title="Flood-conditioned initiating-event fault trees"><HazardFaultTreeEditor models={mef.hazardConditionedModels} editable={editable} onChange={updateModels} /></Section>
      <Section title="Flood-conditioned event trees"><HazardEventTreeEditor models={mef.hazardConditionedModels} editable={editable} onChange={updateModels} /></Section>
    </>}
    {recordSections.map((item) => <RecordSectionView key={item.title} section={item} setTarget={setTarget} />)}
    <Editor target={target} onClose={() => setTarget(null)} />
  </div>;
}

export function ExternalFloodPraStepScreen({ stepId }: { stepId: string }): JSX.Element {
  if (stepId === "analysis-basis") return <AnalysisBasis />;
  return <TechnicalStep stepId={stepId} />;
}
