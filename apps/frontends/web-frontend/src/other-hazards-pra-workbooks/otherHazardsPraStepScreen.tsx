import {
  type OtherHazardsAnalysisRecord,
  type OtherHazardsPRA,
  type OtherHazardsRecordStatus,
} from "interfaces-mef-types/other-hazards/other-hazards-pra";
import { synchronizeOtherHazardsPraDerivedRegisters } from "interfaces-mef-types/other-hazards/other-hazards-pra-validation";
import { OtherHazardsPRASchema } from "interfaces-mef-types/zod/other-hazards/other-hazards-pra";
import { type JSX, useState } from "react";
import { POSIcon } from "../pos-workbooks/posIcons";
import {
  removeStructuredRecord,
  StructuredEditorDrawer,
  type EditorPath,
} from "../seismic-pra-workbooks/seismicPraStructuredEditor";
import { WorkbookCueLabel, WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import {
  Drawer,
  Field,
  NumberInput,
  Section,
  SelectInput,
  TextArea,
  TextInput,
} from "./otherHazardsPraFields";
import { useOtherHazardsPraWorkbook } from "./otherHazardsPraWorkbookContext";
import "../seismic-pra-workbooks/css/seismicPra.css";

type SemanticRecord = OtherHazardsAnalysisRecord & Record<string, unknown>;
interface RecordSection {
  title: string;
  description: string;
  path: EditorPath;
  singular: string;
  empty: string;
  columns: Array<{ label: string; key: string }>;
}
interface StepConfig {
  root?: string;
  sections: RecordSection[];
}
interface EditorTarget {
  title: string;
  subtitle: string;
  focus: EditorPath;
  createAt?: EditorPath;
  removeLabel?: string;
  visibleRootFields?: string[];
}

const HIDDEN_FIELDS = [
  "uuid",
  "implementsSrs",
  "standardRequirementRefs",
  "transferBasis",
  "stoppingBasis",
  "documentation",
];

function display(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (value.every((item) => item !== null && typeof item === "object"))
      return `${String(value.length)} structured entries`;
    return value.map(String).join(" · ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return value !== 0 && (Math.abs(value) < 0.001 || Math.abs(value) >= 1_000_000) ?
        value.toExponential(2).replace("e", "E")
      : value.toLocaleString(undefined, { maximumSignificantDigits: 5 });
  }
  if (value !== null && typeof value === "object")
    return Object.values(value as Record<string, unknown>)
      .map(display)
      .join(" · ");
  const text = String(value ?? "");
  return text.trim().length === 0 ? "—" : text.replace(/_/g, " ");
}

function valueAt(root: unknown, path: EditorPath): unknown {
  let current = root;
  for (const segment of path) current = (current as Record<string | number, unknown> | undefined)?.[segment];
  return current;
}

function statusTone(status: OtherHazardsRecordStatus): string {
  if (status === "DRAFT" || status === "OPEN") return "fltag--warn";
  if (status === "SCREENED") return "fltag--neutral";
  return "fltag--good";
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      className="posnav__btn posnav__btn--sm posnav__btn--primary"
      onClick={onClick}
    >
      <POSIcon.Plus /> {label}
    </button>
  );
}

function EditButton({ label = "Edit", onClick }: { label?: string; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      className="posnav__btn posnav__btn--sm posnav__btn--primary"
      onClick={onClick}
    >
      <POSIcon.Pencil /> {label}
    </button>
  );
}

function AnalysisRow({ label, value }: { label: string; value: unknown }): JSX.Element {
  return (
    <div className="sanalysisbasis__row">
      <span>{label}</span>
      <strong title={display(value)}>{display(value)}</strong>
    </div>
  );
}

function collectionTarget(section: RecordSection, index?: number): EditorTarget {
  return index === undefined ?
      { title: `Add ${section.singular}`, subtitle: section.description, focus: [], createAt: section.path }
    : {
        title: `Edit ${section.singular}`,
        subtitle: section.description,
        focus: [...section.path, index],
        removeLabel: `Remove ${section.singular}`,
      };
}

function Editor({
  target,
  onClose,
}: {
  target: EditorTarget | null;
  onClose: () => void;
}): JSX.Element | null {
  const { mef, editable, mutate } = useOtherHazardsPraWorkbook();
  if (target === null) return null;
  return (
    <StructuredEditorDrawer
      eyebrow="Other Hazards PRA · Flat record editor"
      title={target.title}
      subtitle={target.subtitle}
      schema={OtherHazardsPRASchema}
      value={mef}
      editable={editable}
      initialFocus={target.focus}
      createAt={target.createAt}
      hiddenRootFields={HIDDEN_FIELDS}
      visibleRootFields={target.visibleRootFields}
      inlinePrimitiveArrays
      onClose={onClose}
      onApply={(value) => mutate(() => synchronizeOtherHazardsPraDerivedRegisters(value))}
      onRemove={
        target.removeLabel === undefined ?
          undefined
        : () =>
            mutate((current) =>
              synchronizeOtherHazardsPraDerivedRegisters(
                removeStructuredRecord(current, target.focus) as OtherHazardsPRA,
              ),
            )
      }
      removeLabel={target.removeLabel}
    />
  );
}

