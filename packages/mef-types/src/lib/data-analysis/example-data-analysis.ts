import { DistributionType } from "./data-analysis";
export const EDGUncertaintyExample = {
  correlations: [
    {
      correlationFactor: 0.8,
      correlationType: "common_cause",
      description: "Common cause failure correlation between EDG A and B",
      parameterId: "DA-EDG-B-FR",
    },
  ],
  distribution: "lognormal",
  model_uncertainty_sources: ["Limited operational data", "Environmental factors not fully characterized"],
  parameters: {
    errorFactor: 3,
    mean: 1.2e-3,
  },
  riskImplications: {
    affectedMetrics: ["CDF", "LERF"],
    propagationNotes: "Major impact on SBO sequences",
    significanceLevel: "high",
  },
} as const;
export const EDGFailureRateExample = {
  uuid: "a1b2c3d4-e89b-12d3-a456-567890abcdef",
  name: "Emergency Diesel Generator Failure Rate",
  description: "Failure rate analysis for EDG-A during power operation",
  parameterType: "FREQUENCY",
  value: 1.2e-5,
  basicEventId: "BE-EDG-FS-001",
  systemComponentId: "SYS-EDG-A",
  failure_mode: {
    type: "FAILURE_TO_START",
    description: "Failure to start on demand signal",
  },
  probability_model: DistributionType.LOGNORMAL,
  uncertainty: {
    distribution: DistributionType.LOGNORMAL,
    parameters: {
      median: 1.2e-5,
      errorFactor: 3.0,
    },
  },
} as const;
export const EDGReliabilityAnalysisExample = {
  uuid: "123e4567-e89b-12d3-a456-426614174000",
  name: "Emergency Diesel Generator Reliability Analysis",
  type: "data-analysis",
  version: "1.0.0",
  status: "APPROVED",
  description: "Comprehensive data analysis for EDG reliability parameters",
  data_parameters: [EDGFailureRateExample],
  additionalMetadata: {
    limitations: ["Analysis limited to failure-to-start mode", "Common cause failures analyzed separately"],
  },
} as const;
export const EBRII_PumpDocumentationExample = {
  processDocumentation: {
    uuid: "dd72a844-ff75-4517-86a4-5e4bfc7c0384",
    name: "EBR-II Primary Sodium Pump Data Analysis Documentation",
    systemComponentBoundaries: [
      {
        systemId: "SYS-EBRII-PCS-001",
        componentId: "COMP-EBRII-PSP-001",
        boundaryDescription: "EBR-II primary sodium pump including motor, pump, shaft, bearings, and seals",
        boundaries: [
          "Electromagnetic pump assembly",
          "Control circuitry",
          "Power supply components",
          "Primary flow path components",
        ],
        references: ["EBR-II System Design Description SDD-PCS-001", "EBR-II Primary Pump Drawing E-12345-001"],
      },
    ],
    basicEventProbabilityModels: [
      {
        basicEventId: "BE-EBRII-PSP-FR-001",
        model: "LOGNORMAL",
        justification:
          "Lognormal distribution selected based on industry standard practices for continuous operation components with multiplicative failure mechanisms",
      },
      {
        basicEventId: "BE-EBRII-PSP-FS-001",
        model: "BETA",
        justification:
          "Beta distribution selected for demand-based failure mode to properly model uncertainty with limited data",
      },
    ],
    genericParameterSources: [
      {
        parameterId: "PARAM-EBRII-PSP-FR-001",
        source:
          "NUREG/CR-6928, Industry-Average Performance for Components and Initiating Events at U.S. Commercial Nuclear Power Plants",
        reference: "Section 5.4, with adjustments for liquid metal reactor applications",
      },
      {
        parameterId: "PARAM-EBRII-PSP-FS-001",
        source: "Liquid Metal Fast Breeder Reactor Reliability Database (LMFR-RDB)",
        reference: "LMFR-RDB-2023, Section 4.2.1",
      },
    ],
    plantSpecificDataSources: [
      {
        parameterId: "PARAM-EBRII-PSP-FR-001",
        source: "EBR-II Operational Records 1964-1994",
        operatingState: "POS-FULL-POWER-100",
        timePeriod: "1980-1994",
      },
    ],
    dataCollectionPeriods: [
      {
        parameterId: "PARAM-EBRII-PSP-FR-001",
        startDate: "1980-01-01",
        endDate: "1994-12-31",
        censoringJustification: "Pre-1980 data excluded due to major design modifications to pump control systems",
      },
    ],
    dataExclusionJustifications: [
      {
        parameterId: "PARAM-EBRII-PSP-FR-001",
        excludedData: "Three failure events during special testing operations in 1983",
        justification:
          "Events occurred during non-standard operating conditions not representative of normal operation",
      },
    ],
    ccfProbabilityBasis: [
      {
        ccfParameterId: "PARAM-EBRII-PSP-CCF-001",
        estimationMethod: "Alpha Factor Model with specialized adjustment for liquid metal environment",
        mappingJustification:
          "Alpha factors derived from light water reactor experience adjusted for liquid metal environment based on expert judgment",
      },
    ],
    bayesianPriorRationales: [
      {
        parameterId: "PARAM-EBRII-PSP-FR-001",
        priorDistribution: "Lognormal(μ=-11.51, σ=1.5)",
        rationale:
          "Prior based on generic liquid metal pump failure rates with wide uncertainty to accommodate limited industry experience",
      },
    ],
    parameterEstimates: [
      {
        parameterId: "PARAM-EBRII-PSP-FR-001",
        estimate: 1.2e-5,
        uncertaintyCharacterization:
          "Lognormal distribution with 5th percentile 2.5e-6, 95th percentile 5.8e-5, error factor 4.8",
      },
      {
        parameterId: "PARAM-EBRII-PSP-FS-001",
        estimate: 3.4e-3,
        uncertaintyCharacterization:
          "Beta distribution with α=2.5, β=732, 5th percentile 6.7e-4, 95th percentile 8.2e-3",
      },
    ],
    operatingStateDataJustifications: [
      {
        parameterId: "PARAM-EBRII-PSP-FR-001",
        operatingState: "POS-FULL-POWER-100",
        justification:
          "Full power operation provides most representative conditions for primary pump failure rates as pumps operate at design flow rates and temperatures",
      },
    ],
    genericParameterRationales: [
      {
        parameterId: "PARAM-EBRII-PSP-FS-001",
        operatingStates: ["POS-STARTUP-200", "POS-SHUTDOWN-300"],
        rationale:
          "Generic parameters used for startup and shutdown states due to insufficient plant-specific data for these infrequent operating states",
      },
    ],
    componentGroupingDocumentation: [
      {
        groupId: "GROUP-EBRII-PUMPS-001",
        groupingCriteria:
          "Primary sodium pumps grouped based on similar design, operational characteristics, and environment",
        outlierIdentificationMethodology:
          "Statistical hypothesis testing comparing failure rates across similar components with 95% confidence threshold",
        outlierExclusionJustifications: [
          {
            componentId: "COMP-EBRII-PSP-003",
            exclusionReason: "Significant design differences and operating conditions",
            detailedJustification:
              "Secondary loop pump operates at lower temperature and has different seal design, resulting in significantly different failure characteristics",
            alternativeTreatment: "Analyzed as separate component with its own failure parameters",
          },
        ],
        supportingAnalyses: ["EBR-II Pump Similarity Analysis Report PSAR-2022-001"],
      },
    ],
  },
  modelUncertainty: {
    uuid: "e87b2c3d-1234-5678-90ab-cdef01234567",
    name: "EBR-II Primary Sodium Pump Model Uncertainty Documentation",
    uncertaintySources: [
      {
        source: "Operating environment differences between EBR-II and modern liquid metal reactors",
        impact:
          "Introduces uncertainty in applicability of parameter estimates to current sodium-cooled fast reactor designs",
        applicableParameters: ["PARAM-EBRII-PSP-FR-001", "PARAM-EBRII-PSP-FS-001"],
      },
      {
        source: "Limited operational history of sodium pumps in commercial power applications",
        impact: "Increases uncertainty in generic data applicability and requires greater reliance on expert judgment",
        applicableParameters: ["PARAM-EBRII-PSP-FR-001", "PARAM-EBRII-PSP-FS-001", "PARAM-EBRII-PSP-CCF-001"],
      },
    ],
    relatedAssumptions: [
      {
        assumption: "EBR-II primary pump reliability characteristics are representative of modern sodium pump designs",
        basis:
          "Design principles for electromagnetic sodium pumps have not fundamentally changed, though materials and manufacturing have improved",
        applicableParameters: ["PARAM-EBRII-PSP-FR-001"],
      },
      {
        assumption:
          "Common cause failure mechanisms for sodium pumps are similar to those of light water reactor pumps",
        basis:
          "While fluid properties differ, fundamental CCF mechanisms like design errors, manufacturing defects, and maintenance errors remain similar",
        applicableParameters: ["PARAM-EBRII-PSP-CCF-001"],
      },
    ],
    reasonableAlternatives: [
      {
        alternative: "Use of Exponential distribution instead of Lognormal for failure rate modeling",
        reasonNotSelected:
          "Lognormal better characterizes the uncertainty in the estimated parameters given the limited data",
        applicableParameters: ["PARAM-EBRII-PSP-FR-001"],
      },
      {
        alternative: "Separate parameter estimates for different operational phases",
        reasonNotSelected: "Insufficient data to support statistically significant separate estimates",
        applicableParameters: ["PARAM-EBRII-PSP-FR-001"],
      },
    ],
    requirementReference: "DA-E2",
  },
  preOperationalAssumptions: {
    uuid: "f9876543-21ab-cdef-4321-fedcba098765",
    name: "EBR-II Primary Sodium Pump Pre-Operational Assumptions",
    assumptions: [
      {
        assumptionId: "ASSUME-EBRII-PSP-001",
        description: "Modern electromagnetic pump designs will have equal or better reliability than EBR-II pumps",
        basis: "Advancements in materials, manufacturing, and control systems are expected to improve reliability",
        impact: "May overestimate failure rates if modern designs prove more reliable",
        status: "OPEN",
        limitations: [
          "May not account for new failure modes introduced by design innovations",
          "Limited operational experience with newer pump designs",
        ],
      },
      {
        assumptionId: "ASSUME-EBRII-PSP-002",
        description: "Maintenance practices for modern sodium pumps will be at least as effective as those for EBR-II",
        basis: "Modern maintenance technologies and practices have generally improved over time",
        impact: "May underestimate maintenance-related failures if modern practices prove less effective",
        status: "IN_PROGRESS",
        limitations: [
          "Loss of institutional knowledge about sodium pump maintenance",
          "Reduced availability of specialized maintenance personnel",
        ],
      },
    ],
    supportingDocumentationReferences: [
      "EBR-II Operational History Report OHR-1994-001",
      "Modern Sodium Pump Design Comparison Study MSPD-2023-001",
    ],
    validationPhase: "Early operational testing",
    relatedRequirement: "DA-A6",
    relatedNote: "DA-N-5",
  },
} as const;
export const EBRII_PumpOperationalDataExample = {
  id: "ODP-EBRII-PCS-001",
  name: "EBR-II Primary Sodium Pump Operational Data Registry",
  dataPoints: [
    {
      id: "EBRII-PSP-EVENT-001",
      componentReference: "COMP-EBRII-PSP-001",
      componentTypeReference: "TYPE-SODIUM-PUMP",
      timestamp: "1984-03-15T08:42:00Z",
      eventType: "failure",
      operatingHours: 12458.5,
      operatingCycles: 56,
      failureModeReference: "FM-PUMP-BEARINGS",
      description: "Primary pump bearing degradation detected during routine vibration monitoring",
      measurements: {
        vibration: 12.5,
        temperature: 427.8,
      },
    },
    {
      id: "EBRII-PSP-EVENT-002",
      componentReference: "COMP-EBRII-PSP-001",
      componentTypeReference: "TYPE-SODIUM-PUMP",
      timestamp: "1987-11-20T14:18:00Z",
      eventType: "failure",
      operatingHours: 28741.2,
      operatingCycles: 124,
      failureModeReference: "FM-PUMP-CONTROL",
      description: "Flow control system failure resulting in pump shutdown",
      measurements: {
        current: 96.2,
        flow: 75.3,
      },
    },
    {
      id: "EBRII-PSP-EVENT-003",
      componentReference: "COMP-EBRII-PSP-001",
      componentTypeReference: "TYPE-SODIUM-PUMP",
      timestamp: "1986-05-10T09:30:00Z",
      eventType: "inspection",
      operatingHours: 22561.7,
      operatingCycles: 97,
      description: "Routine inspection during plant outage, no abnormalities detected",
      measurements: {
        vibration: 4.2,
        temperature: 25.0,
      },
    },
    {
      id: "EBRII-PSP-EVENT-004",
      componentReference: "COMP-EBRII-PSP-001",
      componentTypeReference: "TYPE-SODIUM-PUMP",
      timestamp: "1985-09-05T10:15:00Z",
      eventType: "maintenance",
      operatingHours: 18752.3,
      operatingCycles: 82,
      description: "Preventive maintenance on pump control circuits",
      measurements: {
        downtime: 12.5,
      },
    },
  ],
  dataByComponentType: {
    "TYPE-SODIUM-PUMP": ["EBRII-PSP-EVENT-001", "EBRII-PSP-EVENT-002", "EBRII-PSP-EVENT-003", "EBRII-PSP-EVENT-004"],
  },
  dataByFailureMode: {
    "FM-PUMP-BEARINGS": ["EBRII-PSP-EVENT-001"],
    "FM-PUMP-CONTROL": ["EBRII-PSP-EVENT-002"],
  },
} as const;
export const EBRII_PumpFailureEstimationExample = {
  failureModeReference: "FM-PUMP-BEARINGS",
  componentTypeReference: "TYPE-SODIUM-PUMP",
  estimatedDistribution: DistributionType.LOGNORMAL,
  parameters: {
    mean: 1.2e-5,
    errorFactor: 4.8,
  },
  confidenceIntervals: {
    lower: { mean: 2.5e-6 },
    upper: { mean: 5.8e-5 },
  },
  sampleSize: 5,
  goodnessOfFit: {
    method: "Anderson-Darling",
    value: 0.89,
  },
} as const;
export const EBRII_PumpParameterExample = {
  uuid: "b2c3d4e5-f678-42a1-b345-67890abcdef1",
  name: "EBR-II Primary Sodium Pump Failure Rate",
  description: "Failure rate for EBR-II primary sodium pump during normal operation",
  parameterType: "FREQUENCY",
  value: 1.2e-5,
  basicEventId: "BE-EBRII-PSP-FR-001",
  systemDefinitionId: "SYS-EBRII-PCS-001",
  componentBoundaries: {
    systemId: "SYS-EBRII-PCS-001",
    componentId: "COMP-EBRII-PSP-001",
    description: "EBR-II primary sodium pump boundary including pump, motor, and control systems",
    boundaries: ["Primary flow path", "Electromagnetic systems", "Control systems"],
    includedParts: [
      "Electromagnetic pump assembly",
      "Pump motor",
      "Pump control circuits",
      "Flow sensors",
      "Temperature sensors",
    ],
    excludedParts: ["Sodium piping beyond pump flanges", "External power supply", "Plant control system interfaces"],
  },
  failureMode: {
    uuid: "c3d4e5f6-7890-123a-b456-78901abcdef2",
    name: "Pump Bearing Failure",
    category: "Mechanical",
    mechanismOfFailure: "Wear and degradation of pump bearings due to thermal cycling and normal operation",
    detectability: "Medium",
  },
  successCriteria: "SC-EBRII-FLOW-001",
  plant_operating_state: "POS-FULL-POWER-100",
  probability_model: DistributionType.LOGNORMAL,
  uncertainty: {
    distribution: DistributionType.LOGNORMAL,
    parameters: {
      mean: 1.2e-5,
      errorFactor: 4.8,
    },
    model_uncertainty_sources: [
      "Limited operational experience with sodium pumps",
      "Extrapolation from historical data to modern designs",
    ],
    riskImplications: {
      affectedMetrics: ["CDF", "Release Frequency"],
      significanceLevel: "medium",
      propagationNotes: "Impacts sequences involving loss of primary cooling",
    },
  },
  data_sources: [
    {
      source: "EBR-II Operational Records 1964-1994",
      context: "Plant specific",
      sourceType: "PLANT_SPECIFIC",
      timePeriod: {
        startDate: "1980-01-01",
        endDate: "1994-12-31",
      },
      applicabilityAssessment: "Direct applicability to similar sodium pump designs",
    },
    {
      source: "Liquid Metal Fast Breeder Reactor Reliability Database",
      context: "Industry standard",
      sourceType: "GENERIC_INDUSTRY",
      documentationReferences: ["LMFR-RDB-2023"],
    },
  ],
  assumptions: [
    {
      uuid: "d4e5f6a7-b890-1234-c567-8901abcdef2",
      description: "Modern electromagnetic pump designs will have equal or better reliability than EBR-II pumps",
      basis: "Advancements in materials, manufacturing, and control systems",
      type: "TECHNICAL",
      context: "Design",
      impactedParameters: ["PARAM-EBRII-PSP-FR-001", "PARAM-EBRII-PSP-FS-001"],
    },
  ],
  logicModelInfo: {
    modelType: "Fault Tree",
    basicEventBoundary: "Component failure within defined boundary",
    evaluationModel: "SAPHIRE",
  },
} as const;
export const examples = {
  EDGReliabilityAnalysisExample,
  EDGFailureRateExample,
  EDGUncertaintyExample,
  EBRII_PumpDocumentationExample,
  EBRII_PumpOperationalDataExample,
  EBRII_PumpFailureEstimationExample,
  EBRII_PumpParameterExample,
} as const;
