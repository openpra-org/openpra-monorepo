import {
  type HighWindsAnalysisRecord,
  type HighWindsPRA,
  type HighWindsPraApplication,
  type HighWindsRecordStatus,
} from "interfaces-mef-types/high-winds/high-winds-pra";
import { synchronizeHighWindsPraDerivedRegisters } from "interfaces-mef-types/high-winds/high-winds-pra-validation";
import { HighWindsPRASchema } from "interfaces-mef-types/zod/high-winds/high-winds-pra";
import { type JSX, useState } from "react";
import { POSIcon } from "../pos-workbooks/posIcons";
import { removeStructuredRecord, StructuredEditorDrawer, type EditorPath } from "../seismic-pra-workbooks/seismicPraStructuredEditor";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { HazardEventTreeEditor, HazardFaultTreeEditor } from "../workbooks/hazardConditionedModelEditors";
import { Drawer, Field, NumberInput, Section, SelectInput, TextArea, TextInput } from "./highWindsPraFields";
import { useHighWindsPraWorkbook } from "./highWindsPraWorkbookContext";
import "../seismic-pra-workbooks/css/seismicPra.css";

type SemanticRecord = HighWindsAnalysisRecord & Record<string, unknown>;
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

function statusTone(status: HighWindsRecordStatus): string {
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
  const { mef, editable, mutate } = useHighWindsPraWorkbook();
  if (target === null) return null;
  return <StructuredEditorDrawer
    eyebrow="High Winds PRA · Flat record editor"
    title={target.title}
    schema={HighWindsPRASchema}
    value={mef}
    editable={editable}
    initialFocus={target.focus}
    createAt={target.createAt}
    hiddenRootFields={HIDDEN_FIELDS}
    visibleRootFields={target.visibleRootFields}
    inlinePrimitiveArrays
    onClose={onClose}
    onApply={(value) => mutate(() => synchronizeHighWindsPraDerivedRegisters(value))}
    onRemove={target.removeLabel === undefined ? undefined : () => mutate((current) => synchronizeHighWindsPraDerivedRegisters(removeStructuredRecord(current, target.focus) as HighWindsPRA))}
    removeLabel={target.removeLabel}
  />;
}