function RecordTable({
  records,
  section,
  onEdit,
}: {
  records: SemanticRecord[];
  section: RecordSection;
  onEdit: (index: number) => void;
}): JSX.Element {
  if (records.length === 0)
    return (
      <div className="flempty">
        <strong>{section.empty}</strong>
        <p>Add a complete structured record with the section action.</p>
      </div>
    );
  return (
    <div className="fltablewrap">
      <table
        className="fltable"
        aria-label={section.title}
      >
        <thead>
          <tr>
            <th>Record</th>
            {section.columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            <th>Status</th>
            <th>
              <span className="sr-only">Edit</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr key={record.uuid}>
              <td>
                <button
                  type="button"
                  className="fltable__record"
                  onClick={() => onEdit(index)}
                >
                  <strong>{record.name}</strong>
                  <code>{record.code}</code>
                </button>
              </td>
              {section.columns.map((column) => (
                <td key={`${record.uuid}-${column.key}`}>{display(record[column.key])}</td>
              ))}
              <td>
                <span className={`fltag ${statusTone(record.status)}`}>
                  {record.status.replace(/_/g, " ")}
                </span>
              </td>
              <td>
                <button
                  type="button"
                  className="fltable__edit"
                  aria-label={`Edit ${record.name}`}
                  onClick={() => onEdit(index)}
                >
                  <POSIcon.Pencil />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecordSectionView({
  section,
  setTarget,
}: {
  section: RecordSection;
  setTarget: (target: EditorTarget) => void;
}): JSX.Element {
  const { mef, editable } = useOtherHazardsPraWorkbook();
  const records = (valueAt(mef, section.path) ?? []) as SemanticRecord[];
  return (
    <Section
      title={section.title}
      description={section.description}
      actions={
        editable ?
          <AddButton
            label={`Add ${section.singular}`}
            onClick={() => setTarget(collectionTarget(section))}
          />
        : undefined
      }
    >
      <RecordTable
        records={records}
        section={section}
        onEdit={(index) => setTarget(collectionTarget(section, index))}
      />
    </Section>
  );
}

const section = (
  title: string,
  description: string,
  path: EditorPath,
  singular: string,
  columns: Array<{ label: string; key: string }>,
): RecordSection => ({
  title,
  description,
  path,
  singular,
  empty: `No ${title.toLowerCase()} recorded`,
  columns,
});
const common = (root: string): RecordSection[] => [
  section(
    "Model uncertainties",
    "Identify the important parameter, model, and assumption uncertainties, their plausible alternatives, risk effect, and treatment.",
    [root, "modelUncertainties"],
    "uncertainty",
    [
      { label: "Type", key: "uncertaintyType" },
      { label: "Hazards", key: "hazardGroupRefs" },
      { label: "Potential impact", key: "potentialImpact" },
      { label: "Importance", key: "importance" },
    ],
  ),
  section(
    "Pre-operational assumptions",
    "Control unavailable site, design, or as-built information with a limitation, closure action, responsible lifecycle phase, and closure status.",
    [root, "preOperationalAssumptions"],
    "assumption",
    [
      { label: "Missing information", key: "missingDesignInformation" },
      { label: "Closure action", key: "closureAction" },
      { label: "Phase", key: "closurePhase" },
      { label: "Status", key: "closureStatus" },
    ],
  ),
];

const STEP_CONFIG: Record<string, StepConfig> = {
  "site-evidence": {
    root: "analysisBasis",
    sections: [
      section(
        "Controlled evidence",
        "Register the standards, site data, drawings, calculations, models, investigations, test data, reviews, and operating experience used by the analysis.",
        ["analysisBasis", "evidenceRegister"],
        "evidence record",
        [
          { label: "Type", key: "evidenceType" },
          { label: "Source", key: "sourceReference" },
          { label: "Subelements", key: "applicableSubelements" },
          { label: "Controlled", key: "controlled" },
        ],
      ),
      section(
        "Site and regional data",
        "Qualify the meteorological, hydrological, geological, land-use, transportation, air-traffic, biological, industrial, and configuration data that characterize the site.",
        ["analysisBasis", "siteAndRegionalData"],
        "site-data record",
        [
          { label: "Type", key: "dataType" },
          { label: "Coverage", key: "spatialCoverage" },
          { label: "Period", key: "periodStart" },
          { label: "Completeness", key: "completeness" },
        ],
      ),
      section(
        "Design-basis information",
        "Control layouts, drawings, design criteria, qualifications, protection features, procedures, and calculations against the current plant configuration.",
        ["analysisBasis", "designBasisRecords"],
        "design-basis record",
        [
          { label: "Type", key: "informationType" },
          { label: "Source", key: "sourceReference" },
          { label: "Locations", key: "affectedLocations" },
          { label: "Confirmed", key: "currentConfigurationConfirmed" },
        ],
      ),
      section(
        "Operating experience",
        "Capture applicable facility and industry events, observed hazard effects, affected safety functions, and lessons incorporated into the model.",
        ["analysisBasis", "operatingExperience"],
        "operating-experience event",
        [
          { label: "Date", key: "eventDate" },
          { label: "Facility", key: "facilityOrIndustry" },
          { label: "Effects", key: "hazardEffects" },
          { label: "Lessons", key: "lessonsApplied" },
        ],
      ),
    ],
  },
  "retained-hazards": {
    root: "retainedHazardGroups",
    sections: [
      section(
        "Retained hazard groups",
        "Translate HSA dispositions into complete, non-overlapping analysis groups with explicit subhazards, effects, intensity measures, operating states, units, and material sources.",
        ["retainedHazardGroups", "hazardGroups"],
        "hazard group",
        [
          { label: "Category", key: "hazardCategory" },
          { label: "Hazard", key: "hazardName" },
          { label: "Primary effects", key: "primaryEffects" },
          { label: "Intensity measure", key: "selectedIntensityMeasure" },
        ],
      ),
      section(
        "Hazard completeness reviews",
        "Demonstrate that each group covers its applicable subhazards and documents every omitted phenomenon and boundary decision.",
        ["retainedHazardGroups", "completenessReviews"],
        "completeness review",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "Reviewed subhazards", key: "reviewedSubhazards" },
          { label: "Omitted", key: "omittedPhenomena" },
          { label: "Complete", key: "complete" },
        ],
      ),
      section(
        "Overlap controls",
        "Allocate phenomena between Other Hazards and specialized Fire, Flood, Seismic, High Winds, or other analyses without omissions or double counting.",
        ["retainedHazardGroups", "overlapControls"],
        "overlap control",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "Potential overlaps", key: "potentiallyOverlappingElementCodes" },
          { label: "Transferred", key: "transferredOut" },
          { label: "Confirmed", key: "confirmed" },
        ],
      ),
    ],
  },
  "source-characterization": {
    root: "hazardSourceCharacterization",
    sections: [
      section(
        "Hazard sources",
        "Locate and characterize natural, fixed-facility, transport, pipeline, air-traffic, onsite, plant-equipment, biological, and extraterrestrial sources.",
        ["hazardSourceCharacterization", "hazardSources"],
        "hazard source",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "Source type", key: "sourceType" },
          { label: "Location", key: "sourceLocation" },
          { label: "Distance (km)", key: "distanceToPlantKilometres" },
        ],
      ),
      section(
        "Intensity measures",
        "Define the physical parameter, units, measurement basis, range, resolution, and compatibility used to connect the hazard, fragility, and plant-response models.",
        ["hazardSourceCharacterization", "intensityMeasures"],
        "intensity measure",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "Parameter", key: "parameterName" },
          { label: "Unit", key: "unit" },
          { label: "Range", key: "analysisRange" },
        ],
      ),
      section(
        "Hazard-effect models",
        "Convert source severity into the pressure, thermal, impact, toxic, corrosive, blockage, temperature, access, or other effects experienced at the plant.",
        ["hazardSourceCharacterization", "effectModels"],
        "effect model",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "Effect", key: "hazardEffect" },
          { label: "Method", key: "modelMethod" },
          { label: "Output", key: "outputQuantity" },
        ],
      ),
      section(
        "Spatial zones",
        "Map source-to-site variation, shielding, attenuation, affected buildings, rooms, outdoor areas, and multi-unit or multi-source exposure.",
        ["hazardSourceCharacterization", "spatialZones"],
        "spatial zone",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "Zone", key: "zoneName" },
          { label: "Locations", key: "plantLocations" },
          { label: "Variation", key: "intensityVariation" },
        ],
      ),
      section(
        "Hazard timelines",
        "Define warning, onset, rise, duration, recovery environment, cues, and temporal dependencies used in scenario and HRA development.",
        ["hazardSourceCharacterization", "timelineModels"],
        "timeline model",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "Onset", key: "onsetType" },
          { label: "Warning (h)", key: "warningTimeHours" },
          { label: "Duration (h)", key: "durationHours" },
        ],
      ),
    ],
  },
  "frequency-analysis": {
    root: "hazardFrequencyAnalysis",
    sections: [
      section(
        "Occurrence datasets",
        "Qualify site-specific, regional, generic, historical, experimental, simulated, and expert evidence used to estimate annual occurrence and severity.",
        ["hazardFrequencyAnalysis", "occurrenceDataSets"],
        "occurrence dataset",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "Type", key: "dataSourceType" },
          { label: "Events", key: "eventCount" },
          { label: "Observation years", key: "observationYears" },
        ],
      ),
      section(
        "Occurrence models",
        "Fit occurrence, severity, spatial, temporal, calibration, goodness-of-fit, and rare-tail models for each retained hazard group.",
        ["hazardFrequencyAnalysis", "occurrenceModels"],
        "occurrence model",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "Model", key: "modelType" },
          { label: "Rate /yr", key: "occurrenceRatePerYear" },
          { label: "Fit", key: "goodnessOfFit" },
        ],
      ),
      section(
        "Regional applicability",
        "Compare source-region and site attributes, quantify differences, and justify adjustments and conservatism when non-site data are used.",
        ["hazardFrequencyAnalysis", "regionalApplicabilityAssessments"],
        "applicability assessment",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "Dataset", key: "dataSetRef" },
          { label: "Differences", key: "differences" },
          { label: "Applicable", key: "applicable" },
        ],
      ),
      section(
        "Formal expert judgment",
        "Control elicitation questions, expert independence, briefing, calibration, aggregation, and results where empirical evidence is insufficient.",
        ["hazardFrequencyAnalysis", "expertJudgmentPanels"],
        "expert-judgment panel",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "Question", key: "elicitationQuestion" },
          { label: "Experts", key: "experts" },
          { label: "Aggregation", key: "aggregationMethod" },
        ],
      ),
      section(
        "Frequency results",
        "Record mean and uncertainty percentile exceedance frequencies at defined intensities, units, and plant locations.",
        ["hazardFrequencyAnalysis", "frequencyResults"],
        "frequency result",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "Intensity", key: "intensityValue" },
          { label: "Mean /yr", key: "meanAnnualExceedanceFrequency" },
          { label: "95th /yr", key: "ninetyFifthPercentileFrequency" },
        ],
      ),
    ],
  },
  "secondary-hazards": {
    root: "secondaryAndCombinedHazards",
    sections: [
      section(
        "Secondary-hazard scenarios",
        "Identify fire, flood, explosion, missile, toxic, collapse, power-loss, and other effects generated by each primary hazard and route them to the proper analysis.",
        ["secondaryAndCombinedHazards", "secondaryHazardScenarios"],
        "secondary-hazard scenario",
        [
          { label: "Primary hazard", key: "primaryHazardGroupRef" },
          { label: "Secondary hazard", key: "secondaryHazardType" },
          { label: "Conditional probability", key: "conditionalOccurrenceProbability" },
          { label: "Analysis element", key: "analysisElementCode" },
        ],
      ),
      section(
        "Combined-hazard assessments",
        "Model causal, coincident, sequential, and common-condition hazard combinations with joint frequency, dependence, plant response, and double-counting controls.",
        ["secondaryAndCombinedHazards", "combinedHazardAssessments"],
        "combined-hazard assessment",
        [
          { label: "Primary hazard", key: "primaryHazardGroupRef" },
          { label: "Combined hazards", key: "combinedHazards" },
          { label: "Relationship", key: "relationship" },
          { label: "Effects", key: "combinedEffects" },
        ],
      ),
      section(
        "Transferred analyses",
        "Track secondary-hazard content accepted by Fire, Internal Flood, External Flood, initiating-event, systems, HRA, quantification, or risk-integration models.",
        ["secondaryAndCombinedHazards", "transferredAnalyses"],
        "analysis transfer",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "Destination", key: "destinationElementCode" },
          { label: "Content", key: "transferContent" },
          { label: "Acceptance", key: "acceptanceStatus" },
        ],
      ),
      section(
        "Dependency controls",
        "Control shared causes, timing, equipment, locations, data, and operator-response dependencies created by secondary and combined hazards.",
        ["secondaryAndCombinedHazards", "dependencyControls"],
        "dependency control",
        [
          { label: "Description", key: "description" },
          { label: "Basis", key: "basis" },
          { label: "Related records", key: "relatedRefs" },
          { label: "Status", key: "status" },
        ],
      ),
    ],
  },
  "hazard-curves": {
    root: "hazardCurveAnalysis",
    sections: [
      section(
        "Hazard logic-tree branches",
        "Represent data, occurrence, severity, source-to-site, effect-model, and expert alternatives with controlled weights and rationale.",
        ["hazardCurveAnalysis", "logicTreeBranches"],
        "logic-tree branch",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "Branch type", key: "branchType" },
          { label: "Choice", key: "branchChoice" },
          { label: "Weight", key: "branchWeight" },
        ],
      ),
      section(
        "Hazard curves",
        "Produce mean, percentile, fractile, or branch curves on a controlled intensity basis with interpolation, extrapolation, and upper-tail treatment.",
        ["hazardCurveAnalysis", "hazardCurves"],
        "hazard curve",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "Location", key: "location" },
          { label: "Curve type", key: "curveType" },
          { label: "Points", key: "curvePoints" },
        ],
      ),
      section(
        "Hazard intervals",
        "Discretize each curve into nonoverlapping intensity intervals with representative intensities, annual frequencies, conditional weights, and upper-tail flags.",
        ["hazardCurveAnalysis", "hazardIntervals"],
        "hazard interval",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "Lower", key: "lowerIntensity" },
          { label: "Upper", key: "upperIntensity" },
          { label: "Frequency /yr", key: "intervalAnnualFrequency" },
        ],
      ),
      section(
        "Hazard convergence",
        "Verify interval refinement, upper-tail extension, truncation, sampling, and scenario grouping do not materially change risk results.",
        ["hazardCurveAnalysis", "convergenceStudies"],
        "convergence study",
        [
          { label: "Type", key: "studyType" },
          { label: "Tested values", key: "testedValues" },
          { label: "Maximum difference", key: "maximumRelativeDifference" },
          { label: "Converged", key: "converged" },
        ],
      ),
    ],
  },
  "preliminary-response": {
    root: "preliminaryPlantResponse",
    sections: [
      section(
        "Preliminary initiating events",
        "Identify direct, secondary, degraded-condition, common-cause, and multi-unit initiators and the affected operating states, units, material sources, and safety functions.",
        ["preliminaryPlantResponse", "preliminaryInitiatingEvents"],
        "preliminary initiating event",
        [
          { label: "Type", key: "eventType" },
          { label: "Initiator", key: "initiatingEventRef" },
          { label: "Hazards", key: "hazardGroupRefs" },
          { label: "Functions", key: "affectedSafetyFunctions" },
        ],
      ),
      section(
        "Baseline-model reviews",
        "Review event sequences, systems, success criteria, data, HRA, Level 2, and peer-review findings for Other Hazards gaps and required changes.",
        ["preliminaryPlantResponse", "modelReviews"],
        "model review",
        [
          { label: "Review", key: "reviewType" },
          { label: "Gap", key: "otherHazardsGap" },
          { label: "Required change", key: "requiredChange" },
          { label: "Closure", key: "closureStatus" },
        ],
      ),
      section(
        "Other Hazards SSC list",
        "Identify each exposed SSC, location, credited function, hazard effects, realistic failure modes, supporting elements, investigation links, and model disposition.",
        ["preliminaryPlantResponse", "otherHazardsSscList"],
        "SSC-list entry",
        [
          { label: "SSC", key: "sscName" },
          { label: "Location", key: "building" },
          { label: "Effects", key: "applicableHazardEffects" },
          { label: "Disposition", key: "disposition" },
        ],
      ),
      section(
        "Functional requirements",
        "Define the SSCs, supports, operator actions, operating states, and mission time required for each credited safety function.",
        ["preliminaryPlantResponse", "functionalRequirements"],
        "functional requirement",
        [
          { label: "Function", key: "safetyFunction" },
          { label: "Required SSCs", key: "requiredSscRefs" },
          { label: "Operator actions", key: "requiredOperatorActionRefs" },
          { label: "Mission (h)", key: "missionTimeHours" },
        ],
      ),
    ],
  },
  investigation: {
    root: "plantInvestigation",
    sections: [
      section(
        "Plant investigations",
        "Perform walkdowns, interviews, talk-throughs, document reviews, site reconnaissance, and surveys that confirm hazard sources, SSCs, protection, access, and configuration.",
        ["plantInvestigation", "investigations"],
        "investigation",
        [
          { label: "Type", key: "investigationType" },
          { label: "Scope", key: "scope" },
          { label: "Locations", key: "locations" },
          { label: "Date", key: "performedDate" },
        ],
      ),
      section(
        "Investigation findings",
        "Disposition configuration, interaction, protection, inventory, access, procedure, and degradation observations into the model or corrective-action process.",
        ["plantInvestigation", "findings"],
        "finding",
        [
          { label: "Type", key: "findingType" },
          { label: "Location", key: "location" },
          { label: "Condition", key: "condition" },
          { label: "Closure", key: "closureStatus" },
        ],
      ),
      section(
        "Configuration confirmations",
        "Confirm the source records and governing configuration items against as-built/as-operated or as-designed/as-intended plant conditions.",
        ["plantInvestigation", "configurationConfirmations"],
        "configuration confirmation",
        [
          { label: "Source record", key: "sourceRecordRef" },
          { label: "Plant basis", key: "plantConditionBasis" },
          { label: "Discrepancies", key: "discrepancies" },
          { label: "Confirmed", key: "confirmed" },
        ],
      ),
      section(
        "Operator access routes",
        "Verify action routes, hazard effects, travel time, protective equipment, availability, and alternates under the modeled hazard conditions.",
        ["plantInvestigation", "accessRouteChecks"],
        "access-route check",
        [
          { label: "Actions", key: "humanActionRefs" },
          { label: "Route", key: "routeDescription" },
          { label: "Travel (min)", key: "travelTimeMinutes" },
          { label: "Available", key: "available" },
        ],
      ),
    ],
  },
  "fragility-basis": {
    root: "fragilityBasis",
    sections: [
      section(
        "SSC screening decisions",
        "Screen or retain each SSC, hazard effect, failure mode, scenario, or sequence family using an approved criterion and investigation-supported conservative basis.",
        ["fragilityBasis", "screeningDecisions"],
        "screening decision",
        [
          { label: "Objects", key: "screenedObjectRefs" },
          { label: "Hazards", key: "hazardGroupRefs" },
          { label: "Criterion", key: "criterion" },
          { label: "Disposition", key: "disposition" },
        ],
      ),
      section(
        "Fragility method selections",
        "Select plant-specific analysis, test, experience, generic fragility, design capacity, screening bound, or human-response methods with intensity compatibility demonstrated.",
        ["fragilityBasis", "methodSelections"],
        "method selection",
        [
          { label: "SSCs", key: "sscRefs" },
          { label: "Hazards", key: "hazardGroupRefs" },
          { label: "Method", key: "methodType" },
          { label: "Capability", key: "capabilityTreatment" },
        ],
      ),
      section(
        "Fragility correlation groups",
        "Group SSCs with shared hazard demand, construction, capacity, spatial, or causal dependencies and define the model treatment.",
        ["fragilityBasis", "correlationGroups"],
        "correlation group",
        [
          { label: "Hazards", key: "hazardGroupRefs" },
          { label: "Members", key: "memberSscRefs" },
          { label: "Type", key: "correlationType" },
          { label: "Coefficient", key: "correlationCoefficient" },
        ],
      ),
      section(
        "Generic-data applicability",
        "Compare generic test, experience, or fragility evidence with target SSCs and document adjustments, differences, conservatism, and applicability.",
        ["fragilityBasis", "genericDataApplicability"],
        "applicability assessment",
        [
          { label: "Source", key: "genericSourceRef" },
          { label: "Target SSCs", key: "targetSscRefs" },
          { label: "Differences", key: "differences" },
          { label: "Applicable", key: "applicable" },
        ],
      ),
    ],
  },
  "fragility-analysis": {
    root: "fragilityAnalysis",
    sections: [
      section(
        "Hazard demand models",
        "Calculate SSC demand from the selected hazard intensity with spatial, dynamic, temporal, shielding, and source-to-target factors explicit.",
        ["fragilityAnalysis", "demandModels"],
        "demand model",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "SSCs", key: "sscRefs" },
          { label: "Quantity", key: "demandQuantity" },
          { label: "Output", key: "outputRange" },
        ],
      ),
      section(
        "SSC capacity models",
        "Establish median capacity, randomness, uncertainty, aging, condition, test, experience, and failure-mode basis for each retained SSC.",
        ["fragilityAnalysis", "capacityModels"],
        "capacity model",
        [
          { label: "SSC", key: "sscRef" },
          { label: "Failure mode", key: "failureModeRef" },
          { label: "Median", key: "medianCapacity" },
          { label: "Betas", key: "randomnessBeta" },
        ],
      ),
      section(
        "Fragility curves",
        "Quantify conditional failure probability over the compatible hazard intensity range and retain method, demand, capacity, correlation, and cross-hazard traceability.",
        ["fragilityAnalysis", "fragilityCurves"],
        "fragility curve",
        [
          { label: "SSC", key: "sscRef" },
          { label: "Hazard", key: "hazardGroupRef" },
          { label: "Median intensity", key: "medianCapacityIntensity" },
          { label: "Curve points", key: "curvePoints" },
        ],
      ),
      section(
        "Functional-failure models",
        "Model operator incapacitation, loss of access, loss of cues, environmental exposure, procedure unavailability, and other functional failures not represented by physical SSC fragility.",
        ["fragilityAnalysis", "functionalFailureModels"],
        "functional-failure model",
        [
          { label: "Hazard", key: "hazardGroupRef" },
          { label: "Function", key: "affectedFunction" },
          { label: "Mechanism", key: "physicalOrHumanMechanism" },
          { label: "Destinations", key: "destinationModelRefs" },
        ],
      ),
      section(
        "Secondary-effect fragilities",
        "Connect generated fire, flood, explosion, missile, collapse, or toxic scenarios to the affected SSCs, failure modes, and conditional fragility models.",
        ["fragilityAnalysis", "secondaryEffectFragilities"],
        "secondary-effect fragility",
        [
          { label: "Primary hazard", key: "primaryHazardGroupRef" },
          { label: "Secondary scenario", key: "secondaryHazardScenarioRef" },
          { label: "Affected SSCs", key: "affectedSscRefs" },
          { label: "Fragilities", key: "fragilityRefs" },
        ],
      ),
    ],
  },
  scenarios: {
    root: "initiatingEventAndScenarioDevelopment",
    sections: [
      section(
        "Initiating-event models",
        "Define direct, degraded, secondary, support-system, operator-incapacitation, and multi-unit initiators with frequency derivation and affected scope.",
        ["initiatingEventAndScenarioDevelopment", "initiatingEventModels"],
        "initiating-event model",
        [
          { label: "Type", key: "initiatingEventType" },
          { label: "Hazards", key: "hazardGroupRefs" },
          { label: "Event definition", key: "eventDefinition" },
          { label: "Secondary hazards", key: "secondaryHazardRefs" },
        ],
      ),
      section(
        "Scenario families",
        "Group source, location, intensity interval, SSC damage, initiating event, operating state, unit, material source, and secondary effects that share plant response.",
        ["initiatingEventAndScenarioDevelopment", "scenarioFamilies"],
        "scenario family",
        [
          { label: "Hazards", key: "hazardGroupRefs" },
          { label: "Initiators", key: "initiatingEventRefs" },
          { label: "SSCs", key: "affectedSscRefs" },
          { label: "Intervals", key: "hazardIntervalRefs" },
        ],
      ),
      section(
        "Scenario timelines",
        "Align warning, initiating event, equipment failures, operator action windows, stable end state, and recovery for each scenario family.",
        ["initiatingEventAndScenarioDevelopment", "scenarioTimelines"],
        "scenario timeline",
        [
          { label: "Scenario", key: "scenarioFamilyRef" },
          { label: "Warning (h)", key: "warningTimeHours" },
          { label: "Stable state (h)", key: "stableEndStateTimeHours" },
          { label: "Recovery (h)", key: "recoveryStartTimeHours" },
        ],
      ),
      section(
        "Secondary-scenario links",
        "Link primary scenarios to accepted secondary-hazard model records and the affected plant-response logic.",
        ["initiatingEventAndScenarioDevelopment", "secondaryScenarioLinks"],
        "secondary-scenario link",
        [
          { label: "Description", key: "description" },
          { label: "Basis", key: "basis" },
          { label: "Related records", key: "relatedRefs" },
          { label: "Status", key: "status" },
        ],
      ),
      section(
        "Industry experience events",
        "Apply operating experience to initiators, equipment failures, human performance, recovery, and scenario-model assumptions.",
        ["initiatingEventAndScenarioDevelopment", "industryExperienceEvents"],
        "industry event",
        [
          { label: "Date", key: "eventDate" },
          { label: "Facility", key: "facility" },
          { label: "Initiators", key: "initiatingEvents" },
          { label: "Model uses", key: "modelApplications" },
        ],
      ),
    ],
  },
  "plant-response": {
    root: "plantResponseModel",
    sections: [
      section(
        "Peer-review dispositions",
        "Resolve applicable internal-events and hazard-PRA findings before reusing the affected sequence, system, success-criteria, data, HRA, or Level 2 model.",
        ["plantResponseModel", "peerReviewDispositions"],
        "peer-review disposition",
        [
          { label: "Source element", key: "sourcePraElement" },
          { label: "Finding", key: "findingId" },
          { label: "Relevance", key: "relevanceToOtherHazards" },
          { label: "Closure", key: "closureStatus" },
        ],
      ),
      section(
        "Other Hazards event sequences",
        "Adapt event-tree logic to hazard-group and scenario conditions, operating states, units, material sources, mission time, and Level 2 end states.",
        ["plantResponseModel", "eventSequenceModels"],
        "event-sequence model",
        [
          { label: "Hazards", key: "hazardGroupRefs" },
          { label: "Scenario families", key: "scenarioFamilyRefs" },
          { label: "Sequence family", key: "eventSequenceFamilyRef" },
          { label: "End states", key: "endStates" },
        ],
      ),
      section(
        "Hazard-specific success criteria",
        "Confirm credited equipment, trains, capacity, timing, supports, operator actions, and analysis evidence for each safety function and sequence family.",
        ["plantResponseModel", "successCriteria"],
        "success criterion",
        [
          { label: "Function", key: "safetyFunction" },
          { label: "Criterion", key: "criterion" },
          { label: "Mission (h)", key: "missionTimeHours" },
          { label: "Validated", key: "validated" },
        ],
      ),
      section(
        "System-model modifications",
        "Implement hazard failure modes, fragilities, added basic events, dependencies, correlations, and logic changes in the baseline system models.",
        ["plantResponseModel", "systemModelModifications"],
        "system-model modification",
        [
          { label: "Source system", key: "sourceSystemModelRef" },
          { label: "Hazards", key: "hazardGroupRefs" },
          { label: "Added events", key: "addedBasicEvents" },
          { label: "Verification", key: "verificationRefs" },
        ],
      ),
      section(
        "Mission times and recovery",
        "Define realistic or bounding mission time, stable end state, hazard duration, recovery model, and supporting operating experience.",
        ["plantResponseModel", "missionTimes"],
        "mission-time record",
        [
          { label: "Hazards", key: "hazardGroupRefs" },
          { label: "Mission (h)", key: "missionTimeHours" },
          { label: "Stable state", key: "stableEndState" },
          { label: "Basis", key: "boundingOrRealistic" },
        ],
      ),
      section(
        "Other Hazards data parameters",
        "Control basic-event, recovery, common-cause, correlation, mission-time, and hazard-conditional values and uncertainty distributions.",
        ["plantResponseModel", "dataParameters"],
        "data parameter",
        [
          { label: "Type", key: "parameterType" },
          { label: "Point estimate", key: "pointEstimate" },
          { label: "Distribution", key: "distribution" },
          { label: "Units", key: "units" },
        ],
      ),
      section(
        "Correlation models",
        "Implement shared demand, shared capacity, and conditional dependence among hazard-related basic events and affected SSCs.",
        ["plantResponseModel", "correlationModels"],
        "correlation model",
        [
          { label: "Hazards", key: "hazardGroupRefs" },
          { label: "Group", key: "correlationGroupRef" },
          { label: "Members", key: "memberBasicEventRefs" },
          { label: "Treatment", key: "quantificationTreatment" },
        ],
      ),
      section(
        "Multi-unit and multi-source response",
        "Represent shared SSCs, resources, actions, site conditions, dependencies, and coupled scenarios across reactor units and other radionuclide sources.",
        ["plantResponseModel", "multiUnitAssessments"],
        "multi-unit assessment",
        [
          { label: "Hazards", key: "hazardGroupRefs" },
          { label: "Units", key: "affectedUnitRefs" },
          { label: "Shared SSCs", key: "sharedSscRefs" },
          { label: "Shared actions", key: "sharedHumanActionRefs" },
        ],
      ),
      section(
        "Level 2 interfaces",
        "Transfer hazard damage attributes, plant-damage states, confinement status, dependent failures, and release categories to Level 2 models.",
        ["plantResponseModel", "levelTwoInterfaces"],
        "Level 2 interface",
        [
          { label: "Sequences", key: "eventSequenceRefs" },
          { label: "Damage states", key: "plantDamageStateRefs" },
          { label: "Release categories", key: "releaseCategoryRefs" },
          { label: "Accepted", key: "acceptedByLevelTwo" },
        ],
      ),
    ],
  },
  "human-reliability": {
    root: "humanReliabilityAnalysis",
    sections: [
      section(
        "Other Hazards human actions",
        "Identify preparatory, diagnosis, response, recovery, local, remote, and multi-unit actions with procedures, cues, locations, timing, staff, equipment, and credit.",
        ["humanReliabilityAnalysis", "humanActions"],
        "human action",
        [
          { label: "Type", key: "actionType" },
          { label: "Hazards", key: "hazardGroupRefs" },
          { label: "Location", key: "actionLocation" },
          { label: "Time available (min)", key: "timeAvailableMinutes" },
        ],
      ),
      section(
        "Human failure events",
        "Define the modeled failure, basic event, affected sequences and safety functions, dependency group, and exclusive-recovery treatment for each credited action.",
        ["humanReliabilityAnalysis", "humanFailureEvents"],
        "human failure event",
        [
          { label: "Action", key: "humanActionRef" },
          { label: "Failure", key: "failureDefinition" },
          { label: "Sequences", key: "affectedEventSequenceRefs" },
          { label: "Basic event", key: "modeledBasicEventRef" },
        ],
      ),
      section(
        "Hazard performance contexts",
        "Characterize warning, workload, habitability, toxic or physical conditions, access, communications, cues, staffing, protective equipment, and multi-unit demands.",
        ["humanReliabilityAnalysis", "performanceContexts"],
        "performance context",
        [
          { label: "Action", key: "humanActionRef" },
          { label: "Hazards", key: "hazardGroupRefs" },
          { label: "Environment", key: "environmentalConditions" },
          { label: "Access", key: "accessConditions" },
        ],
      ),
      section(
        "HEP estimates",
        "Quantify nominal and hazard-context HEP, timing margin, dependency, recovery credit, uncertainty, and method basis.",
        ["humanReliabilityAnalysis", "hepEstimates"],
        "HEP estimate",
        [
          { label: "HFE", key: "humanFailureEventRef" },
          { label: "Method", key: "method" },
          { label: "Nominal HEP", key: "nominalHep" },
          { label: "Hazard HEP", key: "otherHazardsHep" },
        ],
      ),
      section(
        "Action confirmations",
        "Record procedure reviews, interviews, talk-throughs, tabletop exercises, and simulations used to confirm interpretation, timing, feasibility, and model changes.",
        ["humanReliabilityAnalysis", "confirmations"],
        "action confirmation",
        [
          { label: "Actions", key: "humanActionRefs" },
          { label: "Type", key: "confirmationType" },
          { label: "Procedure confirmed", key: "confirmedProcedureInterpretation" },
          { label: "Model changes", key: "modelChanges" },
        ],
      ),
      section(
        "Recovery assessments",
        "Reevaluate baseline recovery against hazard damage, access, resources, timing, and whether the source recovery model remains valid.",
        ["humanReliabilityAnalysis", "recoveryAssessments"],
        "recovery assessment",
        [
          { label: "Source model", key: "sourceRecoveryModelRef" },
          { label: "Earliest recovery (h)", key: "earliestRecoveryTimeHours" },
          { label: "Probability", key: "recoveryProbability" },
          { label: "Remains valid", key: "remainsValidUnderOtherHazards" },
        ],
      ),
      section(
        "HRA dependencies",
        "Model shared crews, cues, locations, timing, hazard conditions, dependency level, and joint failure probability.",
        ["humanReliabilityAnalysis", "dependencyAssessments"],
        "dependency assessment",
        [
          { label: "HFEs", key: "humanFailureEventRefs" },
          { label: "Shared crews", key: "sharedCrews" },
          { label: "Dependency", key: "dependencyLevel" },
          { label: "Joint probability", key: "jointFailureProbability" },
        ],
      ),
    ],
  },
  quantification: {
    root: "eventSequenceQuantification",
    sections: [
      section(
        "Quantification runs",
        "Control model version, hazard curves and intervals, fragilities, event sequences, HRA, numerical treatment, truncation, sampling, software, and run date.",
        ["eventSequenceQuantification", "quantificationRuns"],
        "quantification run",
        [
          { label: "Model", key: "modelVersion" },
          { label: "Hazards", key: "hazardGroupRefs" },
          { label: "Samples", key: "uncertaintySampleCount" },
          { label: "Software", key: "softwareAndVersion" },
        ],
      ),
      section(
        "Hazard-interval results",
        "Calculate conditional sequence probability and annual sequence frequency for each hazard interval and sequence family, with dominant fragility and basic-event contributors.",
        ["eventSequenceQuantification", "hazardIntervalResults"],
        "hazard-interval result",
        [
          { label: "Interval", key: "hazardIntervalRef" },
          { label: "Sequence family", key: "eventSequenceFamilyRef" },
          { label: "Conditional probability", key: "conditionalSequenceProbability" },
          { label: "Frequency /yr", key: "sequenceFrequencyPerPlantYear" },
        ],
      ),
      section(
        "Event-sequence-family results",
        "Aggregate results by sequence family, hazard group, operating state, unit, material source, plant-damage state, and release category with uncertainty percentiles.",
        ["eventSequenceQuantification", "eventSequenceFamilyResults"],
        "sequence-family result",
        [
          { label: "Family", key: "eventSequenceFamilyRef" },
          { label: "Hazards", key: "hazardGroupRefs" },
          { label: "Mean /yr", key: "meanFrequencyPerPlantYear" },
          { label: "95th /yr", key: "ninetyFifthPercentileFrequencyPerPlantYear" },
        ],
      ),
      section(
        "Quantification convergence",
        "Test hazard intervals, upper tail, truncation, sampling, scenario grouping, and other numerical choices against explicit acceptance criteria.",
        ["eventSequenceQuantification", "convergenceStudies"],
        "convergence study",
        [
          { label: "Type", key: "studyType" },
          { label: "Tested values", key: "testedValues" },
          { label: "Maximum difference", key: "maximumRelativeDifference" },
          { label: "Converged", key: "converged" },
        ],
      ),
      section(
        "Integrated uncertainty results",
        "Propagate hazard, fragility, plant-response, HRA, and numerical uncertainty into mean and percentile risk metrics.",
        ["eventSequenceQuantification", "uncertaintyResults"],
        "uncertainty result",
        [
          { label: "Metric", key: "riskMetric" },
          { label: "Mean", key: "meanValue" },
          { label: "5th", key: "fifthPercentile" },
          { label: "95th", key: "ninetyFifthPercentile" },
        ],
      ),
      section(
        "Risk contributors",
        "Rank hazard groups, intervals, SSCs, failure modes, human failure events, scenarios, sequence families, and uncertainties by absolute and fractional contribution.",
        ["eventSequenceQuantification", "riskContributors"],
        "risk contributor",
        [
          { label: "Type", key: "contributorType" },
          { label: "Contributor", key: "contributorRef" },
          { label: "Fraction", key: "fractionalContribution" },
          { label: "Rank", key: "rank" },
        ],
      ),
      section(
        "Quantification screening",
        "Document any screened event-sequence families with an approved criterion, conservative assumptions, quantitative value, aggregate frequency, and affected results.",
        ["eventSequenceQuantification", "screeningDecisions"],
        "screening decision",
        [
          { label: "Objects", key: "screenedObjectRefs" },
          { label: "Criterion", key: "criterion" },
          { label: "Aggregate /yr", key: "aggregateFrequencyPerPlantYear" },
          { label: "Disposition", key: "disposition" },
        ],
      ),
    ],
  },
  "risk-interpretation": {
    sections: [
      section(
        "Integrated uncertainties",
        "Bring together the material hazard, fragility, plant-response, HRA, numerical, and assumption uncertainties that can affect conclusions and decisions.",
        ["integratedUncertainties"],
        "integrated uncertainty",
        [
          { label: "Source", key: "sourceSubelement" },
          { label: "Type", key: "uncertaintyType" },
          { label: "Potential impact", key: "potentialImpact" },
          { label: "Importance", key: "importance" },
        ],
      ),
      section(
        "Sensitivity studies",
        "Quantify reasonable alternatives for hazard models, fragility, correlation, HRA, success states, screening, recovery, and numerical treatment.",
        ["riskInterpretation", "sensitivityStudies"],
        "sensitivity study",
        [
          { label: "Type", key: "studyType" },
          { label: "Varied inputs", key: "variedInputs" },
          { label: "Relative change", key: "relativeChange" },
          { label: "Conclusion", key: "conclusion" },
        ],
      ),
      section(
        "Other Hazards risk insights",
        "Interpret dominant hazards, scenarios, SSC vulnerabilities, human actions, dependencies, uncertainty, defense in depth, and risk-reduction opportunities.",
        ["riskInterpretation", "riskInsights"],
        "risk insight",
        [
          { label: "Type", key: "insightType" },
          { label: "Hazards", key: "hazardGroupRefs" },
          { label: "Contributors", key: "contributorRefs" },
          { label: "Implication", key: "decisionImplication" },
        ],
      ),
      section(
        "Model refinements",
        "Prioritize technically meaningful hazard, source, investigation, fragility, plant-response, HRA, quantification, and documentation improvements.",
        ["riskInterpretation", "refinementActions"],
        "refinement action",
        [
          { label: "Area", key: "technicalArea" },
          { label: "Priority", key: "priority" },
          { label: "Refinement", key: "refinement" },
          { label: "Status", key: "refinementStatus" },
        ],
      ),
      section(
        "Refinement iterations",
        "Demonstrate stable aggregate and family results, contributor rankings, and absence of new risk-significant contributors across controlled model versions.",
        ["riskInterpretation", "quantificationIterations"],
        "refinement iteration",
        [
          { label: "Model", key: "modelVersion" },
          { label: "Aggregate /yr", key: "aggregateMeanFrequencyPerPlantYear" },
          { label: "Maximum family change", key: "maximumFamilyFrequencyChange" },
          { label: "Decision", key: "decision" },
        ],
      ),
    ],
  },
  "risk-integration": {
    sections: [
      section(
        "Risk Integration results",
        "Transfer Other Hazards results by operating state, unit, material source, sequence family, damage state, and release category with overlap controlled.",
        ["riskInterpretation", "integrationResults"],
        "integration result",
        [
          { label: "Model", key: "modelVersion" },
          { label: "Mean /yr", key: "meanFrequencyPerPlantYear" },
          { label: "Release categories", key: "releaseCategoryRefs" },
          { label: "Status", key: "integrationStatus" },
        ],
      ),
      section(
        "Integration overlap controls",
        "Demonstrate how Other Hazards results avoid double counting with Fire, Flood, Seismic, High Winds, initiating events, and other technical elements.",
        ["riskInterpretation", "overlapControls"],
        "overlap control",
        [
          { label: "Hazard group", key: "hazardGroupRef" },
          { label: "Potential overlaps", key: "potentiallyOverlappingElementCodes" },
          { label: "Transferred", key: "transferredOut" },
          { label: "Confirmed", key: "confirmed" },
        ],
      ),
      section(
        "Risk-informed decisions",
        "Record design, procedure, configuration, monitoring, data, model-control, and emergency-preparedness actions with verification and reanalysis triggers.",
        ["riskInterpretation", "riskDecisions"],
        "risk decision",
        [
          { label: "Type", key: "decisionType" },
          { label: "Action", key: "action" },
          { label: "Disposition", key: "disposition" },
          { label: "Reanalysis", key: "reanalysisRequired" },
        ],
      ),
      section(
        "End-to-end traceability",
        "Link evidence, hazards, source models, curves, SSC scope, investigations, fragilities, initiators, HRA, sequence families, results, and decisions.",
        ["riskInterpretation", "traceabilityPaths"],
        "traceability path",
        [
          { label: "Hazards", key: "hazardGroupRefs" },
          { label: "Fragilities", key: "fragilityRefs" },
          { label: "Results", key: "resultRefs" },
          { label: "Complete", key: "complete" },
        ],
      ),
      section(
        "Controlled baselines",
        "Release the model, quantification run, report, peer review, manifest, limitations, and configuration-control record as one reproducible baseline.",
        ["riskInterpretation", "controlledBaselines"],
        "controlled baseline",
        [
          { label: "Model", key: "modelVersion" },
          { label: "Run", key: "quantificationRunRef" },
          { label: "Control record", key: "configurationControlRecordId" },
          { label: "Status", key: "releaseStatus" },
        ],
      ),
    ],
  },
  "technical-closure": {
    root: "technicalClosure",
    sections: [
      section(
        "Conformance reviews",
        "Review the evidence and satisfied-by links for every applicable OHA, OFR, and OPR supporting requirement.",
        ["technicalClosure", "conformanceReviews"],
        "conformance review",
        [
          { label: "Result", key: "description" },
          { label: "Basis", key: "basis" },
          { label: "Evidence", key: "evidenceRefs" },
          { label: "Status", key: "status" },
        ],
      ),
      section(
        "Documentation checks",
        "Verify that inputs, analysis, results, uncertainty, limitations, interfaces, and configuration references are complete and reproducible.",
        ["technicalClosure", "documentationChecks"],
        "documentation check",
        [
          { label: "Result", key: "description" },
          { label: "Basis", key: "basis" },
          { label: "Evidence", key: "evidenceRefs" },
          { label: "Status", key: "status" },
        ],
      ),
      section(
        "Interface closure checks",
        "Confirm every external technical-element input and output is controlled, consistent, accepted, traceable, and free of open items.",
        ["technicalClosure", "interfaceClosureChecks"],
        "interface closure check",
        [
          { label: "Result", key: "description" },
          { label: "Basis", key: "basis" },
          { label: "Related records", key: "relatedRefs" },
          { label: "Status", key: "status" },
        ],
      ),
      section(
        "Peer-review team",
        "Record independent team roles, organizations, qualifications, experience, independence, and assigned review scope.",
        ["technicalClosure", "peerReviewTeam"],
        "team member",
        [
          { label: "Role", key: "role" },
          { label: "Organization", key: "organization" },
          { label: "Qualifications", key: "qualifications" },
          { label: "Scope", key: "reviewScope" },
        ],
      ),
      section(
        "Peer-review findings",
        "Track facts and observations, suggestions, best practices, and comments through evidence-backed resolution and closure.",
        ["technicalClosure", "peerReviewFindings"],
        "peer-review finding",
        [
          { label: "Area", key: "reviewArea" },
          { label: "Category", key: "findingCategory" },
          { label: "Significance", key: "significance" },
          { label: "Closure", key: "closureStatus" },
        ],
      ),
      section(
        "Readiness checks",
        "Confirm the controlled analysis package is complete and suitable for technical review, approval, and configuration-controlled release.",
        ["technicalClosure", "readinessChecks"],
        "readiness check",
        [
          { label: "Result", key: "description" },
          { label: "Basis", key: "basis" },
          { label: "Evidence", key: "evidenceRefs" },
          { label: "Status", key: "status" },
        ],
      ),
    ],
  },
};

