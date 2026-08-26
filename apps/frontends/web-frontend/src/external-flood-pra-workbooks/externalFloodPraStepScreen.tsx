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
import { HazardBayesianNetworkEditor, HazardEventTreeEditor, HazardFaultTreeEditor } from "../workbooks/hazardConditionedModelEditors";
import { Drawer, Field, NumberInput, Section, SelectInput, TextArea, TextInput } from "./externalFloodPraFields";
import { useExternalFloodPraWorkbook } from "./externalFloodPraWorkbookContext";
import "../seismic-pra-workbooks/css/seismicPra.css";

type SemanticRecord = ExternalFloodAnalysisRecord & Record<string, unknown>;
interface RecordSection { title: string; description: string; path: EditorPath; singular: string; empty: string; columns: Array<{ label: string; key: string }> }
interface StepConfig { root: string; sections: RecordSection[] }
interface EditorTarget { title: string; subtitle: string; focus: EditorPath; createAt?: EditorPath; removeLabel?: string; visibleRootFields?: string[] }

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
    ? { title: `Add ${section.singular}`, subtitle: section.description, focus: [], createAt: section.path }
    : { title: `Edit ${section.singular}`, subtitle: section.description, focus: [...section.path, index], removeLabel: `Remove ${section.singular}` };
}

function Editor({ target, onClose }: { target: EditorTarget | null; onClose: () => void }): JSX.Element | null {
  const { mef, editable, mutate } = useExternalFloodPraWorkbook();
  if (target === null) return null;
  return <StructuredEditorDrawer
    eyebrow="External Flood PRA · Flat record editor"
    title={target.title}
    subtitle={target.subtitle}
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
  return <Section title={section.title} description={section.description} actions={editable ? <AddButton label={`Add ${section.singular}`} onClick={() => setTarget(collectionTarget(section))} /> : undefined}><RecordTable records={records} section={section} onEdit={(index) => setTarget(collectionTarget(section, index))} /></Section>;
}

const section = (title: string, description: string, path: EditorPath, singular: string, columns: Array<{ label: string; key: string }>): RecordSection => ({ title, description, path, singular, empty: `No ${title.toLowerCase()} recorded`, columns });
const common = (root: string): RecordSection[] => [
  section("Model uncertainties", "Record influential parameter, model, and assumption uncertainty, reasonable alternatives, treatment, sensitivity, and importance.", [root, "modelUncertainties"], "uncertainty", [{ label: "Type", key: "uncertaintyType" }, { label: "Affected records", key: "affectedRecordRefs" }, { label: "Potential impact", key: "potentialImpact" }, { label: "Importance", key: "importance" }]),
  section("Pre-operational assumptions", "Control missing design information with an explicit limitation, closure action, lifecycle phase, and closure status.", [root, "preOperationalAssumptions"], "assumption", [{ label: "Missing information", key: "missingDesignInformation" }, { label: "Closure action", key: "closureAction" }, { label: "Phase", key: "closurePhase" }, { label: "Status", key: "closureStatus" }]),
];