function RecordTable({ records, section, onEdit }: { records: SemanticRecord[]; section: RecordSection; onEdit: (index: number) => void }): JSX.Element {
  if (records.length === 0) return <div className="flempty"><strong>{section.empty}</strong><p>Add a complete structured record with the section action.</p></div>;
  return <div className="fltablewrap"><table className="fltable" aria-label={section.title}><thead><tr><th>Record</th>{section.columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>Status</th><th><span className="sr-only">Edit</span></th></tr></thead><tbody>{records.map((record, index) => <tr key={record.uuid}><td><button type="button" className="fltable__record" onClick={() => onEdit(index)}><strong>{record.name}</strong><code>{record.code}</code></button></td>{section.columns.map((column) => <td key={`${record.uuid}-${column.key}`}>{display(record[column.key])}</td>)}<td><span className={`fltag ${statusTone(record.status)}`}>{record.status.replace(/_/g, " ")}</span></td><td><button type="button" className="fltable__edit" aria-label={`Edit ${record.name}`} onClick={() => onEdit(index)}><POSIcon.Pencil /></button></td></tr>)}</tbody></table></div>;
}

function RecordSectionView({ section, setTarget }: { section: RecordSection; setTarget: (target: EditorTarget) => void }): JSX.Element {
  const { mef, editable } = useHighWindsPraWorkbook();
  const records = (valueAt(mef, section.path) ?? []) as SemanticRecord[];
  return <Section title={section.title} actions={editable ? <AddButton label={`Add ${section.singular}`} onClick={() => setTarget(collectionTarget(section))} /> : undefined}><RecordTable records={records} section={section} onEdit={(index) => setTarget(collectionTarget(section, index))} /></Section>;
}

const section = (title: string, path: EditorPath, singular: string, columns: Array<{ label: string; key: string }>): RecordSection => ({ title, path, singular, empty: `No ${title.toLowerCase()} recorded`, columns });
const common = (root: string): RecordSection[] => [
  section("Model uncertainties", [root, "modelUncertainties"], "uncertainty", [{ label: "Type", key: "uncertaintyType" }, { label: "Affected records", key: "affectedRecordRefs" }, { label: "Potential impact", key: "potentialImpact" }, { label: "Importance", key: "importance" }]),
  section("Pre-operational assumptions", [root, "preOperationalAssumptions"], "assumption", [{ label: "Missing information", key: "missingDesignInformation" }, { label: "Closure action", key: "closureAction" }, { label: "Phase", key: "closurePhase" }, { label: "Status", key: "closureStatus" }]),
];

const STEP_CONFIG: Record<string, StepConfig> = {
  "hazard-screening": { root: "hazardScreening", sections: [
    section("High-wind hazard candidates", ["hazardScreening", "hazardCandidates"], "hazard candidate", [{ label: "Hazard", key: "hazardType" }, { label: "Wind effects", key: "potentialWindEffects" }, { label: "Site indicators", key: "siteCharacteristics" }, { label: "Disposition", key: "disposition" }]),
    section("Coexistent and combined hazards", ["hazardScreening", "hazardCombinations"], "hazard combination", [{ label: "Primary hazard", key: "primaryHazardType" }, { label: "Combined hazards", key: "combinedHazards" }, { label: "Relationship", key: "temporalRelationship" }, { label: "Disposition", key: "disposition" }]),
    section("Hazard screening decisions", ["hazardScreening", "screeningDecisions"], "screening decision", [{ label: "Objects", key: "screenedObjectRefs" }, { label: "Criterion", key: "criterion" }, { label: "Effects", key: "windEffects" }, { label: "Disposition", key: "disposition" }]),
    section("Aggregate screening checks", ["hazardScreening", "aggregateScreeningChecks"], "aggregate check", [{ label: "Objects", key: "screenedObjectRefs" }, { label: "Criterion", key: "criterion" }, { label: "Aggregate /yr", key: "aggregateFrequencyPerPlantYear" }, { label: "Disposition", key: "disposition" }]),
    section("Screening confirmations", ["hazardScreening", "confirmations"], "screening confirmation", [{ label: "Decision", key: "screeningDecisionRef" }, { label: "Plant basis", key: "plantConditionBasis" }, { label: "Confirmed", key: "confirmed" }, { label: "Discrepancies", key: "discrepancies" }]),
    section("Hazard investigations", ["hazardScreening", "investigations"], "investigation", [{ label: "Type", key: "investigationType" }, { label: "Locations", key: "locations" }, { label: "Date", key: "performedDate" }, { label: "Findings", key: "findingRefs" }]),
  ] },
  "wind-data": { root: "windDataAndReferenceBasis", sections: [
    section("Wind data sources", ["windDataAndReferenceBasis", "dataSources"], "data source", [{ label: "Type", key: "sourceType" }, { label: "Dataset or station", key: "stationOrDatasetId" }, { label: "Period", key: "periodStart" }, { label: "Completeness", key: "recordCompleteness" }]),
    section("Wind data adjustments", ["windDataAndReferenceBasis", "dataAdjustments"], "data adjustment", [{ label: "Source", key: "dataSourceRef" }, { label: "Adjustments", key: "adjustmentTypes" }, { label: "Output definition", key: "outputWindDefinition" }, { label: "Method", key: "method" }]),
    section("Reference wind definitions", ["windDataAndReferenceBasis", "referenceWindDefinitions"], "reference wind", [{ label: "Hazard", key: "hazardType" }, { label: "Parameter", key: "windParameter" }, { label: "Reference height (m)", key: "referenceHeightMetres" }, { label: "Analysis range", key: "upperAnalysisWindSpeed" }]),
    section("Data qualification checks", ["windDataAndReferenceBasis", "qualificationChecks"], "qualification check", [{ label: "Source", key: "dataSourceRef" }, { label: "Check", key: "checkType" }, { label: "Findings", key: "findings" }, { label: "Disposition", key: "disposition" }]),
  ] },
  "straight-wind": { root: "straightWindHazardAnalysis", sections: [
    section("Station assessments", ["straightWindHazardAnalysis", "stationAssessments"], "station assessment", [{ label: "Data source", key: "dataSourceRef" }, { label: "Distance (km)", key: "distanceToSiteKilometres" }, { label: "Record years", key: "recordYears" }, { label: "Retained", key: "retainedForAnalysis" }]),
    section("Climate components", ["straightWindHazardAnalysis", "climateComponents"], "climate component", [{ label: "Component", key: "componentType" }, { label: "Events", key: "eventCount" }, { label: "Threshold", key: "thresholdWindSpeed" }, { label: "Stations", key: "stationAssessmentRefs" }]),
    section("Extreme-value models", ["straightWindHazardAnalysis", "extremeValueModels"], "extreme-value model", [{ label: "Component", key: "climateComponentRef" }, { label: "Distribution", key: "distribution" }, { label: "Fit", key: "fittingMethod" }, { label: "Tests", key: "goodnessOfFitTests" }]),
    section("Station pooling models", ["straightWindHazardAnalysis", "poolingModels"], "pooling model", [{ label: "Method", key: "poolingMethod" }, { label: "Stations", key: "stationAssessmentRefs" }, { label: "Weights", key: "weights" }, { label: "Site derivation", key: "siteFrequencyDerivation" }]),
    section("Straight-wind hazard results", ["straightWindHazardAnalysis", "hazardResults"], "hazard result", [{ label: "Reference wind", key: "referenceWindDefinitionRef" }, { label: "Models", key: "modelRefs" }, { label: "Curve points", key: "curvePoints" }, { label: "Benchmarks", key: "benchmarkReferences" }]),
  ] },
  "tropical-cyclone": { root: "tropicalCycloneHazardAnalysis", sections: [
    section("Tropical-cyclone datasets", ["tropicalCycloneHazardAnalysis", "dataSets"], "tropical-cyclone dataset", [{ label: "Basin", key: "basin" }, { label: "Region", key: "coastalRegion" }, { label: "Record", key: "recordStartYear" }, { label: "Storms", key: "stormCount" }]),
    section("Occurrence models", ["tropicalCycloneHazardAnalysis", "occurrenceModels"], "occurrence model", [{ label: "Rate /yr", key: "annualOccurrenceRate" }, { label: "Intensity", key: "intensityDistribution" }, { label: "Genesis", key: "genesisModel" }, { label: "Datasets", key: "dataSetRefs" }]),
    section("Track models", ["tropicalCycloneHazardAnalysis", "trackModels"], "track model", [{ label: "Type", key: "modelType" }, { label: "Domain", key: "spatialDomain" }, { label: "Variables", key: "trackVariables" }, { label: "Validation", key: "validationMetrics" }]),
    section("Cyclone wind-field models", ["tropicalCycloneHazardAnalysis", "windFieldModels"], "wind-field model", [{ label: "Model", key: "windFieldModelName" }, { label: "Track", key: "trackModelRef" }, { label: "RMW model", key: "radiusOfMaximumWindsModel" }, { label: "Inland decay", key: "inlandDecayModel" }]),
    section("Cyclone simulations", ["tropicalCycloneHazardAnalysis", "simulations"], "simulation", [{ label: "Years", key: "simulatedYears" }, { label: "Storms", key: "simulatedStorms" }, { label: "Seed", key: "randomSeedReference" }, { label: "Convergence", key: "convergenceMetrics" }]),
    section("Tropical-cyclone hazard results", ["tropicalCycloneHazardAnalysis", "hazardResults"], "hazard result", [{ label: "Reference wind", key: "referenceWindDefinitionRef" }, { label: "Simulation", key: "simulationRef" }, { label: "Curve points", key: "curvePoints" }, { label: "Benchmarks", key: "benchmarkReferences" }]),
  ] },
  tornado: { root: "tornadoHazardAnalysis", sections: [
    section("Tornado datasets", ["tornadoHazardAnalysis", "dataSets"], "tornado dataset", [{ label: "Region", key: "geographicRegion" }, { label: "Record", key: "recordStartYear" }, { label: "Tornadoes", key: "tornadoCount" }, { label: "Rating scales", key: "damageRatingScales" }]),
    section("Tornado data corrections", ["tornadoHazardAnalysis", "dataCorrections"], "data correction", [{ label: "Dataset", key: "dataSetRef" }, { label: "Corrections", key: "correctionTypes" }, { label: "Before", key: "beforeEventCount" }, { label: "After", key: "afterEventCount" }]),
    section("Climatology regions", ["tornadoHazardAnalysis", "climatologyRegions"], "climatology region", [{ label: "Boundary", key: "boundaryDescription" }, { label: "Datasets", key: "dataSetRefs" }, { label: "Tests", key: "homogeneityTests" }, { label: "Broad enough", key: "sufficientlyBroadForRareEvents" }]),
    section("Occurrence and path models", ["tornadoHazardAnalysis", "occurrenceAndPathModels"], "occurrence and path model", [{ label: "Region", key: "climatologyRegionRef" }, { label: "Rate /yr", key: "annualOccurrenceRate" }, { label: "Intensity", key: "intensityDistribution" }, { label: "Path width", key: "pathWidthModel" }]),
    section("Damage-to-wind models", ["tornadoHazardAnalysis", "damageWindModels"], "damage-wind model", [{ label: "Occurrence model", key: "occurrenceAndPathModelRef" }, { label: "Indicators", key: "damageIndicatorTypes" }, { label: "Wind relation", key: "windSpeedGivenDamageRatingModel" }, { label: "Uncertainty", key: "ratingUncertaintyTreatment" }]),
    section("Tornado wind-field models", ["tornadoHazardAnalysis", "windFieldModels"], "tornado wind-field model", [{ label: "Damage model", key: "damageWindModelRef" }, { label: "Horizontal profile", key: "horizontalWindProfile" }, { label: "RMW model", key: "radiusOfMaximumWindsModel" }, { label: "APC model", key: "atmosphericPressureChangeModel" }]),
    section("Tornado target definitions", ["tornadoHazardAnalysis", "targetDefinitions"], "target definition", [{ label: "Type", key: "targetType" }, { label: "Plan area (m²)", key: "planAreaSquareMetres" }, { label: "Height (m)", key: "heightMetres" }, { label: "Locations", key: "locationRefs" }]),
    section("Tornado hazard results", ["tornadoHazardAnalysis", "hazardResults"], "hazard result", [{ label: "Reference wind", key: "referenceWindDefinitionRef" }, { label: "Target", key: "targetDefinitionRef" }, { label: "Curve points", key: "curvePoints" }, { label: "Missiles", key: "missileEffectIncluded" }]),
  ] },
  "hazard-integration": { root: "hazardIntegration", sections: [
    section("Hazard logic-tree branches", ["hazardIntegration", "logicTreeBranches"], "logic-tree branch", [{ label: "Hazard", key: "hazardType" }, { label: "Level", key: "branchLevel" }, { label: "Choice", key: "modelOrParameterChoice" }, { label: "Weight", key: "branchWeight" }]),
    section("Integrated hazard curves", ["hazardIntegration", "hazardCurves"], "hazard curve", [{ label: "Hazard", key: "hazardType" }, { label: "Curve type", key: "curveType" }, { label: "Points", key: "curvePoints" }, { label: "Tail basis", key: "truncationBasis" }]),
    section("Hazard intervals", ["hazardIntegration", "hazardIntervals"], "hazard interval", [{ label: "Hazard", key: "hazardType" }, { label: "Lower / upper", key: "lowerWindSpeed" }, { label: "Representative", key: "representativeWindSpeed" }, { label: "Frequency /yr", key: "intervalAnnualFrequency" }]),
    section("Hazard convergence studies", ["hazardIntegration", "convergenceStudies"], "convergence study", [{ label: "Intervals", key: "refinedIntervalCount" }, { label: "Upper speed", key: "upperWindSpeedTested" }, { label: "Relative difference", key: "relativeDifference" }, { label: "Converged", key: "converged" }]),
  ] },
  "preliminary-response": { root: "preliminaryPlantResponse", sections: [
    section("Preliminary wind initiating events", ["preliminaryPlantResponse", "preliminaryInitiatingEvents"], "initiating event", [{ label: "Initiator", key: "initiatingEventRef" }, { label: "Hazards", key: "hazardTypes" }, { label: "Cause", key: "causationType" }, { label: "Retained", key: "retainedInModel" }]),
    section("Baseline-model reviews", ["preliminaryPlantResponse", "modelReviews"], "model review", [{ label: "Review", key: "reviewType" }, { label: "Gap", key: "highWindsGap" }, { label: "Required change", key: "requiredChange" }, { label: "Closure", key: "closureStatus" }]),
    section("High Winds Equipment List", ["preliminaryPlantResponse", "highWindsEquipmentList"], "HWEL entry", [{ label: "SSC", key: "sscRef" }, { label: "Location", key: "building" }, { label: "Effects", key: "applicableWindEffects" }, { label: "Disposition", key: "disposition" }]),
  ] },
  investigation: { root: "plantInvestigationAndMissileSurvey", sections: [
    section("Plant investigations", ["plantInvestigationAndMissileSurvey", "investigations"], "investigation", [{ label: "Type", key: "investigationType" }, { label: "Scope", key: "scope" }, { label: "Locations", key: "locations" }, { label: "Date", key: "performedDate" }]),
    section("Investigation findings", ["plantInvestigationAndMissileSurvey", "findings"], "finding", [{ label: "Type", key: "findingType" }, { label: "Location", key: "location" }, { label: "Condition", key: "condition" }, { label: "Closure", key: "closureStatus" }]),
    section("Missile survey zones", ["plantInvestigationAndMissileSurvey", "missileSurveyZones"], "survey zone", [{ label: "Zone", key: "zoneType" }, { label: "Location", key: "location" }, { label: "Nearest target (m)", key: "nearestHwelSscDistanceMetres" }, { label: "Sources", key: "missileSourceRefs" }]),
    section("Wind missile sources", ["plantInvestigationAndMissileSurvey", "missileSources"], "missile source", [{ label: "Category", key: "sourceCategory" }, { label: "Shape", key: "missileShape" }, { label: "Mass (kg)", key: "representativeMassKilograms" }, { label: "Quantity", key: "quantityBestEstimate" }]),
    section("Missile population profiles", ["plantInvestigationAndMissileSurvey", "missilePopulationProfiles"], "population profile", [{ label: "Condition", key: "plantCondition" }, { label: "Annual fraction", key: "annualTimeFraction" }, { label: "Sources", key: "missileSourceRefs" }, { label: "Adjustments", key: "populationAdjustmentFactors" }]),
  ] },
  "fragility-basis": { root: "sscScreeningAndFragilityBasis", sections: [
    section("SSC screening decisions", ["sscScreeningAndFragilityBasis", "screeningDecisions"], "screening decision", [{ label: "Objects", key: "screenedObjectRefs" }, { label: "Effects", key: "windEffects" }, { label: "Criterion", key: "criterion" }, { label: "Disposition", key: "disposition" }]),
    section("Fragility method selections", ["sscScreeningAndFragilityBasis", "methodSelections"], "method selection", [{ label: "SSCs", key: "sscRefs" }, { label: "Effects", key: "windEffects" }, { label: "Method", key: "method" }, { label: "Information basis", key: "informationBasis" }]),
    section("Fragility correlation groups", ["sscScreeningAndFragilityBasis", "correlationGroups"], "correlation group", [{ label: "Members", key: "memberSscRefs" }, { label: "Effects", key: "windEffects" }, { label: "Model", key: "correlationModel" }, { label: "Coefficient", key: "correlationCoefficient" }]),
    section("Fragility aggregations", ["sscScreeningAndFragilityBasis", "fragilityAggregations"], "fragility aggregation", [{ label: "SSC", key: "sscRef" }, { label: "Components", key: "componentFragilityRefs" }, { label: "Method", key: "aggregationMethod" }, { label: "Result", key: "resultingFragilityRef" }]),
    section("Coexistent-hazard fragility assessments", ["sscScreeningAndFragilityBasis", "coexistentHazardAssessments"], "coexistent-hazard assessment", [{ label: "Primary", key: "primaryHazardType" }, { label: "Combined", key: "combinedHazards" }, { label: "Affected SSCs", key: "affectedSscRefs" }, { label: "Disposition", key: "disposition" }]),
  ] },
  "pressure-apc": { root: "pressureAndApcFragilityAnalysis", sections: [
    section("Building-envelope states", ["pressureAndApcFragilityAnalysis", "buildingEnvelopeStates"], "envelope state", [{ label: "Structure", key: "structureRef" }, { label: "State", key: "state" }, { label: "Opening area (m²)", key: "openingAreaSquareMetres" }, { label: "Internal Cp", key: "internalPressureCoefficient" }]),
    section("Wind-pressure load models", ["pressureAndApcFragilityAnalysis", "pressureLoadModels"], "pressure load model", [{ label: "SSC", key: "sscRef" }, { label: "Code basis", key: "codeOrStandardBasis" }, { label: "Directionality", key: "directionalityFactor" }, { label: "Dynamic", key: "dynamicResponseTreatment" }]),
    section("Atmospheric-pressure-change models", ["pressureAndApcFragilityAnalysis", "atmosphericPressureChangeModels"], "APC model", [{ label: "SSC", key: "sscRef" }, { label: "Pressure drop (Pa)", key: "pressureDropPascals" }, { label: "Rate (Pa/s)", key: "pressureChangeRatePascalsPerSecond" }, { label: "Combined method", key: "combinedWindAndApcLoadMethod" }]),
    section("Topography and shielding", ["pressureAndApcFragilityAnalysis", "topographyAndShieldingAssessments"], "topography and shielding assessment", [{ label: "Area", key: "siteArea" }, { label: "SSCs", key: "affectedSscRefs" }, { label: "Speed-up", key: "speedUpFactor" }, { label: "Negative shielding", key: "negativeShieldingDirections" }]),
    section("Pressure and APC fragility curves", ["pressureAndApcFragilityAnalysis", "fragilityCurves"], "fragility curve", [{ label: "SSC", key: "sscRef" }, { label: "Effects", key: "windEffects" }, { label: "Median speed", key: "medianCapacityWindSpeed" }, { label: "Curve points", key: "curvePoints" }]),
  ] },
  "missile-fragility": { root: "missileFragilityAnalysis", sections: [
    section("Missile categories", ["missileFragilityAnalysis", "missileCategories"], "missile category", [{ label: "Shape", key: "missileShape" }, { label: "Material", key: "material" }, { label: "Mass (kg)", key: "representativeMassKilograms" }, { label: "Hazards", key: "applicableHazardTypes" }]),
    section("Missile target models", ["missileFragilityAnalysis", "targetModels"], "target model", [{ label: "SSC", key: "sscRef" }, { label: "Area (m²)", key: "targetAreaSquareMetres" }, { label: "Elevation (m)", key: "targetElevationMetres" }, { label: "Damage modes", key: "damageModes" }]),
    section("Missile trajectory models", ["missileFragilityAnalysis", "trajectoryModels"], "trajectory model", [{ label: "Hazard", key: "hazardType" }, { label: "Dimension", key: "spatialDimension" }, { label: "Cutoff (m)", key: "sourceDistanceCutoffMetres" }, { label: "Simulations", key: "simulationCount" }]),
    section("Missile impact and damage", ["missileFragilityAnalysis", "impactAndDamageModels"], "impact and damage model", [{ label: "Target", key: "targetModelRef" }, { label: "Hit probability", key: "probabilityOfHit" }, { label: "Damage given hit", key: "probabilityOfDamageGivenHit" }, { label: "Damage criterion", key: "damageCriterion" }]),
    section("Missile simulation convergence", ["missileFragilityAnalysis", "convergenceStudies"], "convergence study", [{ label: "Trajectory", key: "trajectoryModelRef" }, { label: "Counts", key: "simulationCounts" }, { label: "Standard errors", key: "standardErrors" }, { label: "Converged", key: "converged" }]),
    section("Missile fragility curves", ["missileFragilityAnalysis", "fragilityCurves"], "fragility curve", [{ label: "SSC", key: "sscRef" }, { label: "Hazards", key: "hazardTypes" }, { label: "Median speed", key: "medianCapacityWindSpeed" }, { label: "Curve points", key: "curvePoints" }]),
  ] },
  "interaction-rain": { root: "interactionAndRainFragilityAnalysis", sections: [
    section("Structural interaction scenarios", ["interactionAndRainFragilityAnalysis", "structuralInteractionScenarios"], "interaction scenario", [{ label: "Source", key: "sourceStructureRef" }, { label: "Targets", key: "targetSscRefs" }, { label: "Type", key: "interactionType" }, { label: "Functions", key: "affectedFunctions" }]),
    section("Rain entry paths", ["interactionAndRainFragilityAnalysis", "rainEntryPaths"], "rain entry path", [{ label: "Structure", key: "structureRef" }, { label: "Path", key: "entryPathType" }, { label: "Opening (m²)", key: "openingAreaSquareMetres" }, { label: "Targets", key: "targetSscRefs" }]),
    section("Wind-driven-rain models", ["interactionAndRainFragilityAnalysis", "windDrivenRainModels"], "rain model", [{ label: "Hazards", key: "hazardTypes" }, { label: "Reference wind", key: "referenceWindDefinitionRef" }, { label: "Entry paths", key: "entryPathRefs" }, { label: "Duration", key: "durationModel" }]),
    section("Rain target vulnerabilities", ["interactionAndRainFragilityAnalysis", "rainTargetVulnerabilities"], "target vulnerability", [{ label: "SSC", key: "sscRef" }, { label: "Enclosure", key: "enclosureRating" }, { label: "Threshold", key: "failureThreshold" }, { label: "Fragility", key: "fragilityRef" }]),
    section("Interaction and rain fragilities", ["interactionAndRainFragilityAnalysis", "fragilityCurves"], "fragility curve", [{ label: "SSC", key: "sscRef" }, { label: "Effects", key: "windEffects" }, { label: "Median speed", key: "medianCapacityWindSpeed" }, { label: "Curve points", key: "curvePoints" }]),
  ] },
  "plant-response": { root: "plantResponseModel", sections: [
    section("Peer-review dispositions", ["plantResponseModel", "peerReviewDispositions"], "peer-review disposition", [{ label: "Source element", key: "sourcePraElement" }, { label: "Finding", key: "findingId" }, { label: "Relevance", key: "relevanceToHighWinds" }, { label: "Closure", key: "closureStatus" }]),
    section("High-wind initiating-event models", ["plantResponseModel", "initiatingEventModels"], "initiating-event model", [{ label: "Initiator", key: "initiatingEventRef" }, { label: "Hazards", key: "hazardTypes" }, { label: "Intervals", key: "hazardIntervalRefs" }, { label: "Frequency treatment", key: "frequencyTreatment" }]),
    section("High-wind event-sequence models", ["plantResponseModel", "eventSequenceModels"], "event-sequence model", [{ label: "Event tree", key: "eventTreeRef" }, { label: "Initiator", key: "initiatingEventModelRef" }, { label: "Sequences", key: "eventSequenceRefs" }, { label: "Release categories", key: "releaseCategoryRefs" }]),
    section("Wind success criteria", ["plantResponseModel", "successCriteria"], "success criterion", [{ label: "Function", key: "safetyFunctionRef" }, { label: "Criteria", key: "criterion" }, { label: "Intervals", key: "hazardIntervalRefs" }, { label: "Evidence", key: "analysisRefs" }]),
    section("System-model modifications", ["plantResponseModel", "systemModelModifications"], "system-model modification", [{ label: "System", key: "systemRef" }, { label: "SSCs", key: "affectedSscRefs" }, { label: "Change", key: "modification" }, { label: "Verified", key: "verificationRefs" }]),
    section("Mission times", ["plantResponseModel", "missionTimes"], "mission time", [{ label: "Function", key: "safetyFunctionRef" }, { label: "Hours", key: "missionTimeHours" }, { label: "Families", key: "eventSequenceFamilyRefs" }, { label: "Basis", key: "basis" }]),
    section("High-wind data parameters", ["plantResponseModel", "dataParameters"], "data parameter", [{ label: "Parameter", key: "parameterRef" }, { label: "Type", key: "parameterType" }, { label: "Mean", key: "meanValue" }, { label: "Distribution", key: "uncertaintyDistribution" }]),
    section("Coexistent-hazard response", ["plantResponseModel", "coexistentHazardAssessments"], "coexistent-hazard assessment", [{ label: "Primary", key: "primaryHazardType" }, { label: "Combined", key: "combinedHazards" }, { label: "Affected SSCs", key: "affectedSscRefs" }, { label: "Treatment", key: "plantResponseTreatment" }]),
    section("Multi-unit and multi-source response", ["plantResponseModel", "multiUnitAssessments"], "multi-unit assessment", [{ label: "Units", key: "affectedReactorUnitRefs" }, { label: "Shared SSCs", key: "sharedSscRefs" }, { label: "Resources", key: "sharedResourceRefs" }, { label: "Sequences", key: "eventSequenceRefs" }]),
  ] },
  "human-reliability": { root: "humanReliabilityAnalysis", sections: [
    section("High-wind human actions", ["humanReliabilityAnalysis", "humanActions"], "human action", [{ label: "Type", key: "actionType" }, { label: "Location", key: "actionLocation" }, { label: "Warning (min)", key: "warningTimeAvailableMinutes" }, { label: "Wind execution (min)", key: "highWindsExecutionTimeMinutes" }]),
    section("Human failure events", ["humanReliabilityAnalysis", "humanFailureEvents"], "human failure event", [{ label: "Action", key: "humanActionRef" }, { label: "Failure", key: "failureDescription" }, { label: "Sequences", key: "eventSequenceRefs" }, { label: "Exclusive recovery", key: "exclusiveRecovery" }]),
    section("High-wind performance contexts", ["humanReliabilityAnalysis", "performanceContexts"], "performance context", [{ label: "Action", key: "humanActionRef" }, { label: "Hazards", key: "hazardTypes" }, { label: "Weather", key: "weatherAndEnvironment" }, { label: "Access", key: "debrisAndAccess" }]),
    section("HEP estimates", ["humanReliabilityAnalysis", "hepEstimates"], "HEP estimate", [{ label: "HFE", key: "humanFailureEventRef" }, { label: "Method", key: "method" }, { label: "Nominal HEP", key: "nominalHep" }, { label: "Wind HEP", key: "highWindsHep" }]),
    section("Action confirmations", ["humanReliabilityAnalysis", "confirmations"], "action confirmation", [{ label: "Actions", key: "humanActionRefs" }, { label: "Type", key: "confirmationType" }, { label: "Procedure confirmed", key: "confirmedProcedureInterpretation" }, { label: "Model changes", key: "modelChanges" }]),
    section("Recovery assessments", ["humanReliabilityAnalysis", "recoveryAssessments"], "recovery assessment", [{ label: "Action", key: "humanActionRef" }, { label: "Source model", key: "sourceRecoveryModelRef" }, { label: "Remains valid", key: "remainsValidUnderHighWinds" }, { label: "Recovery value", key: "recoveryValue" }]),
    section("HRA dependencies", ["humanReliabilityAnalysis", "dependencyAssessments"], "dependency assessment", [{ label: "HFEs", key: "humanFailureEventRefs" }, { label: "Shared crews", key: "sharedCrews" }, { label: "Temporal relation", key: "temporalRelationship" }, { label: "Dependency", key: "dependencyLevel" }]),
  ] },
  quantification: { root: "eventSequenceQuantification", sections: [
    section("Quantification runs", ["eventSequenceQuantification", "quantificationRuns"], "quantification run", [{ label: "Model", key: "modelVersion" }, { label: "Hazards", key: "hazardTypes" }, { label: "Samples", key: "uncertaintySampleCount" }, { label: "Software", key: "softwareAndVersion" }]),
    section("Hazard-interval results", ["eventSequenceQuantification", "hazardIntervalResults"], "interval result", [{ label: "Interval", key: "hazardIntervalRef" }, { label: "Hazard", key: "hazardType" }, { label: "Sequence family", key: "eventSequenceFamilyRef" }, { label: "Frequency /yr", key: "sequenceFrequencyPerPlantYear" }]),
    section("Event-sequence-family results", ["eventSequenceQuantification", "eventSequenceFamilyResults"], "sequence-family result", [{ label: "Family", key: "eventSequenceFamilyRef" }, { label: "Hazards", key: "hazardTypes" }, { label: "Mean /yr", key: "meanFrequencyPerPlantYear" }, { label: "95th /yr", key: "ninetyFifthPercentileFrequencyPerPlantYear" }]),
    section("Quantification convergence", ["eventSequenceQuantification", "convergenceStudies"], "convergence study", [{ label: "Type", key: "studyType" }, { label: "Test values", key: "testedValues" }, { label: "Max difference", key: "maximumRelativeDifference" }, { label: "Converged", key: "converged" }]),
    section("Integrated uncertainty results", ["eventSequenceQuantification", "uncertaintyResults"], "uncertainty result", [{ label: "Metric", key: "riskMetric" }, { label: "Mean", key: "meanValue" }, { label: "5th", key: "fifthPercentile" }, { label: "95th", key: "ninetyFifthPercentile" }]),
    section("Risk contributors", ["eventSequenceQuantification", "riskContributors"], "risk contributor", [{ label: "Type", key: "contributorType" }, { label: "Contributor", key: "contributorRef" }, { label: "Fraction", key: "fractionalContribution" }, { label: "Rank", key: "rank" }]),
    section("Quantification screening decisions", ["eventSequenceQuantification", "screeningDecisions"], "screening decision", [{ label: "Objects", key: "screenedObjectRefs" }, { label: "Criterion", key: "criterion" }, { label: "Aggregate /yr", key: "aggregateFrequencyPerPlantYear" }, { label: "Disposition", key: "disposition" }]),
  ] },
  "risk-interpretation": { root: "riskInterpretation", sections: [
    section("High Winds risk insights", ["riskInterpretation", "riskInsights"], "risk insight", [{ label: "Type", key: "insightType" }, { label: "Contributors", key: "contributorRefs" }, { label: "Risk metric", key: "affectedRiskMetric" }, { label: "Implication", key: "decisionImplication" }]),
    section("Model refinements", ["riskInterpretation", "refinementActions"], "refinement", [{ label: "Area", key: "technicalArea" }, { label: "Priority", key: "priority" }, { label: "Refinement", key: "refinement" }, { label: "Status", key: "refinementStatus" }]),
    section("Refinement iterations", ["riskInterpretation", "quantificationIterations"], "iteration", [{ label: "Model", key: "modelVersion" }, { label: "Aggregate /yr", key: "aggregateMeanFrequencyPerPlantYear" }, { label: "Change", key: "relativeChange" }, { label: "Decision", key: "decision" }]),
    section("Risk Integration results", ["riskInterpretation", "integrationResults"], "integration result", [{ label: "Model", key: "modelVersion" }, { label: "Aggregate /yr", key: "aggregateMeanFrequencyPerPlantYear" }, { label: "Release categories", key: "releaseCategoryRefs" }, { label: "Status", key: "integrationStatus" }]),
    section("Risk-informed decisions", ["riskInterpretation", "riskDecisions"], "risk decision", [{ label: "Type", key: "decisionType" }, { label: "Action", key: "action" }, { label: "Disposition", key: "disposition" }, { label: "Reanalysis", key: "reanalysisRequired" }]),
    section("End-to-end traceability", ["riskInterpretation", "traceabilityPaths"], "traceability path", [{ label: "Hazard curves", key: "hazardCurveRefs" }, { label: "Fragilities", key: "fragilityRefs" }, { label: "Results", key: "resultRefs" }, { label: "Complete", key: "complete" }]),
    section("Controlled baselines", ["riskInterpretation", "controlledBaselines"], "controlled baseline", [{ label: "Model", key: "modelVersion" }, { label: "Run", key: "quantificationRunRef" }, { label: "Control record", key: "configurationControlRecordId" }, { label: "Status", key: "releaseStatus" }]),
  ] },
  "technical-closure": { root: "technicalClosure", sections: [
    section("Conformance reviews", ["technicalClosure", "conformanceReviews"], "conformance review", [{ label: "Record", key: "name" }, { label: "Result", key: "description" }, { label: "Basis", key: "basis" }, { label: "Status", key: "status" }]),
    section("Documentation checks", ["technicalClosure", "documentationChecks"], "documentation check", [{ label: "Check", key: "name" }, { label: "Result", key: "description" }, { label: "Evidence", key: "evidenceRefs" }, { label: "Status", key: "status" }]),
    section("Interface closure checks", ["technicalClosure", "interfaceClosureChecks"], "interface closure check", [{ label: "Check", key: "name" }, { label: "Result", key: "description" }, { label: "Related records", key: "relatedRefs" }, { label: "Status", key: "status" }]),
    section("Peer-review team", ["technicalClosure", "peerReviewTeam"], "team member", [{ label: "Role", key: "role" }, { label: "Organization", key: "organization" }, { label: "Qualifications", key: "qualifications" }, { label: "Scope", key: "reviewScope" }]),
    section("Peer-review findings", ["technicalClosure", "peerReviewFindings"], "peer-review finding", [{ label: "Area", key: "reviewArea" }, { label: "Category", key: "findingCategory" }, { label: "Significance", key: "significance" }, { label: "Closure", key: "closureStatus" }]),
    section("Readiness checks", ["technicalClosure", "readinessChecks"], "readiness check", [{ label: "Check", key: "name" }, { label: "Result", key: "description" }, { label: "Evidence", key: "evidenceRefs" }, { label: "Status", key: "status" }]),
  ] },
};

interface InterfaceEditorSelection { interfaceIndex: number; transferIndex: number }

const INTERFACE_PRIMARY_COLUMNS: Record<HighWindsPRA["analysisBasis"]["interfaces"][number]["payloadType"], string> = {
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
  HIGH_WIND_EQUIPMENT_LIST: "High Winds Equipment List item",
  COEXISTENT_HAZARD: "Stored internal-flood model or source",
  SEQUENCE_FAMILY_RESULT: "High Winds event-sequence family",
  RISK_CONTRIBUTOR: "Risk contributor",
};

function TechnicalInterfaceEditor({ selection, onClose }: { selection: InterfaceEditorSelection; onClose: () => void }): JSX.Element {
  const { mef, mutate } = useHighWindsPraWorkbook();
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
      targetInterface.direction = direction; targetInterface.role = role.trim(); targetInterface.producer = direction === "INPUT" ? targetInterface.technicalElementCode : "W"; targetInterface.consumer = direction === "INPUT" ? "W" : targetInterface.technicalElementCode;
      Object.assign(targetTransfer, { name: name.trim(), recordRef: recordRef.trim(), sourceModelRef: sourceModelRef.trim(), destinationRefs: technicalList(destinationRefs), evidenceRefs: technicalList(evidenceRefs), status, values });
      targetInterface.producerRefs = targetInterface.transferItems.map((item) => item.recordRef); targetInterface.consumerRefs = Array.from(new Set(targetInterface.transferItems.flatMap((item) => item.destinationRefs)));
      return synchronizeHighWindsPraDerivedRegisters(next);
    });
    onClose();
  }
  return <Drawer title="Technical-element transfer record" onClose={onClose} footer={<><button type="button" className="posnav__btn" onClick={onClose}>Cancel</button><span className="fldrawer__footer-spacer" /><button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save changes</button></>}>
    <div className="sinlineeditor__body"><div className="sinlineeditor__group"><WorkbookSectionHeading title="Technical-element handoff" className="sinlineeditor__title" /><div className="sinlineeditor__grid"><Field label="Technical element"><TextInput value={`${sourceInterface.technicalElementCode} · ${sourceInterface.technicalElementName}`} disabled onChange={() => undefined} /></Field><Field label="Direction"><SelectInput value={direction} options={[{ value: "INPUT", label: "Input to High Winds PRA" }, { value: "OUTPUT", label: "Output from High Winds PRA" }]} onChange={(value) => setDirection(value as typeof direction)} /></Field><Field label="Interface role" wide><TextArea rows={3} value={role} onChange={setRole} /></Field></div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="Transferred record" className="sinlineeditor__title" /><div className="sinlineeditor__grid"><Field label="Record name" wide><TextInput value={name} onChange={setName} /></Field><Field label="Record reference"><TextInput value={recordRef} onChange={setRecordRef} /></Field><Field label="Transfer status"><SelectInput value={status} options={["CONTROLLED", "WORKING", "OPEN"].map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() }))} onChange={(value) => setStatus(value as typeof status)} /></Field><Field label="Source model or revision" wide><TextInput value={sourceModelRef} onChange={setSourceModelRef} /></Field><Field label="Destination records" wide><TextArea rows={4} value={destinationRefs} onChange={setDestinationRefs} /></Field><Field label="Evidence references" wide><TextArea rows={3} value={evidenceRefs} onChange={setEvidenceRefs} /></Field></div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="Transferred values" className="sinlineeditor__title" /><div className="sinlineeditor__grid">{sourceInterface.columns.map((column, index) => <Field key={column} label={column} wide><TextArea rows={2} value={values[index] ?? ""} onChange={(value) => setValues((current) => sourceInterface.columns.map((_, candidate) => candidate === index ? value : current[candidate] ?? ""))} /></Field>)}</div></div></div>
  </Drawer>;
}