function technicalList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

type ScopeDraft = {
  applicationName: string;
  purpose: string;
  decisionContext: string;
  supportedRiskMetrics: string;
  plantName: string;
  siteName: string;
  vendor: string;
  reactorType: string;
  thermalPower: string;
  numberOfModules: number;
  praScope: string;
  capabilityCategory: NonNullable<OtherHazardsPRA["capabilityCategory"]>;
  plantStage: OtherHazardsPRA["plantStage"];
};

function AnalysisScopeEditor({ onClose }: { onClose: () => void }): JSX.Element {
  const { mef, editable, mutate } = useOtherHazardsPraWorkbook();
  const application = mef.analysisBasis.applications[0];
  const identity = mef.metadata.plantIdentity ?? {
    name: mef.name,
    vendor: "",
    reactorType: "",
    thermalPower: "",
    primaryCoolant: "",
    numberOfModules: 1,
  };
  const operatingStates = mef.analysisBasis.baselinePra?.plantOperatingStateRefs.join("\n") ?? "";
  const materialSources = mef.analysisBasis.baselinePra?.radioactiveMaterialSourceRefs.join("\n") ?? "";
  const [draft, setDraft] = useState<ScopeDraft>(() => ({
    applicationName: application?.name ?? "",
    purpose: application?.purpose ?? "",
    decisionContext: application?.decisionContext ?? "",
    supportedRiskMetrics: application?.supportedRiskMetrics.join("\n") ?? "",
    plantName: identity.name,
    siteName: identity.siteName ?? mef.analysisBasis.siteBasis?.siteName ?? "",
    vendor: identity.vendor,
    reactorType: identity.reactorType,
    thermalPower: identity.thermalPower,
    numberOfModules: identity.numberOfModules ?? 1,
    praScope: mef.praScope,
    capabilityCategory: mef.capabilityCategory ?? "CC-II",
    plantStage: mef.plantStage,
  }));
  function save(): void {
    mutate((current) => {
      const next = structuredClone(current);
      const saved: OtherHazardsPRA["analysisBasis"]["applications"][number] = {
        ...(next.analysisBasis.applications[0] ?? {
          uuid: crypto.randomUUID(),
          code: "O-APP-001",
          name: "",
          description: "",
          basis: "",
          owner: next.owner ?? "Other Hazards PRA Team",
          status: "DRAFT",
          evidenceRefs: [],
          relatedRefs: [],
          assumptionRefs: [],
          implementsSrs: [],
          purpose: "",
          decisionContext: "",
          supportedRiskMetrics: [],
          consumingElementRefs: [],
          configurationBasis: "",
          limitations: [],
        }),
        name: draft.applicationName,
        description: draft.purpose,
        basis: draft.decisionContext,
        purpose: draft.purpose,
        decisionContext: draft.decisionContext,
        supportedRiskMetrics: technicalList(draft.supportedRiskMetrics),
      };
      next.analysisBasis.applications = [saved, ...next.analysisBasis.applications.slice(1)];
      next.metadata.plantIdentity = {
        ...(next.metadata.plantIdentity ?? identity),
        name: draft.plantName,
        siteName: draft.siteName,
        vendor: draft.vendor,
        reactorType: draft.reactorType,
        thermalPower: draft.thermalPower,
        numberOfModules: Math.max(1, Math.round(draft.numberOfModules)),
      };
      next.praScope = draft.praScope;
      next.metadata.scope = draft.praScope;
      next.capabilityCategory = draft.capabilityCategory;
      next.plantStage = draft.plantStage;
      return synchronizeOtherHazardsPraDerivedRegisters(next);
    });
    onClose();
  }
  return (
    <Drawer
      title="PRA analysis and scope"
      subtitle="Record the decision application, reference plant, Other Hazards boundary, baseline scope, and required risk results in one flat editor."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="posnav__btn"
            onClick={onClose}
          >
            Cancel
          </button>
          {editable && (
            <button
              type="button"
              className="posnav__btn posnav__btn--primary"
              onClick={save}
            >
              Save changes
            </button>
          )}
        </>
      }
    >
      <fieldset
        className="sinlineeditor"
        disabled={!editable}
      >
        <div className="sinlineeditor__group">
          <WorkbookSectionHeading
            workbook="O"
            title="PRA application"
            className="sinlineeditor__title"
          />
          <Field label="Intended application">
            <TextInput
              value={draft.applicationName}
              onChange={(value) => setDraft((item) => ({ ...item, applicationName: value }))}
            />
          </Field>
          <Field label="Purpose">
            <TextArea
              rows={3}
              value={draft.purpose}
              onChange={(value) => setDraft((item) => ({ ...item, purpose: value }))}
            />
          </Field>
          <Field label="Decision supported">
            <TextArea
              rows={3}
              value={draft.decisionContext}
              onChange={(value) => setDraft((item) => ({ ...item, decisionContext: value }))}
            />
          </Field>
          <Field label="Risk measures and endpoints">
            <TextArea
              rows={4}
              value={draft.supportedRiskMetrics}
              onChange={(value) => setDraft((item) => ({ ...item, supportedRiskMetrics: value }))}
            />
          </Field>
        </div>
        <div className="sinlineeditor__group">
          <WorkbookSectionHeading
            workbook="O"
            title="Reference plant and site"
            className="sinlineeditor__title"
          />
          <div className="flfieldgrid">
            <Field label="Plant name">
              <TextInput
                value={draft.plantName}
                onChange={(value) => setDraft((item) => ({ ...item, plantName: value }))}
              />
            </Field>
            <Field label="Site">
              <TextInput
                value={draft.siteName}
                onChange={(value) => setDraft((item) => ({ ...item, siteName: value }))}
              />
            </Field>
            <Field label="Vendor or designer">
              <TextInput
                value={draft.vendor}
                onChange={(value) => setDraft((item) => ({ ...item, vendor: value }))}
              />
            </Field>
            <Field label="Reactor type">
              <TextInput
                value={draft.reactorType}
                onChange={(value) => setDraft((item) => ({ ...item, reactorType: value }))}
              />
            </Field>
            <Field label="Thermal power">
              <TextInput
                value={draft.thermalPower}
                onChange={(value) => setDraft((item) => ({ ...item, thermalPower: value }))}
              />
            </Field>
            <Field label="Modules or units">
              <NumberInput
                value={draft.numberOfModules}
                onChange={(value) => setDraft((item) => ({ ...item, numberOfModules: value }))}
              />
            </Field>
          </div>
        </div>
        <div className="sinlineeditor__group">
          <WorkbookSectionHeading
            workbook="O"
            title="Analysis boundary"
            className="sinlineeditor__title"
          />
          <Field label="PRA scope">
            <TextArea
              rows={5}
              value={draft.praScope}
              onChange={(value) => setDraft((item) => ({ ...item, praScope: value }))}
            />
          </Field>
          <div className="flfieldgrid">
            <Field label="Capability category">
              <SelectInput
                value={draft.capabilityCategory}
                options={[
                  { value: "CC-I", label: "CC-I" },
                  { value: "CC-II", label: "CC-II" },
                ]}
                onChange={(value) =>
                  setDraft((item) => ({
                    ...item,
                    capabilityCategory: value as ScopeDraft["capabilityCategory"],
                  }))
                }
              />
            </Field>
            <Field label="Plant stage">
              <SelectInput
                value={draft.plantStage}
                options={[
                  { value: "PRE_OPERATIONAL", label: "Pre-operational" },
                  { value: "OPERATIONAL", label: "Operational" },
                ]}
                onChange={(value) =>
                  setDraft((item) => ({ ...item, plantStage: value as ScopeDraft["plantStage"] }))
                }
              />
            </Field>
          </div>
        </div>
        <div className="sinlineeditor__group">
          <WorkbookSectionHeading
            workbook="O"
            title="Imported baseline scope"
            className="sinlineeditor__title"
          />
          <Field label="Operating states">
            <TextArea
              rows={4}
              value={operatingStates}
              disabled
              onChange={() => undefined}
            />
          </Field>
          <Field label="Radioactive-material sources">
            <TextArea
              rows={4}
              value={materialSources}
              disabled
              onChange={() => undefined}
            />
          </Field>
        </div>
      </fieldset>
    </Drawer>
  );
}