const XF_STEP_CONFIG: Record<string, StepConfig> = {
  "site-evidence": { root: "analysisBasis", sections: [
    section("Controlled evidence", "Controls the standards, hydrometeorological data, surveys, drawings, calculations, models, investigations, procedures, and operating experience used throughout XFHA, XFFR, and XFPR.", ["analysisBasis", "evidenceRegister"], "evidence record", [{ label: "Type", key: "evidenceType" }, { label: "Source", key: "sourceReference" }, { label: "Application", key: "applicability" }, { label: "Controlled", key: "controlled" }]),
    section("Model uncertainties", "Records site-basis parameter, model, and assumption uncertainty, reasonable alternatives, treatment, sensitivities, and importance.", ["analysisBasis", "modelUncertainties"], "uncertainty", [{ label: "Type", key: "uncertaintyType" }, { label: "Affected records", key: "affectedRecordRefs" }, { label: "Potential impact", key: "potentialImpact" }, { label: "Importance", key: "importance" }]),
    section("Pre-operational assumptions", "Controls missing survey or design information with a conservative limitation, closure action, phase, and owner-visible status.", ["analysisBasis", "preOperationalAssumptions"], "assumption", [{ label: "Missing information", key: "missingDesignInformation" }, { label: "Closure action", key: "closureAction" }, { label: "Phase", key: "closurePhase" }, { label: "Status", key: "closureStatus" }]),
  ] },
  "hazard-screening": { root: "hazardScreening", sections: [
    section("External-flood hazard candidates", "Identifies precipitation, riverine, dam/impoundment, surge, seiche, tsunami, groundwater, wave, ice, and other site-relevant mechanisms with their sources, effects, and disposition.", ["hazardScreening", "hazardCandidates"], "hazard candidate", [{ label: "Hazard", key: "hazardType" }, { label: "Sources", key: "sourceLocations" }, { label: "Flood effects", key: "floodEffects" }, { label: "Disposition", key: "disposition" }]),
    section("Causal and coincident combinations", "Retains shared storm, seismic, hydrologic, water-level, debris, access, and other combinations while preventing frequency and consequence double counting.", ["hazardScreening", "hazardCombinations"], "hazard combination", [{ label: "Primary", key: "primaryHazardType" }, { label: "Combined hazards", key: "combinedHazards" }, { label: "Relationship", key: "relationship" }, { label: "Disposition", key: "disposition" }]),
    section("Hazard screening decisions", "Applies the approved physical, frequency, and consequence screening criteria with conservative assumptions and affected sequence families explicit.", ["hazardScreening", "screeningDecisions"], "screening decision", [{ label: "Hazards", key: "hazardTypes" }, { label: "Criterion", key: "criterion" }, { label: "Value", key: "quantitativeValue" }, { label: "Disposition", key: "disposition" }]),
    section("Aggregate screening checks", "Demonstrates that screened mechanisms remain below the approved criterion when their non-overlapping contributions are conservatively aggregated.", ["hazardScreening", "aggregateScreeningChecks"], "aggregate check", [{ label: "Objects", key: "screenedObjectRefs" }, { label: "Aggregate /yr", key: "aggregateFrequencyPerPlantYear" }, { label: "Threshold", key: "threshold" }, { label: "Disposition", key: "disposition" }]),
    section("Configuration confirmations", "Confirms each screening basis against the controlled site, design, surveys, drawings, and investigation evidence and records any resolution.", ["hazardScreening", "confirmations"], "confirmation", [{ label: "Decision", key: "screeningDecisionRef" }, { label: "Method", key: "confirmationMethod" }, { label: "Confirmed", key: "confirmed" }, { label: "Discrepancies", key: "discrepancies" }]),
    section("Screening investigations", "Records reconnaissance, surveys, interviews, and document reviews used to confirm hazard sources, water connections, grades, drainage, and access.", ["hazardScreening", "investigations"], "investigation", [{ label: "Type", key: "investigationType" }, { label: "Locations", key: "locations" }, { label: "Date", key: "performedDate" }, { label: "Findings", key: "findingRefs" }]),
  ] },
  "site-model": { root: "siteFloodModel", sections: [
    section("Site flood data sources", "Qualifies gages, precipitation frequency, terrain, bathymetry, dam records, paleoflood evidence, remote sensing, and site monitoring used by the flood models.", ["siteFloodModel", "dataSources"], "data source", [{ label: "Type", key: "sourceType" }, { label: "Dataset", key: "datasetId" }, { label: "Period", key: "periodStart" }, { label: "Completeness", key: "recordCompleteness" }]),
    section("Common site parameters", "Controls elevation, roughness, infiltration, drainage, soil, bathymetry, boundary, and groundwater parameters with distributions and source references.", ["siteFloodModel", "siteParameters"], "site parameter", [{ label: "Type", key: "parameterType" }, { label: "Location", key: "location" }, { label: "Value", key: "value" }, { label: "Bounds", key: "upperBound" }]),
    section("Datum conversions", "Reconciles legacy, survey, project, river, dam, and model elevations to one controlled horizontal and vertical datum.", ["siteFloodModel", "datumConversions"], "datum conversion", [{ label: "Source datum", key: "sourceDatum" }, { label: "Target datum", key: "targetDatum" }, { label: "Offset (m)", key: "verticalOffsetMetres" }, { label: "Verification", key: "verificationRef" }]),
    section("Hydrologic assumptions", "Records loss, moisture, drainage, blockage, tailwater, snowmelt, and other common assumptions with parameter values and sensitivity links.", ["siteFloodModel", "hydrologicAssumptions"], "hydrologic assumption", [{ label: "Process", key: "process" }, { label: "Assumption", key: "assumption" }, { label: "Parameters", key: "parameterValues" }, { label: "Sensitivity", key: "sensitivityRef" }]),
    section("Numerical flood models", "Controls software, domain, dimensionality, resolution, time step, boundaries, calibration, verification, and qualification for each hydraulic model.", ["siteFloodModel", "numericalModels"], "numerical model", [{ label: "Software", key: "software" }, { label: "Model type", key: "modelType" }, { label: "Resolution (m)", key: "gridResolutionMetres" }, { label: "Quality", key: "qualityStatus" }]),
    section("Data and model qualification checks", "Records applicability, currentness, datum, completeness, calibration, verification, and independent-check acceptance and disposition.", ["siteFloodModel", "qualificationChecks"], "qualification check", [{ label: "Subject", key: "subjectRef" }, { label: "Check", key: "checkType" }, { label: "Findings", key: "findings" }, { label: "Disposition", key: "disposition" }]),
  ] },
  lip: { root: "localIntensePrecipitationAnalysis", sections: [
    section("Precipitation-frequency inputs", "Defines duration, annual exceedance probability, depth, temporal pattern, areal reduction, climate adjustment, and uncertainty for each analyzed storm.", ["localIntensePrecipitationAnalysis", "precipitationInputs"], "precipitation input", [{ label: "Duration (h)", key: "durationHours" }, { label: "AEP", key: "annualExceedanceProbability" }, { label: "Depth (mm)", key: "depthMillimetres" }, { label: "Uncertainty (%)", key: "uncertaintyPercent" }]),
    section("Drainage catchments", "Defines contributing area, slope, imperviousness, infiltration, drainage capacity, inlets, overflow paths, and target locations.", ["localIntensePrecipitationAnalysis", "drainageCatchments"], "catchment", [{ label: "Area (m²)", key: "areaSquareMetres" }, { label: "Impervious", key: "imperviousFraction" }, { label: "Drain capacity", key: "drainageCapacityCubicMetresPerSecond" }, { label: "Targets", key: "targetLocationRefs" }]),
    section("LIP hydraulic models", "Couples rainfall, catchments, surface routing, inlet capture, drainage, blockage, tailwater, openings, duration, and mass balance.", ["localIntensePrecipitationAnalysis", "hydraulicModels"], "hydraulic model", [{ label: "Model", key: "numericalModelRef" }, { label: "Drain availability", key: "drainageAvailability" }, { label: "Blocked inlets", key: "blockedInletFraction" }, { label: "Mass balance (%)", key: "massBalanceErrorPercent" }]),
    section("Surface flow paths", "Traces roadway, curb, swale, drain, culvert, channel, and opening flow from catchments to plant locations.", ["localIntensePrecipitationAnalysis", "surfaceFlowPaths"], "surface flow path", [{ label: "Origin", key: "origin" }, { label: "Destination", key: "destination" }, { label: "Type", key: "pathwayType" }, { label: "Capacity", key: "capacityCubicMetresPerSecond" }]),
    section("Local precipitation hazard results", "Provides location-specific elevation, depth, velocity, arrival, duration, warning, debris, erosion, and model references for plant response.", ["localIntensePrecipitationAnalysis", "hazardResults"], "hazard result", [{ label: "Location", key: "location" }, { label: "AEP", key: "annualExceedanceProbability" }, { label: "Depth (m)", key: "depthMetres" }, { label: "Duration (h)", key: "durationHours" }]),
  ] },
  riverine: { root: "riverineFloodAnalysis", sections: [
    section("Watershed models", "Defines basin area, gages, rainfall-runoff, losses, routing, snowmelt, calibration events, tributaries, and downstream boundaries.", ["riverineFloodAnalysis", "watershedModels"], "watershed model", [{ label: "Area (km²)", key: "watershedAreaSquareKilometres" }, { label: "Hydrologic model", key: "hydrologicModel" }, { label: "Routing", key: "routingMethod" }, { label: "Calibration events", key: "calibrationEvents" }]),
    section("River discharge-frequency analyses", "Develops peak-flow frequency using systematic, historical, regional, and paleoflood information with outlier, skew, confidence, and regulation treatment.", ["riverineFloodAnalysis", "frequencyAnalyses"], "frequency analysis", [{ label: "Method", key: "method" }, { label: "Years", key: "recordYears" }, { label: "AEPs", key: "annualExceedanceProbabilities" }, { label: "Peak discharges", key: "peakDischargesCubicMetresPerSecond" }]),
    section("Stage-discharge models", "Converts rare discharge to water level and velocity with roughness, structures, backwater, ice, and sediment treatment.", ["riverineFloodAnalysis", "stageDischargeModels"], "stage-discharge model", [{ label: "Location", key: "riverLocation" }, { label: "Model", key: "hydraulicModelRef" }, { label: "Discharges", key: "dischargesCubicMetresPerSecond" }, { label: "Stages", key: "stagesMetres" }]),
    section("Levee assessments", "Evaluates crest, condition, overtopping, underseepage, internal erosion, breach, fragility, and interior drainage.", ["riverineFloodAnalysis", "leveeAssessments"], "levee assessment", [{ label: "Location", key: "leveeLocation" }, { label: "Crest (m)", key: "crestElevationMetres" }, { label: "Failure modes", key: "failureModes" }, { label: "Fragility", key: "fragilityRef" }]),
    section("Riverine hazard results", "Provides location-specific river water level, depth, velocity, duration, warning, debris, sediment, ice, and erosion outputs.", ["riverineFloodAnalysis", "hazardResults"], "hazard result", [{ label: "Location", key: "location" }, { label: "AEP", key: "annualExceedanceProbability" }, { label: "Depth (m)", key: "depthMetres" }, { label: "Velocity", key: "velocityMetresPerSecond" }]),
  ] },
  "dam-impoundment": { root: "damAndImpoundmentAnalysis", sections: [
    section("Dam and impoundment inventory", "Inventories upstream, downstream, onsite, and cascading dams, reservoirs, levees, canals, and ponds with geometry, storage, class, and condition.", ["damAndImpoundmentAnalysis", "impoundmentInventory"], "impoundment", [{ label: "Facility", key: "facilityId" }, { label: "Type", key: "facilityType" }, { label: "Distance (km)", key: "distanceToSiteKilometres" }, { label: "Storage (m³)", key: "maximumStorageCubicMetres" }]),
    section("Impoundment failure modes", "Evaluates overtopping, internal erosion, structural, seismic, misoperation, and cascade modes with conditions, probability, warning, and shared hazards.", ["damAndImpoundmentAnalysis", "failureModes"], "failure mode", [{ label: "Impoundment", key: "impoundmentRef" }, { label: "Failure type", key: "failureType" }, { label: "Conditional probability", key: "conditionalFailureProbability" }, { label: "Warning", key: "warningBasis" }]),
    section("Breach models", "Defines breach method, width, formation time, invert, peak outflow, hydrograph, and sensitivity branches.", ["damAndImpoundmentAnalysis", "breachModels"], "breach model", [{ label: "Failure mode", key: "failureModeRef" }, { label: "Width (m)", key: "breachWidthMetres" }, { label: "Formation (h)", key: "breachFormationTimeHours" }, { label: "Peak outflow", key: "peakOutflowCubicMetresPerSecond" }]),
    section("Dam-break routing models", "Routes breach releases to the site with terrain, channels, floodplain, structures, attenuation, travel time, debris, and erosion represented.", ["damAndImpoundmentAnalysis", "routingModels"], "routing model", [{ label: "Breaches", key: "breachModelRefs" }, { label: "Distance (km)", key: "routingDistanceKilometres" }, { label: "Travel time (h)", key: "travelTimeHours" }, { label: "Model", key: "numericalModelRef" }]),
    section("Dam and impoundment hazard results", "Provides conditional and annual site water level, depth, velocity, warning, duration, debris, and erosion results for each relevant facility.", ["damAndImpoundmentAnalysis", "hazardResults"], "hazard result", [{ label: "Location", key: "location" }, { label: "AEP", key: "annualExceedanceProbability" }, { label: "Depth (m)", key: "depthMetres" }, { label: "Warning (h)", key: "warningTimeHours" }]),
  ] },
  "surge-seiche-tsunami": { root: "surgeSeicheTsunamiAnalysis", sections: [
    section("Coastal and enclosed-water sources", "Identifies tropical, extratropical, seismic, landslide, volcanic, and meteorological sources with occurrence, magnitude, region, and site applicability.", ["surgeSeicheTsunamiAnalysis", "coastalSources"], "coastal source", [{ label: "Type", key: "sourceType" }, { label: "Region", key: "sourceRegion" }, { label: "Occurrence", key: "occurrenceModel" }, { label: "Applicability", key: "applicability" }]),
    section("Storm-surge models", "Models storm occurrence, tide, bathymetry, wind/pressure forcing, wave setup, runup, coastal/river boundaries, and simulated exposure.", ["surgeSeicheTsunamiAnalysis", "stormSurgeModels"], "surge model", [{ label: "Sources", key: "sourceRefs" }, { label: "Tide", key: "tideTreatment" }, { label: "Waves", key: "waveTreatment" }, { label: "Years", key: "simulatedYears" }]),
    section("Seiche models", "Evaluates water-body geometry, excitation, natural periods, damping, amplitudes, and shoreline amplification.", ["surgeSeicheTsunamiAnalysis", "seicheModels"], "seiche model", [{ label: "Water body", key: "waterBody" }, { label: "Excitation", key: "excitationMechanisms" }, { label: "Periods", key: "naturalPeriodsMinutes" }, { label: "Amplification", key: "shorelineAmplification" }]),
    section("Tsunami models", "Evaluates source, propagation, bathymetry, runup, drawdown, arrival, validation, and site hydraulic connection.", ["surgeSeicheTsunamiAnalysis", "tsunamiModels"], "tsunami model", [{ label: "Source model", key: "sourceModel" }, { label: "Propagation", key: "propagationModel" }, { label: "Runup", key: "runupMethod" }, { label: "Arrival times", key: "arrivalTimesHours" }]),
    section("Coastal hazard results", "Provides controlled water level, wave, runup, drawdown, velocity, warning, duration, debris, erosion, and screening outputs.", ["surgeSeicheTsunamiAnalysis", "hazardResults"], "hazard result", [{ label: "Hazard", key: "hazardType" }, { label: "Location", key: "location" }, { label: "AEP", key: "annualExceedanceProbability" }, { label: "Wave (m)", key: "waveHeightMetres" }]),
  ] },
  "hazard-integration": { root: "hazardIntegration", sections: [
    section("Hazard logic-tree branches", "Controls alternative precipitation, frequency, breach, roughness, drainage, boundary, and other models with justified weights and output curves.", ["hazardIntegration", "logicTreeBranches"], "logic-tree branch", [{ label: "Hazard", key: "hazardType" }, { label: "Level", key: "branchLevel" }, { label: "Alternative", key: "alternative" }, { label: "Weight", key: "weight" }]),
    section("Integrated flood hazard curves", "Provides mean, percentile, median, or conservative frequency-versus-demand curves for every retained hazard and controlling plant location.", ["hazardIntegration", "hazardCurves"], "hazard curve", [{ label: "Hazard", key: "hazardType" }, { label: "Location", key: "location" }, { label: "Values", key: "values" }, { label: "Frequencies", key: "annualExceedanceFrequencies" }]),
    section("Spatial flood characterizations", "Maps curve realizations to plant depths, velocities, arrival, duration, warning, and correlated location states used by scenario and plant-response models.", ["hazardIntegration", "spatialCharacterizations"], "spatial characterization", [{ label: "Hazard", key: "hazardType" }, { label: "Curve", key: "hazardCurveRef" }, { label: "Locations", key: "locationRefs" }, { label: "Correlation", key: "spatialCorrelationTreatment" }]),
    section("Flood hazard intervals", "Discretizes each curve into representative demand, frequency, duration, warning, and spatial states for exact plant-response quantification.", ["hazardIntegration", "hazardIntervals"], "hazard interval", [{ label: "Curve", key: "hazardCurveRef" }, { label: "Bounds", key: "upperValue" }, { label: "Representative", key: "representativeValue" }, { label: "Frequency /yr", key: "intervalAnnualFrequency" }]),
    section("Hazard uncertainty studies", "Propagates model and parameter alternatives and records statistics, variance, sensitivity, and downstream effects.", ["hazardIntegration", "uncertaintyStudies"], "uncertainty study", [{ label: "Hazards", key: "hazardTypes" }, { label: "Sources", key: "uncertaintySources" }, { label: "Samples", key: "sampleCount" }, { label: "Statistics", key: "outputStatistics" }]),
    section("Hazard convergence studies", "Demonstrates stable results for bins, upper tail, grid, time step, and sampling across the full analyzed hazard range.", ["hazardIntegration", "convergenceStudies"], "convergence study", [{ label: "Type", key: "studyType" }, { label: "Tested values", key: "testedValues" }, { label: "Relative change", key: "relativeChange" }, { label: "Converged", key: "converged" }]),
  ] },
  "preliminary-response": { root: "preliminaryPlantResponse", sections: [
    section("Preliminary flood initiating events", "Identifies direct and consequential initiators, triggers, affected operating states, units, and disposition for every retained flood mechanism.", ["preliminaryPlantResponse", "preliminaryInitiatingEvents"], "preliminary initiator", [{ label: "Initiator", key: "initiatingEventRef" }, { label: "Hazards", key: "hazardTypes" }, { label: "Type", key: "directOrConsequential" }, { label: "Disposition", key: "disposition" }]),
    section("Baseline PRA model reviews", "Reviews IE, ES, SC, SY, DA, HR, RI, peer-review, spatial, and mission-time records to identify required external-flood changes.", ["preliminaryPlantResponse", "modelReviews"], "model review", [{ label: "Area", key: "baselineModelArea" }, { label: "Question", key: "reviewQuestion" }, { label: "Findings", key: "findings" }, { label: "Changes", key: "requiredChanges" }]),
    section("External Flood Equipment List", "Controls each included SSC, barrier, support, pathway, location, elevation, function, hazard, flood effect, failure mode, and investigation link.", ["preliminaryPlantResponse", "externalFloodEquipmentList"], "XFEL item", [{ label: "SSC type", key: "sscType" }, { label: "Location", key: "location" }, { label: "Hazards", key: "applicableHazardTypes" }, { label: "Disposition", key: "disposition" }]),
  ] },
  investigation: { root: "plantInvestigation", sections: [
    section("Plant investigations", "Records walkdowns, surveys, interviews, talk-throughs, tabletop exercises, participants, locations, observations, findings, and confirmed model records.", ["plantInvestigation", "investigations"], "investigation", [{ label: "Type", key: "investigationType" }, { label: "Locations", key: "locations" }, { label: "Date", key: "performedDate" }, { label: "Findings", key: "findingRefs" }]),
    section("Investigation findings", "Dispositions each observed condition into model confirmation, change, corrective action, controlled limitation, or closure evidence.", ["plantInvestigation", "findings"], "finding", [{ label: "Type", key: "findingType" }, { label: "Location", key: "location" }, { label: "Observed condition", key: "observedCondition" }, { label: "Closure", key: "closureStatus" }]),
    section("Flood pathways", "Traces exterior water through doors, hatches, penetrations, vents, drains, walls, groundwater, and open areas to exposed SSCs.", ["plantInvestigation", "floodPathways"], "flood pathway", [{ label: "Origin", key: "origin" }, { label: "Destination", key: "destination" }, { label: "Type", key: "pathwayType" }, { label: "Exposed SSCs", key: "exposedSscRefs" }]),
    section("Flood protection features", "Inventories permanent and temporary barriers, doors, hatches, seals, drain isolation, pumps, capacity, surveillance, deployment, and fragility.", ["plantInvestigation", "protectionFeatures"], "protection feature", [{ label: "Type", key: "featureType" }, { label: "Location", key: "location" }, { label: "Passive", key: "passive" }, { label: "Fragility", key: "fragilityRef" }]),
    section("Drainage features", "Records drains, sumps, pumps, backflow preventers, culverts, capacities, power, blockage, discharge, and reverse-flow potential.", ["plantInvestigation", "drainageFeatures"], "drainage feature", [{ label: "Type", key: "featureType" }, { label: "Location", key: "location" }, { label: "Capacity", key: "capacityCubicMetresPerSecond" }, { label: "Power", key: "powerDependencyRefs" }]),
  ] },
  "fragility-basis": { root: "sscScreeningAndFragilityBasis", sections: [
    section("SSC screening decisions", "Screens or retains each XFEL SSC and mode for applicable water level, load, leakage, debris, erosion, groundwater, drainage, and access effects.", ["sscScreeningAndFragilityBasis", "screeningDecisions"], "screening decision", [{ label: "Objects", key: "screenedObjectRefs" }, { label: "Effects", key: "floodEffects" }, { label: "Criterion", key: "criterion" }, { label: "Disposition", key: "disposition" }]),
    section("Fragility method selections", "Selects deterministic, lognormal, reliability, test, generic-with-site-evaluation, or screening methods with data and capability-category basis.", ["sscScreeningAndFragilityBasis", "methodSelections"], "method selection", [{ label: "SSCs", key: "sscRefs" }, { label: "Failure modes", key: "failureModeRefs" }, { label: "Method", key: "method" }, { label: "Correlation", key: "correlationTreatment" }]),
    section("External-flood failure modes", "Defines overtopping, leakage, structural, submergence, spray, debris, erosion, buoyancy, support, and human-deployment failures and consequences.", ["sscScreeningAndFragilityBasis", "failureModes"], "failure mode", [{ label: "SSC", key: "sscRef" }, { label: "Mode", key: "modeType" }, { label: "Effects", key: "floodEffects" }, { label: "Consequence", key: "functionalConsequence" }]),
    section("Fragility correlation groups", "Groups common flood demand, location, construction, aging, support, deployment, and capacity uncertainty and defines model implementation.", ["sscScreeningAndFragilityBasis", "correlationGroups"], "correlation group", [{ label: "Members", key: "memberSscRefs" }, { label: "Failures", key: "failureModeRefs" }, { label: "Model", key: "correlationModel" }, { label: "Coefficient", key: "correlationCoefficient" }]),
    section("Coexistent-hazard fragility assessments", "Determines how storm, seismic, debris, erosion, fire, and other coexistent effects change flood demand or capacity.", ["sscScreeningAndFragilityBasis", "coexistentHazardAssessments"], "coexistent assessment", [{ label: "Primary", key: "primaryHazardType" }, { label: "Combined", key: "combinedHazards" }, { label: "Relationship", key: "relationship" }, { label: "Disposition", key: "disposition" }]),
  ] },
  fragility: { root: "floodFragilityAnalysis", sections: [
    section("Barrier and protection fragilities", "Quantifies structural, leakage, overtopping, bypass, installation, alignment, aging, maintenance, and deployment failure for credited protection.", ["floodFragilityAnalysis", "barrierFragilities"], "barrier fragility", [{ label: "Feature", key: "featureRef" }, { label: "Median", key: "medianCapacity" }, { label: "Randomness", key: "betaRandomness" }, { label: "Uncertainty", key: "betaUncertainty" }]),
    section("Equipment and structure fragilities", "Quantifies functional failure from submergence, spray, seepage, groundwater, sediment, debris, loss of support, enclosure, and mounting.", ["floodFragilityAnalysis", "equipmentFragilities"], "equipment fragility", [{ label: "SSC", key: "sscRef" }, { label: "Demand", key: "demandParameter" }, { label: "Threshold", key: "thresholdValue" }, { label: "Median", key: "medianCapacity" }]),
    section("Flood structural load models", "Combines hydrostatic, hydrodynamic, wave, debris-impact, buoyancy, erosion, scour, uplift, and structural resistance.", ["floodFragilityAnalysis", "structuralLoadModels"], "load model", [{ label: "SSC", key: "sscRef" }, { label: "Hydrostatic", key: "hydrostaticLoadKilonewtons" }, { label: "Debris", key: "debrisImpactLoadKilonewtons" }, { label: "Combination", key: "loadCombination" }]),
    section("Seal and penetration assessments", "Records installed configuration, differential-head capacity, leakage, aging, tests, inspections, and conservative interim treatment.", ["floodFragilityAnalysis", "sealAssessments"], "seal assessment", [{ label: "Seal", key: "sealOrPenetrationRef" }, { label: "Type", key: "sealType" }, { label: "Head capacity", key: "differentialHeadCapacityMetres" }, { label: "Leakage", key: "leakageRateLitresPerMinute" }]),
    section("Conditional flood fragility curves", "Provides failure probability versus controlled flood demand across the full hazard range with method and correlation links.", ["floodFragilityAnalysis", "fragilityCurves"], "fragility curve", [{ label: "SSC", key: "sscRef" }, { label: "Demand values", key: "demandValues" }, { label: "Failure probabilities", key: "conditionalFailureProbabilities" }, { label: "Correlations", key: "correlationGroupRefs" }]),
  ] },
  scenarios: { root: "scenarioDevelopment", sections: [
    section("External-flood scenario groups", "Groups sources, hazards, pathways, protection, exposed SSCs, operating states, and initiators into representative mutually consistent scenarios.", ["scenarioDevelopment", "scenarioGroups"], "scenario group", [{ label: "Hazards", key: "hazardTypes" }, { label: "Pathways", key: "initialPathwayRefs" }, { label: "Exposed SSCs", key: "exposedSscRefs" }, { label: "Initiators", key: "initiatingEventRefs" }]),
    section("Flood propagation models", "Routes ingress, leakage, accumulation, drainage, pumping, backflow, and spatially correlated location states from source to targets.", ["scenarioDevelopment", "propagationModels"], "propagation model", [{ label: "Scenario", key: "scenarioGroupRef" }, { label: "Source", key: "sourceLocation" }, { label: "Destinations", key: "destinationLocations" }, { label: "States", key: "outputLocationStates" }]),
    section("Scenario timelines", "Defines warning, site arrival, ingress, SSC failure, operator windows, peak, recession, recovery, and mission time for each scenario family.", ["scenarioDevelopment", "scenarioTimelines"], "scenario timeline", [{ label: "Scenario", key: "scenarioGroupRef" }, { label: "Warning (h)", key: "warningTimeHours" }, { label: "Arrival (h)", key: "siteArrivalTimeHours" }, { label: "Mission (h)", key: "missionTimeHours" }]),
    section("Combined-hazard scenarios", "Controls causal, correlated, conditional, and coincident hazard combinations and their non-overlapping frequency treatment.", ["scenarioDevelopment", "hazardCombinations"], "combined-hazard scenario", [{ label: "Primary", key: "primaryHazardType" }, { label: "Combined", key: "combinedHazards" }, { label: "Relationship", key: "relationship" }, { label: "Double counting", key: "doubleCountingControl" }]),
    section("Scenario screening decisions", "Screens quantitatively insignificant scenario groups only after preserving conservative states, aggregation, investigations, and affected-family links.", ["scenarioDevelopment", "screeningDecisions"], "scenario screening decision", [{ label: "Scenarios", key: "screenedObjectRefs" }, { label: "Value", key: "quantitativeValue" }, { label: "Aggregate", key: "aggregateFrequencyPerPlantYear" }, { label: "Disposition", key: "disposition" }]),
  ] },
  "plant-response": { root: "plantResponseModel", sections: [
    section("Baseline peer-review dispositions", "Determines how applicable baseline PRA findings affect external-flood initiators, sequences, systems, HRA, recovery, quantification, and integration.", ["plantResponseModel", "peerReviewDispositions"], "peer-review disposition", [{ label: "Element", key: "sourcePraElement" }, { label: "Finding", key: "findingId" }, { label: "Relevance", key: "relevanceToExternalFlood" }, { label: "Closure", key: "closureStatus" }]),
    section("External-flood initiating-event models", "Defines direct and consequential flood initiators, hazard intervals, scenario groups, initiating failures, frequencies, and affected sources.", ["plantResponseModel", "initiatingEventModels"], "initiating-event model", [{ label: "Initiator", key: "initiatingEventRef" }, { label: "Hazards", key: "hazardTypes" }, { label: "Intervals", key: "hazardIntervalRefs" }, { label: "Frequency", key: "frequencyTreatment" }]),
    section("External-flood event-sequence models", "Adapts event trees to scenario progression, protection states, dependencies, mission time, release categories, and multi-unit response.", ["plantResponseModel", "eventSequenceModels"], "event-sequence model", [{ label: "Event tree", key: "eventTreeRef" }, { label: "Hazards", key: "hazardTypes" }, { label: "Sequences", key: "eventSequenceRefs" }, { label: "Mission", key: "missionTimeRef" }]),
    section("Flood success criteria", "Confirms functions, trains, supports, capacity, timing, hazard intervals, scenarios, mission time, and analysis evidence.", ["plantResponseModel", "successCriteria"], "success criterion", [{ label: "Function", key: "safetyFunctionRef" }, { label: "Criterion", key: "criterion" }, { label: "Required SSCs", key: "requiredSscRefs" }, { label: "Mission (h)", key: "missionTimeHours" }]),
    section("System-model modifications", "Implements XFEL failure modes, conditional basic events, flood-state gates, dependencies, correlations, recovery, and verification.", ["plantResponseModel", "systemModelModifications"], "system modification", [{ label: "System", key: "systemRef" }, { label: "SSCs", key: "affectedSscRefs" }, { label: "Modification", key: "modification" }, { label: "Verification", key: "verificationRefs" }]),
    section("Flood mission times", "Defines safety-function mission through hazard duration, water recession, inspection, debris clearing, access restoration, and source stabilization.", ["plantResponseModel", "missionTimes"], "mission time", [{ label: "Hazards", key: "hazardTypes" }, { label: "Function", key: "safetyFunctionRef" }, { label: "Hours", key: "missionTimeHours" }, { label: "Families", key: "eventSequenceFamilyRefs" }]),
    section("Flood-adjusted data parameters", "Adapts random failure, common cause, unavailability, recovery, and mission-time data to water, debris, duration, access, and shared-power conditions.", ["plantResponseModel", "dataParameters"], "data parameter", [{ label: "Parameter", key: "parameterRef" }, { label: "Type", key: "parameterType" }, { label: "Mean", key: "meanValue" }, { label: "Adjustment", key: "floodAdjustment" }]),
    section("Multi-unit and multi-source response", "Models shared demand, SSCs, resources, staffing, communications, access, organizational response, and coupled sequences across units and sources.", ["plantResponseModel", "multiUnitAssessments"], "multi-unit assessment", [{ label: "Units", key: "affectedReactorUnitRefs" }, { label: "Sources", key: "affectedSourceRefs" }, { label: "Shared SSCs", key: "sharedSscRefs" }, { label: "Resources", key: "sharedResourceRefs" }]),
  ] },
  "human-reliability": { root: "humanReliabilityAnalysis", sections: [
    section("External-flood human actions", "Identifies preparation, response, and recovery with scenario cues, procedures, locations, warning, timing, equipment, and feasibility.", ["humanReliabilityAnalysis", "humanActions"], "human action", [{ label: "Type", key: "actionType" }, { label: "Location", key: "actionLocation" }, { label: "Warning (min)", key: "warningTimeAvailableMinutes" }, { label: "Execution (min)", key: "executionTimeMinutes" }]),
    section("Human failure events", "Defines failed action, event-sequence links, basic events, dependencies, and exclusive-recovery treatment.", ["humanReliabilityAnalysis", "humanFailureEvents"], "human failure event", [{ label: "Action", key: "humanActionRef" }, { label: "Failure", key: "failureDescription" }, { label: "Sequences", key: "eventSequenceRefs" }, { label: "Exclusive recovery", key: "exclusiveRecovery" }]),
    section("Flood performance contexts", "Characterizes warning, weather, water, debris, access, habitability, lighting, workload, staffing, communication, and multi-unit demand.", ["humanReliabilityAnalysis", "performanceContexts"], "performance context", [{ label: "Action", key: "humanActionRef" }, { label: "Hazards", key: "hazardTypes" }, { label: "Water/debris", key: "waterAndDebrisConditions" }, { label: "Access", key: "accessAndEgress" }]),
    section("Flood HEP estimates", "Quantifies nominal and flood-context HEP, bounds, timing margin, dependency adjustment, recovery credit, and uncertainty.", ["humanReliabilityAnalysis", "hepEstimates"], "HEP estimate", [{ label: "HFE", key: "humanFailureEventRef" }, { label: "Method", key: "method" }, { label: "Nominal HEP", key: "nominalHep" }, { label: "Flood HEP", key: "externalFloodHep" }]),
    section("Action confirmations", "Records procedure reviews, interviews, walkdowns, talk-throughs, tabletop exercises, and simulations that confirm interpretation, timing, feasibility, and constraints.", ["humanReliabilityAnalysis", "confirmations"], "action confirmation", [{ label: "Actions", key: "humanActionRefs" }, { label: "Type", key: "confirmationType" }, { label: "Timing", key: "confirmedTiming" }, { label: "Changes", key: "modelChanges" }]),
    section("Recovery assessments", "Reevaluates baseline recovery against flood access, water, debris, environment, equipment condition, timing, and procedure limits.", ["humanReliabilityAnalysis", "recoveryAssessments"], "recovery assessment", [{ label: "Action", key: "humanActionRef" }, { label: "Source model", key: "sourceRecoveryModelRef" }, { label: "Remains valid", key: "remainsValidUnderExternalFlood" }, { label: "Recovery value", key: "recoveryValue" }]),
    section("HRA dependencies", "Models shared cues, crews, locations, timing, access, communication, resource, and multi-unit dependencies and joint probability.", ["humanReliabilityAnalysis", "dependencyAssessments"], "dependency assessment", [{ label: "HFEs", key: "humanFailureEventRefs" }, { label: "Crews", key: "sharedCrews" }, { label: "Relationship", key: "temporalRelationship" }, { label: "Dependency", key: "dependencyLevel" }]),
  ] },
  quantification: { root: "eventSequenceQuantification", sections: [
    section("Quantification runs", "Controls model version, hazards, intervals, fragilities, scenarios, plant response, HRA, numerical treatment, truncation, sampling, seed, and software.", ["eventSequenceQuantification", "quantificationRuns"], "quantification run", [{ label: "Model", key: "modelVersion" }, { label: "Hazards", key: "hazardTypes" }, { label: "Samples", key: "uncertaintySampleCount" }, { label: "Software", key: "softwareAndVersion" }]),
    section("Flood-interval results", "Calculates interval frequency, conditional sequence probability, sequence frequency, and dominant fragility and basic-event contributors.", ["eventSequenceQuantification", "hazardIntervalResults"], "interval result", [{ label: "Interval", key: "hazardIntervalRef" }, { label: "Hazard", key: "hazardType" }, { label: "Family", key: "eventSequenceFamilyRef" }, { label: "Frequency /yr", key: "sequenceFrequencyPerPlantYear" }]),
    section("Event-sequence-family results", "Aggregates interval results by family, hazard, scenario, unit, material source, release category, and uncertainty percentile.", ["eventSequenceQuantification", "eventSequenceFamilyResults"], "family result", [{ label: "Family", key: "eventSequenceFamilyRef" }, { label: "Hazards", key: "hazardTypes" }, { label: "Mean /yr", key: "meanFrequencyPerPlantYear" }, { label: "P95 /yr", key: "ninetyFifthPercentileFrequencyPerPlantYear" }]),
    section("Quantification convergence", "Demonstrates stability for hazard bins, upper tail, scenario screening, truncation, sampling, and high conditional-probability treatment.", ["eventSequenceQuantification", "convergenceStudies"], "convergence study", [{ label: "Type", key: "studyType" }, { label: "Tested values", key: "testedValues" }, { label: "Relative change", key: "relativeChange" }, { label: "Converged", key: "converged" }]),
    section("Integrated uncertainty results", "Propagates hazard, fragility, scenario, data, plant-response, HRA, and dependency uncertainty with mean, percentile, and variance results.", ["eventSequenceQuantification", "uncertaintyResults"], "uncertainty result", [{ label: "Samples", key: "sampleCount" }, { label: "Mean /yr", key: "aggregateMeanFrequencyPerPlantYear" }, { label: "P95 /yr", key: "aggregateNinetyFifthPercentileFrequencyPerPlantYear" }, { label: "Variance", key: "varianceContributions" }]),
    section("External-flood risk contributors", "Ranks hazards, locations, barriers, SSCs, scenarios, actions, basic events, and sequence families by contribution and importance.", ["eventSequenceQuantification", "riskContributors"], "risk contributor", [{ label: "Type", key: "contributorType" }, { label: "Contributor", key: "contributorRef" }, { label: "Rank", key: "rank" }, { label: "Fraction", key: "fractionalContribution" }]),
    section("Quantitative scenario screens", "Controls insignificant scenario screening with value, threshold, aggregate contribution, conservatism, and affected-family traceability.", ["eventSequenceQuantification", "screeningDecisions"], "screening decision", [{ label: "Objects", key: "screenedObjectRefs" }, { label: "Value", key: "quantitativeValue" }, { label: "Aggregate", key: "aggregateFrequencyPerPlantYear" }, { label: "Disposition", key: "disposition" }]),
  ] },
  "risk-interpretation": { root: "riskInterpretation", sections: [
    section("External-flood risk insights", "Interprets dominant hazards, locations, protection features, SSCs, scenarios, actions, uncertainty, multi-unit dependencies, and risk reduction.", ["riskInterpretation", "riskInsights"], "risk insight", [{ label: "Type", key: "insightType" }, { label: "Contributors", key: "contributorRefs" }, { label: "Quantitative basis", key: "quantitativeBasis" }, { label: "Actions", key: "recommendedActions" }]),
    section("Model refinement actions", "Tracks material gaps from trigger through proposed change, expected impact, priority, completion evidence, and closure.", ["riskInterpretation", "refinementActions"], "refinement action", [{ label: "Trigger", key: "trigger" }, { label: "Change", key: "proposedChange" }, { label: "Priority", key: "priority" }, { label: "Closure", key: "closureStatus" }]),
    section("Quantification iterations", "Records model changes and demonstrates stable total frequency, family frequency, contributor ranks, and risk-significant contributor set.", ["riskInterpretation", "quantificationIterations"], "quantification iteration", [{ label: "Iteration", key: "iterationNumber" }, { label: "Changes", key: "changes" }, { label: "Frequency change", key: "aggregateFrequencyChange" }, { label: "Decision", key: "decision" }]),
    section("Sensitivity studies", "Tests plausible alternatives in hazard, drainage, barriers, seals, dependencies, HRA, recovery, and numerical treatment and records decision impact.", ["riskInterpretation", "sensitivityStudies"], "sensitivity study", [{ label: "Base run", key: "baseRunRef" }, { label: "Varied inputs", key: "variedInputs" }, { label: "Result changes", key: "resultChanges" }, { label: "Conclusion", key: "conclusion" }]),
  ] },
  "risk-integration": { root: "riskIntegration", sections: [
    section("Integrated risk results", "Transfers external-flood event-sequence families and aligned uncertainty to total-risk metrics while controlling common storm, seismic, and other overlap.", ["riskIntegration", "integrationResults"], "integration result", [{ label: "Metric", key: "metric" }, { label: "XF contribution", key: "externalFloodContributionPerPlantYear" }, { label: "Total risk", key: "totalRiskPerPlantYear" }, { label: "Fraction", key: "fractionalContribution" }]),
    section("Risk-informed decisions", "Records model acceptance, design, procedure, surveillance, maintenance, and emergency decisions with quantitative basis, owner, due date, and closure.", ["riskIntegration", "riskDecisions"], "risk decision", [{ label: "Type", key: "decisionType" }, { label: "Decision", key: "decision" }, { label: "Owner", key: "responsibleOrganization" }, { label: "Closure", key: "closureStatus" }]),
    section("End-to-end traceability", "Links evidence, hazard, fragility, scenario, sequence, result, insight, and decision records and makes any gap explicit.", ["riskIntegration", "traceabilityPaths"], "traceability path", [{ label: "Hazards", key: "hazardRefs" }, { label: "Fragilities", key: "fragilityRefs" }, { label: "Decisions", key: "decisionRefs" }, { label: "Complete", key: "complete" }]),
    section("Controlled External Flood PRA baselines", "Releases hazard, fragility, plant-response, quantification, report, approval, and configuration-control packages as one baseline.", ["riskIntegration", "controlledBaselines"], "controlled baseline", [{ label: "Model", key: "modelVersion" }, { label: "Freeze", key: "freezeDate" }, { label: "Control record", key: "configurationControlRecordId" }, { label: "Status", key: "releaseStatus" }]),
  ] },
  "technical-closure": { root: "technicalClosure", sections: [
    section("Conformance reviews", "Reviews satisfied-by records and evidence for all 40 XFHA, 21 XFFR, and 48 XFPR supporting requirements.", ["technicalClosure", "conformanceReviews"], "conformance review", [{ label: "Review", key: "name" }, { label: "Result", key: "description" }, { label: "Basis", key: "basis" }, { label: "Status", key: "status" }]),
    section("Documentation checks", "Verifies reproducible inputs, models, methods, results, uncertainty, limitations, interfaces, report references, and configuration records.", ["technicalClosure", "documentationChecks"], "documentation check", [{ label: "Check", key: "name" }, { label: "Result", key: "description" }, { label: "Evidence", key: "evidenceRefs" }, { label: "Status", key: "status" }]),
    section("Interface closure checks", "Confirms every external technical-element input and output is controlled, consistent, reconciled, accepted, and free of open items.", ["technicalClosure", "interfaceClosureChecks"], "interface closure check", [{ label: "Check", key: "name" }, { label: "Result", key: "description" }, { label: "Related records", key: "relatedRefs" }, { label: "Status", key: "status" }]),
    section("Peer-review team", "Records independent team roles, organizations, qualifications, experience, independence, and assigned XFHA/XFFR/XFPR scope.", ["technicalClosure", "peerReviewTeam"], "team member", [{ label: "Role", key: "role" }, { label: "Organization", key: "organization" }, { label: "Qualifications", key: "qualifications" }, { label: "Scope", key: "reviewScope" }]),
    section("Peer-review findings", "Tracks facts and observations, suggestions, best practices, and comments through condition, consequence, recommendation, resolution, evidence, and closure.", ["technicalClosure", "peerReviewFindings"], "peer-review finding", [{ label: "Area", key: "reviewArea" }, { label: "Category", key: "findingCategory" }, { label: "Significance", key: "significance" }, { label: "Closure", key: "closureStatus" }]),
    section("Readiness checks", "Confirms the controlled schema, evidence, conformance, models, calculations, report, interfaces, findings, and assumptions are ready for review and release.", ["technicalClosure", "readinessChecks"], "readiness check", [{ label: "Check", key: "name" }, { label: "Result", key: "description" }, { label: "Evidence", key: "evidenceRefs" }, { label: "Status", key: "status" }]),
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
  return <Drawer title="Technical-element transfer record" subtitle={`${sourceInterface.technicalElementCode} ${direction === "INPUT" ? "to" : "from"} External Flood PRA · ${sourceInterface.technicalElementName}`} onClose={onClose} footer={<><button type="button" className="posnav__btn" onClick={onClose}>Cancel</button><span className="fldrawer__footer-spacer" /><button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save changes</button></>}>
    <div className="sinlineeditor__body"><div className="sinlineeditor__group"><WorkbookSectionHeading workbook="XF" title="Technical-element handoff" className="sinlineeditor__title" /><div className="sinlineeditor__grid"><Field label="Technical element"><TextInput value={`${sourceInterface.technicalElementCode} · ${sourceInterface.technicalElementName}`} disabled onChange={() => undefined} /></Field><Field label="Direction"><SelectInput value={direction} options={[{ value: "INPUT", label: "Input to External Flood PRA" }, { value: "OUTPUT", label: "Output from External Flood PRA" }]} onChange={(value) => setDirection(value as typeof direction)} /></Field><Field label="Interface role" wide><TextArea rows={3} value={role} onChange={setRole} /></Field></div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading workbook="XF" title="Transferred record" className="sinlineeditor__title" /><div className="sinlineeditor__grid"><Field label="Record name" wide><TextInput value={name} onChange={setName} /></Field><Field label="Record reference"><TextInput value={recordRef} onChange={setRecordRef} /></Field><Field label="Transfer status"><SelectInput value={status} options={["CONTROLLED", "WORKING", "OPEN"].map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() }))} onChange={(value) => setStatus(value as typeof status)} /></Field><Field label="Source model or revision" wide><TextInput value={sourceModelRef} onChange={setSourceModelRef} /></Field><Field label="Destination records" wide><TextArea rows={4} value={destinationRefs} onChange={setDestinationRefs} /></Field><Field label="Evidence references" wide><TextArea rows={3} value={evidenceRefs} onChange={setEvidenceRefs} /></Field></div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading workbook="XF" title="Transferred values" className="sinlineeditor__title" /><div className="sinlineeditor__grid">{sourceInterface.columns.map((column, index) => <Field key={column} label={column} wide><TextArea rows={2} value={values[index] ?? ""} onChange={(value) => setValues((current) => sourceInterface.columns.map((_, candidate) => candidate === index ? value : current[candidate] ?? ""))} /></Field>)}</div></div></div>
  </Drawer>;
}