function Interfaces({ setTarget, onEdit }: { setTarget: (target: EditorTarget) => void; onEdit: (selection: InterfaceEditorSelection) => void }): JSX.Element {
  const { mef, editable } = useHighWindsPraWorkbook();
  const [selected, setSelected] = useState<number | null>(null);
  const current = selected === null ? undefined : mef.analysisBasis.interfaces[selected];
  return <Section title="Interfaces" actions={editable ? <AddButton label="Add interface" onClick={() => setTarget({ title: "Add technical-element interface", focus: [], createAt: ["analysisBasis", "interfaces"] })} /> : undefined}>
    <div className="poshandoff__grid">{mef.analysisBasis.interfaces.map((item, index) => <button key={item.uuid} type="button" className={`poshandoff__tile${selected === index ? " poshandoff__tile--active" : ""}`} onClick={() => setSelected(selected === index ? null : index)}><span className="poshandoff__tile-code">{item.direction === "INPUT" ? `${item.technicalElementCode} → W` : `W → ${item.technicalElementCode}`}</span><span className="poshandoff__tile-name">{item.technicalElementName}</span><span className="poshandoff__tile-role">{item.direction === "INPUT" ? "Receives" : "Provides"} · {item.role}</span></button>)}</div>
    {mef.analysisBasis.interfaces.length === 0 && <div className="flempty"><strong>No technical-element interfaces recorded</strong><p>Add the inputs from HSA, POS, IE, ES, SC, SY, HR, DA, and the outputs to ESQ and RI.</p></div>}
    {current !== undefined && selected !== null && <div className="sinterface__details"><div className="sinterface__flow-title">{current.direction === "INPUT" ? `High Winds PRA receives ${current.role.toLowerCase()} from ${current.technicalElementName}` : `${current.technicalElementName} receives ${current.role.toLowerCase()} from High Winds PRA`}</div><div className="sinterface__table-wrap"><table className="postable postable--mid flinterface-table"><thead><tr><th>{INTERFACE_PRIMARY_COLUMNS[current.payloadType]}</th>{current.columns.map((column) => <th key={column}>{column}</th>)}<th>Status</th><th /></tr></thead><tbody>{current.transferItems.length === 0 ? <tr><td colSpan={current.columns.length + 3}>No controlled transfer records are available.</td></tr> : current.transferItems.map((item, transferIndex) => <tr key={item.uuid}><td className="stable__key"><strong>{item.name}</strong><small className="flcellnote">{item.recordRef} · {item.sourceModelRef}</small></td>{current.columns.map((column, columnIndex) => <td key={`${item.uuid}-${column}`}>{item.values[columnIndex] ?? "—"}</td>)}<td><span className={`fltag ${item.status === "CONTROLLED" ? "fltag--good" : "fltag--warn"}`}>{item.status}</span></td><td>{editable && <button type="button" className="fltable__edit" aria-label={`Edit ${item.name}`} onClick={() => onEdit({ interfaceIndex: selected, transferIndex })}><POSIcon.Pencil /></button>}</td></tr>)}</tbody></table></div></div>}
  </Section>;
}

