/**
 * @packageDocumentation
 * @module event_sequence_quantification
 * @category Examples
 */

import { 
  EventSequenceQuantification,
  TruncationMethod,
  QuantificationApproach,
  CircularLogicResolutionMethod,
  BarrierStatus
} from './event-sequence-quantification';
import { DistributionType } from '../data-analysis/data-analysis';
import { TechnicalElementTypes } from '../technical-element';
import { DependencyType } from '../event-sequence-analysis/event-sequence-analysis';

/**
 * Example of a complete Event Sequence Quantification analysis
 * 
 * This example demonstrates how to structure a complete event sequence quantification
 * with all required properties according to latest non LWR standards.
 * 
 * @dependency_management
 * This example follows the module's dependency management approach:
 * 1. Uses string references and IDs for most cross-module references
 * 2. Only imports BarrierStatus from event-sequence-quantification (which re-exports it from plant-operating-states-analysis)
 * 3. Demonstrates loose coupling through well-defined interfaces
 * 
 * @example
 * ```typescript
 * // Import the example
 * import { EventSequenceQuantificationExample } from 'event_sequence_quantification';
 * 
 * // Use the example
 * const myAnalysis = { ...EventSequenceQuantificationExample };
 * ```
 * @const
 * @group Examples
 */
export const EventSequenceQuantificationExample = {
  "technical-element-type": TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION,
  "technical-element-code": "ESQ",
  metadata: {
    version: "1.0",
    analysisDate: "2024-07-26",
    analyst: "Jane Doe",
    reviewer: "John Smith",
    approvalStatus: "Approved",
    scope: ["Internal Events"],
    limitations: ["Conservative assumptions used for some parameters"],
    assumptions: [{ description: "No external events considered in this quantification." }]
  },
  eventSequenceFamilies: {
    "ESF-LOCA-SMALL": {
      uuid: "f8c7e536-9c2a-4d8b-b5d3-8a45fb4763e1",
      name: "Small LOCA Event Sequence Family",
      familyId: "ESF-LOCA-SMALL",
      description: "Event sequences initiated by small loss of coolant accidents",
      memberSequenceIds: ["ES-SLOCA-001", "ES-SLOCA-002", "ES-SLOCA-003"],
      representativeSequenceId: "ES-SLOCA-001",
      representativeInitiatingEventId: "IE-SLOCA",
      groupingCriteria: "Similar initiating event and mitigating system requirements",
      dependenciesConsideredInGrouping: true
    },
    "ESF-LOOP": {
      uuid: "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890",
      name: "Loss of Offsite Power Event Sequence Family",
      familyId: "ESF-LOOP",
      description: "Event sequences initiated by loss of offsite power",
      memberSequenceIds: ["ES-LOOP-001", "ES-LOOP-002"],
      representativeSequenceId: "ES-LOOP-001",
      representativeInitiatingEventId: "IE-LOOP",
      groupingCriteria: "Similar plant response and power recovery options"
    }
  },
  quantificationResults: {
    "ESF-LOCA-SMALL": {
      sequenceId: "ESF-LOCA-SMALL",
      sequenceType: "FAMILY",
      meanFrequency: { value: 2.3e-6, unit: "per-year" },
      uncertaintyDistribution: {
        type: DistributionType.LOGNORMAL,
        parameters: { median: 1.8e-6, errorFactor: 3.0 }
      },
      confidenceIntervals: {
        percentile05: 4.0e-7,
        percentile50: 1.8e-6,
        percentile95: 7.2e-6
      },
      significantUncertaintySources: ["Human Error Probabilities", "Component Failure Rates"],
      sensitivityResults: [{
        parameter: "Operator Recovery Action Time",
        range: [15, 45],
        frequencyEffect: [3.5e-6, 1.2e-6]
      }]
    },
    "ES-SLOCA-001": {
      sequenceId: "ES-SLOCA-001",
      sequenceType: "INDIVIDUAL",
      meanFrequency: { value: 1.5e-6, unit: "per-year" },
      uncertaintyDistribution: {
        type: DistributionType.LOGNORMAL,
        parameters: { median: 1.2e-6, errorFactor: 2.8 }
      }
    }
  },
  quantificationMethods: {
    approach: QuantificationApproach.FAULT_TREE_LINKING,
    computerCodes: [
      { name: "RISKMAN", version: "3.2", validationReference: "VALID-RISKMAN-3.2-001" },
      { name: "CAFTA", version: "6.0", validationReference: "VALID-CAFTA-6.0-001" }
    ],
    truncation: {
      truncationMethod: TruncationMethod.ABSOLUTE_FREQUENCY,
      finalTruncationValue: 1.0e-12,
      truncationProgression: [1.0e-8, 1.0e-9, 1.0e-10, 1.0e-11, 1.0e-12],
      frequencyAtTruncation: {
        1.0e-8: 2.1e-6,
        1.0e-9: 2.25e-6,
        1.0e-10: 2.28e-6,
        1.0e-11: 2.29e-6,
        1.0e-12: 2.3e-6
      },
      percentageChangeAtTruncation: {
        1.0e-9: 7.1,
        1.0e-10: 1.3,
        1.0e-11: 0.4,
        1.0e-12: 0.1
      },
      basisForSelection: "Less than 1% change in total frequency",
      convergenceDemonstration: "Frequency stabilized with less than 0.5% change for the final two truncation values"
    },
    recoveryActionHandling: "Explicit modeling in event trees with dependencies",
    postInitiatorHFEHandling: "Modeled using HRA calculator with dependency factors"
  },
  modelIntegration: {
    integrationMethod: "Linked Event Trees with Fault Trees",
    softwareTools: ["RISKMAN", "CAFTA", "HRA Calculator"],
    integrationSteps: [
      "Link initiating events to event trees",
      "Map system failures to fault trees",
      "Integrate human failure events with dependency factors",
      "Incorporate recovery actions",
      "Resolve circular logic"
    ],
    integrationVerification: "Verified through manual checks of selected sequences and automated software verification",
    integrationIssues: [
      {
        description: "Interface issue between event tree and fault tree software",
        resolution: "Custom interface script developed and validated"
      }
    ]
  },
  dependencyTreatment: {
    dependenciesByType: {
      [DependencyType.FUNCTIONAL]: {
        treatmentDescription: "Modeled through explicit system fault tree linking",
        modelingMethod: "Shared basic events and logical connections",
        examples: ["Support system X failure impacts frontline systems Y and Z"]
      },
      [DependencyType.PHYSICAL]: {
        treatmentDescription: "Spatial dependencies addressed through common cause failure groups",
        modelingMethod: "CCF parameters based on spatial analysis",
        examples: ["Fire in room A affects multiple components"]
      },
      [DependencyType.HUMAN]: {
        treatmentDescription: "Dependencies between actions modeled using HRA dependency factors",
        modelingMethod: "THERP methodology with dependency adjustment",
        examples: ["Dependency between diagnosis actions in procedure X"]
      },
      [DependencyType.OPERATIONAL]: {
        treatmentDescription: "Operational dependencies modeled explicitly",
        modelingMethod: "Procedural dependencies in event trees",
        examples: ["Operator actions based on plant state"]
      },
      [DependencyType.PHENOMENOLOGICAL]: {
        treatmentDescription: "Phenomenological dependencies modeled with physics-based models",
        modelingMethod: "Thermal-hydraulic analysis results incorporated",
        examples: ["Containment pressure affecting ECCS performance"]
      },
      [DependencyType.COMMON_CAUSE]: {
        treatmentDescription: "Common cause failures modeled with alpha factor method",
        modelingMethod: "CCF groups with alpha factors",
        examples: ["CCF of redundant pumps"]
      }
    },
    postInitiatorHFEDependencies: {
      dependencyMethod: "THERP dependency model with time and resource factors",
      methodBasis: "NUREG/CR-1278 with plant-specific adaptations",
      dependentHFEExamples: ["HFE-001 and HFE-002 have high dependency due to same crew and short time window"]
    },
    commonCauseFailures: {
      modelingApproach: "Alpha Factor Model",
      parameterBasis: "Industry data with Bayesian update using plant-specific experience",
      ccfGroupsModeled: ["Diesel Generators", "Motor Operated Valves", "Pumps"]
    },
    phenomenologicalDependencies: {
      phenomenaConsidered: ["Room heatup", "Containment pressure effects", "Hydrogen generation"],
      modelingApproach: "Explicit modeling with MAAP code results",
      basisForApproach: "Thermal-hydraulic analyses validated against experiments"
    },
    recoveryActionDependencies: {
      recoveryActionsModeled: ["Offsite power recovery", "Local manual valve operation"],
      dependenciesConsidered: ["Time available", "Staffing", "Environmental conditions"],
      modelingApproach: "Time-based non-recovery probability curves with dependency factors"
    }
  },
  logicalChallenges: {
    circularLogic: {
      "CIRC-001": {
        id: "CIRC-001",
        description: "Circular dependency between electrical power system and service water system",
        involvedElementIds: ["SYS-EPS", "SYS-SWS"],
        detectionMethod: "Automated detection using fault tree analyzer",
        resolutionMethod: CircularLogicResolutionMethod.CONDITIONAL_SPLIT_FRACTIONS,
        resolutionDescription: "Used conditional split fractions to break the loop",
        resolutionImpact: "Less than 5% impact on overall results"
      }
    },
    mutuallyExclusiveEvents: {
      "MEX-001": {
        id: "MEX-001",
        description: "Pump A and Pump B cannot both fail due to same cause",
        eventIds: ["BE-PUMP-A-CCF", "BE-PUMP-B-CCF"],
        basis: "Different design and location",
        treatmentMethod: "Explicit logic in fault trees"
      }
    },
    systemSuccessTreatment: {
      treatmentMethod: "Explicit modeling in event trees and fault trees",
      systemsWithSuccessModeled: ["High Pressure Injection", "Auxiliary Feedwater"],
      impactOnResults: "10-15% reduction in certain sequence frequencies",
      modelingExamples: ["Success of system X credited in sequence Y with appropriate dependencies"]
    }
  },
  uncertaintyAnalysis: {
    propagationMethod: "MONTE_CARLO",
    numberOfSamples: 10000,
    randomSeed: 12345,
    parameterUncertainties: [
      {
        parameterId: "PARAM-001",
        distributionType: DistributionType.LOGNORMAL,
        distributionParameters: { mean: 1.0e-3, errorFactor: 3 },
        basis: "Industry data with Bayesian update"
      }
    ],
    modelUncertainties: [
      {
        uncertaintyId: "MU-001",
        description: "Success criteria for high pressure injection",
        impact: "Moderate impact on SLOCA sequences",
        isQuantified: false,
        treatmentApproach: "Sensitivity analysis"
      }
    ],
    sensitivityStudies: [
      {
        uuid: "sens-001",
        parameter: "Success Criteria for HPI",
        variationRange: ["1/3 pumps", "2/3 pumps"],
        result: "Factor of 2 change in SLOCA sequence frequency",
        conclusion: "Further thermal-hydraulic analysis needed",
        variedParameters: ["HPI Success Criteria"],
        parameterRanges: {
          "HPI Success Criteria": [1, 2]
        }
      }
    ]
  },
  importanceAnalysis: {
    "FUSSELL_VESELY": {
      analysisType: "FUSSELL_VESELY",
      scope: "OVERALL",
      basicEventImportance: {
        "BE-DG-A-FAIL-START": 0.23,
        "BE-PUMP-B-FAIL-RUN": 0.18
      },
      significanceCutoff: 0.05,
      significantBasicEvents: ["BE-DG-A-FAIL-START", "BE-PUMP-B-FAIL-RUN"]
    },
    "RISK_ACHIEVEMENT_WORTH": {
      analysisType: "RISK_ACHIEVEMENT_WORTH",
      scope: "OVERALL",
      basicEventImportance: {
        "BE-DG-A-FAIL-START": 8.5,
        "BE-PUMP-B-FAIL-RUN": 3.2
      },
      significanceCutoff: 2.0,
      significantBasicEvents: ["BE-DG-A-FAIL-START", "BE-PUMP-B-FAIL-RUN"]
    }
  },
  barrierTreatment: {
    barriersConsidered: ["Fuel Cladding", "RCS Boundary", "Containment"],
    barrierFailureModes: {
      "Fuel Cladding": ["Overtemperature", "Mechanical Damage"],
      "RCS Boundary": ["LOCA", "PORV Failure", "SG Tube Rupture"],
      "Containment": ["Overpressure", "Isolation Failure", "Basemat Melt-through"]
    },
    barrierIntegrationMethod: {
      "Fuel Cladding": "Core damage timing from MAAP analyses",
      "RCS Boundary": "Explicit modeling in event trees",
      "Containment": "Linked to release category binning"
    },
    barrierPhenomena: {
      "Fuel Cladding": ["Oxidation", "Melting", "Relocation"],
      "RCS Boundary": ["Thermal creep", "Pressurization", "Thermal shock"],
      "Containment": ["Hydrogen combustion", "Steam explosion", "Corium-concrete interaction"]
    },
    barrierChallengesTreatment: "Phenomenological analysis using validated codes",
    barrierCapacityBasis: "Design specifications with uncertainty factors"
  },
  documentation: {
    uuid: "doc-001",
    name: "Event Sequence Quantification Documentation",
    processDescription: "Event sequences were quantified using fault tree linking with RISKMAN software",
    inputs: ["Event trees from Event Sequence Analysis", "Fault trees from Systems Analysis", 
             "HEPs from Human Reliability Analysis", "Parameter distributions from Data Analysis"],
    appliedMethods: ["Fault Tree Linking", "Monte Carlo Uncertainty Propagation"],
    resultsSummary: "Total frequency of all sequences is 2.3E-5 per year with Small LOCA and LOOP sequences dominating",
    nonRecoveryTermsProcess: "Recovery actions were modeled using time-based non-recovery curves",
    cutsetReviewProcess: "Top 100 cutsets were reviewed by a multi-disciplinary team",
    quantificationProcess: "Full event tree/fault tree linking with circular logic resolution",
    truncationProcess: "Progressive truncation from 1E-8 to 1E-12 to demonstrate convergence",
    familyFrequencies: {
      "ESF-LOCA-SMALL": "2.3E-6 per year",
      "ESF-LOOP": "8.5E-6 per year"
    },
    riskInsights: [
      "Diesel generator reliability is a key factor in risk",
      "Human actions during small LOCA sequences are significant contributors"
    ],
    eventSequencesAndBinning: "Sequences were binned based on initiating event, system response, and end state",
    dependenciesTreatment: "Functional, physical, and human dependencies were modeled explicitly",
    radionuclideBarrierTreatment: "Barrier failures were integrated into the event sequence model",
    mutuallyExclusiveEventsTreatment: "Boolean reduction with explicit removal of impossible combinations",
    asymmetriesInModeling: "Train-specific modeling for key systems to capture asymmetric dependencies",
    computerCodeUsed: "RISKMAN 3.2 with CAFTA 6.0 integration",
    intermediateStatesApproach: "Plant damage states used as intermediate end states for Level 2 analysis",
    riskSignificanceDrivers: "Sequences involving loss of all AC power and small LOCAs with injection failure",
    comparisonToSimilarPlants: "Results are consistent with similar plants within expected variation"
  },
  uncertaintyDocumentation: {
    modelUncertaintySources: [
      {
        sourceId: "MU-001",
        description: "Uncertainty in success criteria for high pressure injection",
        impact: "Moderate impact on SLOCA sequence frequencies",
        relatedAssumptions: ["Success assumed based on design calculations"],
        alternativeApproaches: ["More conservative success criteria"],
        treatmentApproach: "Sensitivity analysis performed"
      }
    ],
    keyAssumptions: [
      {
        description: "No external events considered in this quantification",
        impact: "Results only applicable to internal events risk"
      },
      {
        description: "Mission time of 24 hours for all systems",
        impact: "May underestimate long-term scenarios"
      }
    ],
    reasonableAlternatives: [
      {
        alternative: "Alternative success criteria for high pressure injection",
        reasonNotSelected: "Thermal-hydraulic analysis supports current criteria",
        applicableElements: ["High Pressure Injection System"]
      }
    ]
  },
  limitationsDocumentation: {
    quantificationLimitations: [
      {
        limitationId: "LIM-001",
        description: "Limited plant-specific data for certain components",
        applicationImpact: "May affect uncertainty in specific sequences",
        potentialWorkarounds: "Use of sensitivity studies to bound impact"
      },
      {
        limitationId: "LIM-002",
        description: "Simplifications in thermal-hydraulic modeling",
        applicationImpact: "May affect success criteria for boundary cases",
        potentialWorkarounds: "Conservative success criteria used"
      }
    ],
    validationLimitations: ["Limited validation against operational experience"],
    dataLimitations: ["Limited plant-specific data for some components"],
    modelIntegrationLimitations: ["Simplifications in dependency modeling between technical elements"]
  },
  mechanisticSourceTermAnalysisReferences: ["MST-REP-001", "MST-CALC-002"]
} as const;

/**
 * Collection of examples for Event Sequence Quantification
 * 
 * A convenient object containing all the examples for easy access.
 * 
 * @example
 * ```typescript
 * // Access all examples
 * import { examples } from 'event_sequence_quantification';
 * 
 * // Use a specific example
 * const esqExample = examples.EventSequenceQuantificationExample;
 * ```
 * @const
 * @group Examples
 */
export const examples = {
  EventSequenceQuantificationExample
} as const;