function Interfaces({ setTarget, onEdit }: { setTarget: (target: EditorTarget) => void; onEdit: (selection: InterfaceEditorSelection) => void }): JSX.Element {
  const { mef, editable } = useExternalFloodPraWorkbook();
  const [selected, setSelected] = useState<number | null>(null);
  const current = selected === null ? undefined : mef.analysisBasis.interfaces[selected];
  return <Section title="Interfaces" description="Shows the controlled inputs received from other PRA technical elements and the External Flood results supplied to Event Sequence Quantification and Risk Integration." actions={editable ? <AddButton label="Add interface" onClick={() => setTarget({ title: "Add technical-element interface", subtitle: "Define one external technical-element handoff and its controlled transfer records.", focus: [], createAt: ["analysisBasis", "interfaces"] })} /> : undefined}>
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
  return <Drawer title="PRA analysis and scope" subtitle="Record the decision application, reference plant, External Flood boundary, baseline scope, and required risk results in one flat editor." onClose={onClose} footer={<><button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>{editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save changes</button>}</>}>
    <fieldset className="sinlineeditor" disabled={!editable}><div className="sinlineeditor__group"><WorkbookSectionHeading workbook="XF" title="PRA application" className="sinlineeditor__title" /><Field label="Intended application"><TextInput value={draft.applicationName} onChange={(value) => setDraft((item) => ({ ...item, applicationName: value }))} /></Field><Field label="Purpose"><TextArea rows={3} value={draft.purpose} onChange={(value) => setDraft((item) => ({ ...item, purpose: value }))} /></Field><Field label="Decision supported"><TextArea rows={3} value={draft.decisionContext} onChange={(value) => setDraft((item) => ({ ...item, decisionContext: value }))} /></Field><Field label="Risk measures and endpoints"><TextArea rows={4} value={draft.supportedRiskMetrics} onChange={(value) => setDraft((item) => ({ ...item, supportedRiskMetrics: value }))} /></Field></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading workbook="XF" title="Reference plant and site" className="sinlineeditor__title" /><div className="flfieldgrid"><Field label="Plant name"><TextInput value={draft.plantName} onChange={(value) => setDraft((item) => ({ ...item, plantName: value }))} /></Field><Field label="Site"><TextInput value={draft.siteName} onChange={(value) => setDraft((item) => ({ ...item, siteName: value }))} /></Field><Field label="Vendor or designer"><TextInput value={draft.vendor} onChange={(value) => setDraft((item) => ({ ...item, vendor: value }))} /></Field><Field label="Reactor type"><TextInput value={draft.reactorType} onChange={(value) => setDraft((item) => ({ ...item, reactorType: value }))} /></Field><Field label="Thermal power"><TextInput value={draft.thermalPower} onChange={(value) => setDraft((item) => ({ ...item, thermalPower: value }))} /></Field><Field label="Modules or units"><NumberInput value={draft.numberOfModules} onChange={(value) => setDraft((item) => ({ ...item, numberOfModules: value }))} /></Field></div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading workbook="XF" title="Analysis boundary" className="sinlineeditor__title" /><Field label="PRA scope"><TextArea rows={5} value={draft.praScope} onChange={(value) => setDraft((item) => ({ ...item, praScope: value }))} /></Field><div className="flfieldgrid"><Field label="Capability category"><SelectInput value={draft.capabilityCategory} options={[{ value: "CC-I", label: "CC-I" }, { value: "CC-II", label: "CC-II" }]} onChange={(value) => setDraft((item) => ({ ...item, capabilityCategory: value as ScopeDraft["capabilityCategory"] }))} /></Field><Field label="Plant stage"><SelectInput value={draft.plantStage} options={[{ value: "PRE_OPERATIONAL", label: "Pre-operational" }, { value: "OPERATIONAL", label: "Operational" }]} onChange={(value) => setDraft((item) => ({ ...item, plantStage: value as ScopeDraft["plantStage"] }))} /></Field></div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading workbook="XF" title="Imported baseline scope" className="sinlineeditor__title" /><Field label="Operating states"><TextArea rows={4} value={operatingStates} disabled onChange={() => undefined} /></Field><Field label="Radioactive-material sources"><TextArea rows={4} value={materialSources} disabled onChange={() => undefined} /></Field></div></fieldset>
  </Drawer>;
}