type ScopeDraft = {
  applicationName: string; purpose: string; decisionContext: string; supportedRiskMetrics: string; plantName: string; siteName: string;
  vendor: string; reactorType: string; thermalPower: string; numberOfModules: number; praScope: string; capabilityCategory: NonNullable<HighWindsPRA["capabilityCategory"]>; plantStage: HighWindsPRA["plantStage"];
};
function technicalList(value: string): string[] { return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean); }
function defaultApplication(owner: string): HighWindsPraApplication {
  return { uuid: crypto.randomUUID(), code: "W-APP-001", name: "", description: "", basis: "", owner, status: "DRAFT", evidenceRefs: [], relatedRefs: [], assumptionRefs: [], implementsSrs: [], purpose: "", decisionContext: "", supportedRiskMetrics: [], consumingElementRefs: [], configurationBasis: "", limitations: [] };
}

function AnalysisScopeEditor({ onClose }: { onClose: () => void }): JSX.Element {
  const { mef, editable, mutate } = useHighWindsPraWorkbook();
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
      const saved = { ...(next.analysisBasis.applications[0] ?? defaultApplication(next.owner ?? "High Winds PRA Team")), name: draft.applicationName, purpose: draft.purpose, description: draft.purpose, decisionContext: draft.decisionContext, basis: draft.decisionContext, supportedRiskMetrics: technicalList(draft.supportedRiskMetrics) };
      next.analysisBasis.applications = [saved, ...next.analysisBasis.applications.slice(1)];
      next.metadata.plantIdentity = { ...(next.metadata.plantIdentity ?? identity), name: draft.plantName, siteName: draft.siteName, vendor: draft.vendor, reactorType: draft.reactorType, thermalPower: draft.thermalPower, numberOfModules: Math.max(1, Math.round(draft.numberOfModules)) };
      next.praScope = draft.praScope; next.metadata.scope = draft.praScope; next.capabilityCategory = draft.capabilityCategory; next.plantStage = draft.plantStage;
      return synchronizeHighWindsPraDerivedRegisters(next);
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
  const { mef, editable } = useHighWindsPraWorkbook();
  const [target, setTarget] = useState<EditorTarget | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [interfaceEditor, setInterfaceEditor] = useState<InterfaceEditorSelection | null>(null);
  const site = mef.analysisBasis.siteBasis;
  const baseline = mef.analysisBasis.baselinePra;
  const scopeSection = section("Analysis scope records", ["analysisBasis", "scopeRecords"], "scope record", [{ label: "Hazards", key: "hazardTypes" }, { label: "Effects", key: "windEffects" }, { label: "Operating states", key: "includedOperatingStateRefs" }, { label: "Risk metrics", key: "riskMetrics" }]);
  const applicationSection = section("PRA applications", ["analysisBasis", "applications"], "application", [{ label: "Purpose", key: "purpose" }, { label: "Decision", key: "decisionContext" }, { label: "Metrics", key: "supportedRiskMetrics" }, { label: "Consumers", key: "consumingElementRefs" }]);
  const evidenceSection = section("Controlled evidence", ["analysisBasis", "evidenceRegister"], "evidence record", [{ label: "Type", key: "evidenceType" }, { label: "Source", key: "sourceReference" }, { label: "Subelements", key: "applicableSubelements" }, { label: "Controlled", key: "controlled" }]);
  return <div className="flstep">
    <Section title="PRA analysis and scope" actions={editable ? <EditButton label="Edit analysis scope" onClick={() => setScopeOpen(true)} /> : undefined}><div className="sanalysisbasis"><AnalysisRow label="Intended application" value={mef.analysisBasis.applications[0]?.name} /><AnalysisRow label="Purpose" value={mef.analysisBasis.applications[0]?.purpose} /><AnalysisRow label="Decision supported" value={mef.analysisBasis.applications[0]?.decisionContext} /><AnalysisRow label="PRA scope" value={mef.praScope} /><AnalysisRow label="Capability category" value={mef.capabilityCategory} /><AnalysisRow label="Plant stage" value={mef.plantStage} /><AnalysisRow label="Reference plant and site" value={[mef.metadata.plantIdentity?.name, mef.metadata.plantIdentity?.siteName].filter(Boolean)} /><AnalysisRow label="Operating states" value={baseline?.plantOperatingStateRefs} /><AnalysisRow label="Radioactive-material sources" value={baseline?.radioactiveMaterialSourceRefs} /><AnalysisRow label="Risk measures and endpoints" value={mef.analysisBasis.applications[0]?.supportedRiskMetrics} /></div></Section>
    <Section title="Site basis" actions={editable ? <EditButton label="Edit site basis" onClick={() => setTarget({ title: "High Winds site basis", focus: ["analysisBasis", "siteBasis"] })} /> : undefined}><div className="sanalysisbasis"><AnalysisRow label="Site" value={site?.siteName} /><AnalysisRow label="Basis type" value={site?.siteBasisType} /><AnalysisRow label="Selection status" value={site?.siteSelectionStatus} /><AnalysisRow label="Location" value={site === undefined ? "" : [site.latitudeDegrees, site.longitudeDegrees].filter((item) => item !== undefined).join(", ")} /><AnalysisRow label="Terrain and topography" value={site?.terrainAndTopographyDescription} /><AnalysisRow label="Operating states" value={site?.plantOperatingStateRefs} /></div></Section>
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
  const { mef, editable, mutate } = useHighWindsPraWorkbook();
  const [target, setTarget] = useState<EditorTarget | null>(null);
  const config = STEP_CONFIG[stepId];
  if (config === undefined) return <div className="flempty"><strong>Step configuration unavailable</strong></div>;
  const recordSections = config.root === "riskInterpretation" ? config.sections : [...config.sections, ...common(config.root)];
  const updateModels = (hazardConditionedModels: HighWindsPRA["hazardConditionedModels"]): void => mutate((current) => ({ ...current, hazardConditionedModels }));
  return <div className="flstep">
    {stepId === "plant-response" && <>
      <Section title="Hazard-conditioned initiating-event fault trees"><HazardFaultTreeEditor models={mef.hazardConditionedModels} editable={editable} onChange={updateModels} /></Section>
      <Section title="Hazard-conditioned event trees"><HazardEventTreeEditor models={mef.hazardConditionedModels} editable={editable} onChange={updateModels} /></Section>
    </>}
    {recordSections.map((item) => <RecordSectionView key={item.title} section={item} setTarget={setTarget} />)}
    <Editor target={target} onClose={() => setTarget(null)} />
  </div>;
}

export function HighWindsPraStepScreen({ stepId }: { stepId: string }): JSX.Element {
  if (stepId === "analysis-basis") return <AnalysisBasis />;
  return <TechnicalStep stepId={stepId} />;
}