const INTERFACE_PRIMARY_COLUMNS: Record<
  OtherHazardsPRA["analysisBasis"]["interfaces"][number]["payloadType"],
  string
> = {
  HAZARD_SCREENING_RESULT: "Retained hazard",
  OPERATING_STATE: "Operating state",
  INITIATING_EVENT: "Initiating-event group",
  EVENT_SEQUENCE: "Event-sequence family",
  SUCCESS_CRITERION: "Success criterion",
  SYSTEM_MODEL: "System model",
  HUMAN_FAILURE_EVENT: "Human failure event",
  DATA_PARAMETER: "Data parameter",
  HAZARD_CURVE: "Hazard curve",
  FRAGILITY: "Fragility",
  OTHER_HAZARDS_SSC_LIST: "Other Hazards SSC-list item",
  SECONDARY_HAZARD: "Secondary-hazard scenario",
  SEQUENCE_FAMILY_RESULT: "Sequence-family result",
  PLANT_DAMAGE_STATE: "Plant-damage state",
  RELEASE_CATEGORY: "Release category",
  RISK_CONTRIBUTOR: "Risk contributor",
  CONFIGURATION_BASELINE: "Configuration baseline",
};

function lowerInitial(value: string): string {
  return value.length === 0 ? value : `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function Interfaces(): JSX.Element {
  const { mef } = useOtherHazardsPraWorkbook();
  const [selected, setSelected] = useState<number | null>(null);
  const current = selected === null ? undefined : mef.analysisBasis.interfaces[selected];
  return (
    <Section
      title="Interfaces"
      description="Shows the controlled inputs received from other PRA technical elements and the Other Hazards results supplied to downstream technical elements."
    >
      <div className="poshandoff__grid">
        {mef.analysisBasis.interfaces.map((item, index) => (
          <button
            key={item.uuid}
            type="button"
            className={`poshandoff__tile${selected === index ? " poshandoff__tile--active" : ""}`}
            onClick={() => setSelected(selected === index ? null : index)}
          >
            <span className="poshandoff__tile-code">{item.technicalElementCode}</span>
            <span className="poshandoff__tile-name">{item.technicalElementName}</span>
            <span className="poshandoff__tile-role">
              {item.direction === "OUTPUT" ? "Consumes" : "Provides"} · {item.role}
            </span>
          </button>
        ))}
      </div>
      {mef.analysisBasis.interfaces.length === 0 && (
        <div className="flempty">
          <strong>No technical-element interfaces recorded</strong>
          <p>
            Add controlled inputs from HSA, POS, IE, ES, SC, SY, HR, DA, Fire, Flood, Seismic, High Winds, and
            External Flood, plus outputs to quantification, Level 2, risk integration, and configuration
            control.
          </p>
        </div>
      )}
      {current !== undefined && selected !== null && (
        <div className="sinterface__details">
          <WorkbookCueLabel
            workbook="O"
            title={
              current.direction === "INPUT" ?
                `Other Hazards PRA receives ${lowerInitial(current.role)} from ${current.technicalElementName}`
              : `${current.technicalElementName} receives ${lowerInitial(current.role)} from Other Hazards PRA`
            }
            cueKey="Interface transfer records"
            className="sinterface__flow-title"
          />
          <div className="sinterface__table-wrap">
            <table className="postable postable--mid">
              <thead>
                <tr>
                  <th>{INTERFACE_PRIMARY_COLUMNS[current.payloadType]}</th>
                  {current.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {current.transferItems.length === 0 ?
                  <tr>
                    <td colSpan={current.columns.length + 1}>
                      No controlled transfer records are available.
                    </td>
                  </tr>
                : current.transferItems.map((item) => (
                    <tr key={item.uuid}>
                      <td>
                        <div className="postable__name">
                          {item.recordRef} · {item.name}
                        </div>
                      </td>
                      {current.columns.map((column, columnIndex) => (
                        <td key={`${item.uuid}-${column}`}>{item.values[columnIndex] ?? "—"}</td>
                      ))}
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Section>
  );
}

function AnalysisBasis(): JSX.Element {
  const { mef, editable } = useOtherHazardsPraWorkbook();
  const [target, setTarget] = useState<EditorTarget | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const site = mef.analysisBasis.siteBasis;
  const baseline = mef.analysisBasis.baselinePra;
  const scopeSection = section(
    "Analysis scope records",
    "Define retained hazard groups, plant locations, operating states, units, material sources, risk metrics, and intended capability category.",
    ["analysisBasis", "scopeRecords"],
    "scope record",
    [
      { label: "Hazards", key: "hazardGroupRefs" },
      { label: "Locations", key: "includedPlantLocations" },
      { label: "Operating states", key: "includedOperatingStateRefs" },
      { label: "Risk metrics", key: "riskMetrics" },
    ],
  );
  const applicationSection = section(
    "PRA applications",
    "Record each decision application, supported risk metrics, consuming technical elements, configuration basis, and limitations.",
    ["analysisBasis", "applications"],
    "application",
    [
      { label: "Purpose", key: "purpose" },
      { label: "Decision", key: "decisionContext" },
      { label: "Metrics", key: "supportedRiskMetrics" },
      { label: "Consumers", key: "consumingElementRefs" },
    ],
  );
  return (
    <div className="flstep">
      <Section
        title="PRA analysis and scope"
        description="Defines the intended application, plant stage, capability category, overall analysis boundary, and reference plant used by every later Other Hazards step."
        actions={
          editable ?
            <EditButton
              label="Edit analysis scope"
              onClick={() => setScopeOpen(true)}
            />
          : undefined
        }
      >
        <div className="sanalysisbasis">
          <AnalysisRow
            label="Intended application"
            value={mef.analysisBasis.applications[0]?.name}
          />
          <AnalysisRow
            label="Purpose"
            value={mef.analysisBasis.applications[0]?.purpose}
          />
          <AnalysisRow
            label="Decision supported"
            value={mef.analysisBasis.applications[0]?.decisionContext}
          />
          <AnalysisRow
            label="PRA scope"
            value={mef.praScope}
          />
          <AnalysisRow
            label="Capability category"
            value={mef.capabilityCategory}
          />
          <AnalysisRow
            label="Plant stage"
            value={mef.plantStage}
          />
          <AnalysisRow
            label="Reference plant and site"
            value={[mef.metadata.plantIdentity?.name, mef.metadata.plantIdentity?.siteName].filter(Boolean)}
          />
          <AnalysisRow
            label="Operating states"
            value={baseline?.plantOperatingStateRefs}
          />
          <AnalysisRow
            label="Radioactive-material sources"
            value={baseline?.radioactiveMaterialSourceRefs}
          />
          <AnalysisRow
            label="Risk measures and endpoints"
            value={mef.analysisBasis.applications[0]?.supportedRiskMetrics}
          />
        </div>
      </Section>
      <Section
        title="Site basis"
        description="Defines the specific or bounding site, coordinates, regional setting, terrain, nearby facilities and transport, licensee-controlled area, units, material sources, operating states, and data cutoff."
        actions={
          editable ?
            <EditButton
              label="Edit site basis"
              onClick={() =>
                setTarget({
                  title: "Other Hazards site basis",
                  subtitle:
                    "Define the reference site and every plant, geographic, and environmental attribute used by the analysis.",
                  focus: ["analysisBasis", "siteBasis"],
                })
              }
            />
          : undefined
        }
      >
        <div className="sanalysisbasis">
          <AnalysisRow
            label="Site"
            value={site?.siteName}
          />
          <AnalysisRow
            label="Basis type"
            value={site?.siteBasisType}
          />
          <AnalysisRow
            label="Selection status"
            value={site?.siteSelectionStatus}
          />
          <AnalysisRow
            label="Location"
            value={
              site === undefined ? "" : (
                [site.latitudeDegrees, site.longitudeDegrees].filter((item) => item !== undefined).join(", ")
              )
            }
          />
          <AnalysisRow
            label="Regional setting"
            value={site?.regionalSettingDescription}
          />
          <AnalysisRow
            label="Nearby facilities and transport"
            value={site?.nearbyFacilityAndTransportDescription}
          />
          <AnalysisRow
            label="Operating states"
            value={site?.plantOperatingStateRefs}
          />
        </div>
      </Section>
      <RecordSectionView
        section={scopeSection}
        setTarget={setTarget}
      />
      <Section
        title="Baseline PRA"
        description="Freezes the internal-events model boundary and records which POS, IE, ES, SC, SY, DA, HR, Level 2, and Risk Integration records are reused, modified, new, or not applicable."
        actions={
          editable ?
            <EditButton
              label="Edit baseline PRA"
              onClick={() =>
                setTarget({
                  title: "Baseline PRA definition",
                  subtitle:
                    "Control the model freeze and external technical records used to build the Other Hazards PRA.",
                  focus: ["analysisBasis", "baselinePra"],
                })
              }
            />
          : undefined
        }
      >
        <div className="sanalysisbasis">
          <AnalysisRow
            label="Model"
            value={baseline?.modelName}
          />
          <AnalysisRow
            label="Reference"
            value={baseline?.modelReference}
          />
          <AnalysisRow
            label="Revision"
            value={baseline?.revision}
          />
          <AnalysisRow
            label="Freeze date"
            value={baseline?.freezeDate}
          />
          <AnalysisRow
            label="Freeze status"
            value={baseline?.freezeStatus}
          />
          <AnalysisRow
            label="Record treatments"
            value={baseline?.recordTreatments.length}
          />
          <AnalysisRow
            label="Unresolved interfaces"
            value={baseline?.unresolvedInterfaces}
          />
        </div>
      </Section>
      <RecordSectionView
        section={applicationSection}
        setTarget={setTarget}
      />
      <Interfaces />
      {scopeOpen && <AnalysisScopeEditor onClose={() => setScopeOpen(false)} />}
      <Editor
        target={target}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}

function StoppingCriteria({ setTarget }: { setTarget: (target: EditorTarget) => void }): JSX.Element {
  const { mef, editable } = useOtherHazardsPraWorkbook();
  const criteria = mef.riskInterpretation.stoppingCriteria;
  return (
    <Section
      title="Refinement stopping criteria"
      description="Defines the quantitative stability checks that must be satisfied before the Other Hazards model can be accepted as stable."
      actions={
        editable ?
          <EditButton
            label="Edit criteria"
            onClick={() =>
              setTarget({
                title: "Refinement stopping criteria",
                subtitle:
                  "Set the aggregate, sequence-family, contributor-rank, and stable-iteration thresholds used to stop model refinement.",
                focus: ["riskInterpretation", "stoppingCriteria"],
                visibleRootFields: [
                  "maximumAggregateFrequencyChange",
                  "maximumFamilyFrequencyChange",
                  "maximumContributorRankShift",
                  "requiredStableIterations",
                  "requireNoNewRiskSignificantContributors",
                  "basis",
                ],
              })
            }
          />
        : undefined
      }
    >
      <div className="sinterface__table-wrap">
        <table
          className="postable postable--mid otherhazards-criteria-table"
          aria-label="Refinement stopping criteria"
        >
          <thead>
            <tr>
              <th>Aggregate change</th>
              <th>Family change</th>
              <th>Contributor rank shift</th>
              <th>Stable runs</th>
              <th>New contributors</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>≤ {(criteria.maximumAggregateFrequencyChange * 100).toFixed(1)}%</td>
              <td>≤ {(criteria.maximumFamilyFrequencyChange * 100).toFixed(1)}%</td>
              <td>≤ {criteria.maximumContributorRankShift} position</td>
              <td>{criteria.requiredStableIterations} consecutive</td>
              <td>
                {criteria.requireNoNewRiskSignificantContributors ? "None allowed" : "Allowed with review"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function TechnicalStep({ stepId }: { stepId: string }): JSX.Element {
  const [target, setTarget] = useState<EditorTarget | null>(null);
  const config = STEP_CONFIG[stepId];
  if (config === undefined)
    return (
      <div className="flempty">
        <strong>Step configuration unavailable</strong>
      </div>
    );
  const recordSections =
    config.root === undefined ? config.sections : [...config.sections, ...common(config.root)];
  return (
    <div className="flstep">
      {recordSections.map((item) => (
        <RecordSectionView
          key={`${item.path.join(".")}-${item.title}`}
          section={item}
          setTarget={setTarget}
        />
      ))}
      {stepId === "risk-integration" && <StoppingCriteria setTarget={setTarget} />}
      <Editor
        target={target}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}

export function OtherHazardsPraStepScreen({ stepId }: { stepId: string }): JSX.Element {
  if (stepId === "analysis-basis") return <AnalysisBasis />;
  return <TechnicalStep stepId={stepId} />;
}