function AnalysisBasis(): JSX.Element {
  const { mef, editable } = useExternalFloodPraWorkbook();
  const [target, setTarget] = useState<EditorTarget | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [interfaceEditor, setInterfaceEditor] = useState<InterfaceEditorSelection | null>(null);
  const site = mef.analysisBasis.siteBasis;
  const baseline = mef.analysisBasis.baselinePra;
  const scopeSection = section("Analysis scope records", "Defines retained hazard types, flood effects, plant locations, operating states, reactor units, material sources, and inclusion boundary.", ["analysisBasis", "scopeRecords"], "scope record", [{ label: "Hazards", key: "hazardTypes" }, { label: "Effects", key: "floodEffects" }, { label: "Operating states", key: "plantOperatingStateRefs" }, { label: "Locations", key: "includedLocations" }]);
  const applicationSection = section("PRA applications", "Record each decision application, supported risk metrics, consumers, configuration basis, and limitations.", ["analysisBasis", "applications"], "application", [{ label: "Purpose", key: "purpose" }, { label: "Decision", key: "decisionContext" }, { label: "Metrics", key: "supportedRiskMetrics" }, { label: "Consumers", key: "consumingElementRefs" }]);
  const evidenceSection = section("Controlled evidence", "Register standards, meteorological data, drawings, calculations, procedures, models, investigations, surveys, and operating experience.", ["analysisBasis", "evidenceRegister"], "evidence record", [{ label: "Type", key: "evidenceType" }, { label: "Source", key: "sourceReference" }, { label: "Subelements", key: "applicableSubelements" }, { label: "Controlled", key: "controlled" }]);
  return <div className="flstep">
    <Section title="PRA analysis and scope" description="Defines the intended application, plant stage, capability category, overall analysis boundary, and reference plant used by every later External Flood step." actions={editable ? <EditButton label="Edit analysis scope" onClick={() => setScopeOpen(true)} /> : undefined}><div className="sanalysisbasis"><AnalysisRow label="Intended application" value={mef.analysisBasis.applications[0]?.name} /><AnalysisRow label="Purpose" value={mef.analysisBasis.applications[0]?.purpose} /><AnalysisRow label="Decision supported" value={mef.analysisBasis.applications[0]?.decisionContext} /><AnalysisRow label="PRA scope" value={mef.praScope} /><AnalysisRow label="Capability category" value={mef.capabilityCategory} /><AnalysisRow label="Plant stage" value={mef.plantStage} /><AnalysisRow label="Reference plant and site" value={[mef.metadata.plantIdentity?.name, mef.metadata.plantIdentity?.siteName].filter(Boolean)} /><AnalysisRow label="Operating states" value={baseline?.plantOperatingStateRefs} /><AnalysisRow label="Radioactive-material sources" value={baseline?.radioactiveMaterialSourceRefs} /><AnalysisRow label="Risk measures and endpoints" value={mef.analysisBasis.applications[0]?.supportedRiskMetrics} /></div></Section>
    <Section title="Site basis" description="Defines the specific or bounding site, location, watershed and coastal setting, terrain, drainage, datum, licensee-controlled area, units, sources, operating states, and data cutoff." actions={editable ? <EditButton label="Edit site basis" onClick={() => setTarget({ title: "External Flood site basis", subtitle: "Define the reference site and every physical and environmental attribute used by the flood analysis.", focus: ["analysisBasis", "siteBasis"] })} /> : undefined}><div className="sanalysisbasis"><AnalysisRow label="Site" value={site?.siteName} /><AnalysisRow label="Basis type" value={site?.siteBasisType} /><AnalysisRow label="Selection status" value={site?.siteSelectionStatus} /><AnalysisRow label="Location" value={site === undefined ? "" : [site.latitudeDegrees, site.longitudeDegrees].filter((item) => item !== undefined).join(", ")} /><AnalysisRow label="Grade elevation" value={site?.gradeElevationMetres} /><AnalysisRow label="Watershed and coastal setting" value={site?.watershedAndCoastalSetting} /><AnalysisRow label="Topography and drainage" value={site?.topographyAndDrainageDescription} /><AnalysisRow label="Datum and survey basis" value={site?.datumAndSurveyBasis} /><AnalysisRow label="Operating states" value={site?.plantOperatingStateRefs} /></div></Section>
    <RecordSectionView section={scopeSection} setTarget={setTarget} />
    <Section title="Baseline PRA" description="Freezes the internal-events model boundary and records which POS, IE, ES, SC, SY, DA, HR, and RI records are reused, modified, new, or not applicable." actions={editable ? <EditButton label="Edit baseline PRA" onClick={() => setTarget({ title: "Baseline PRA definition", subtitle: "Control the model freeze and external technical records used to build the External Flood PRA.", focus: ["analysisBasis", "baselinePra"] })} /> : undefined}><div className="sanalysisbasis"><AnalysisRow label="Model" value={baseline?.modelName} /><AnalysisRow label="Reference" value={baseline?.modelReference} /><AnalysisRow label="Revision" value={baseline?.revision} /><AnalysisRow label="Freeze date" value={baseline?.freezeDate} /><AnalysisRow label="Freeze status" value={baseline?.freezeStatus} /><AnalysisRow label="Record treatments" value={baseline?.recordTreatments.length} /></div></Section>
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
      <Section title="Flood-conditioned initiating-event fault trees" description="Author initiating-event logic created or modified by external-flood demand."><HazardFaultTreeEditor models={mef.hazardConditionedModels} editable={editable} onChange={updateModels} /></Section>
      <Section title="Flood-conditioned event trees" description="Author flood response paths, functional events, bypasses, transfers, and end states."><HazardEventTreeEditor models={mef.hazardConditionedModels} editable={editable} onChange={updateModels} /></Section>
    </>}
    {(stepId === "human-reliability" || stepId === "quantification") && <Section title="Flood dependency Bayesian networks" description="Model correlated flood conditions and conditional response dependencies."><HazardBayesianNetworkEditor models={mef.hazardConditionedModels} editable={editable} onChange={updateModels} /></Section>}
    {recordSections.map((item) => <RecordSectionView key={item.title} section={item} setTarget={setTarget} />)}
    <Editor target={target} onClose={() => setTarget(null)} />
  </div>;
}

export function ExternalFloodPraStepScreen({ stepId }: { stepId: string }): JSX.Element {
  if (stepId === "analysis-basis") return <AnalysisBasis />;
  return <TechnicalStep stepId={stepId} />;
}
