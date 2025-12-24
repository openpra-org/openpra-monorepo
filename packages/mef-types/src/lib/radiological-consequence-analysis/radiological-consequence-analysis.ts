import typia, { tags } from 'typia';
import {
  TechnicalElement,
  TechnicalElementTypes,
  TechnicalElementMetadata,
} from '../technical-element';
import { Named, Unique } from '../core/meta';
import {
  ImportanceLevel,
  SensitivityStudy,
  RiskMetricType,
  RiskSignificanceCriteriaType,
} from '../core/shared-patterns';
import {
  BaseProcessDocumentation,
  BaseModelUncertaintyDocumentation,
  BasePeerReviewDocumentation,
  BaseAssumption,
} from '../core/documentation';
import { EventSequenceFamilyReference } from '../event-sequence-analysis/event-sequence-analysis';
import {
  ReleaseCategoryReference as MstReleaseCategoryReference,
  SourceTermDefinitionReference,
} from '../mechanistic-source-term/mechanistic-source-term';
import {
  VersionInfo,
  SCHEMA_VERSION,
  createVersionInfo,
} from '../core/version';
//==============================================================================
/**
 * @group Meteorological Data Analysis
 * @description Collection and analysis of weather data for dispersion calculations
 * @implements RCME-A11, RCME-B3
 */
//==============================================================================

/**
 * Represents the analysis of meteorological data used in radiological consequence calculations.
 * @remarks **RCME-A11**
 * @remarks **RCME-B3**
 * @example
 * ```typescript
 * const meteorologicalDataAnalysis = {
 *   parameterUncertaintyCharacterisation: "Uncertainty in wind speed and direction modelled using historical data distributions.",
 *   meteorologicalDataSetDescription: "Five years of hourly meteorological data from the on-site tower were used.",
 *   meteorologicalFrequencyDistributionTreatment: "A stratified random sampling approach was used to select representative weather sequences."
 * };
 * ```
 * @group Meteorological Data Analysis
 */
export interface MeteorologicalDataAnalysis {
  /**
   * Characterisation of the uncertainty distribution of meteorological parameters.
   * Required by **RCME-B3**.
   * @example "Uncertainty in wind speed and direction modelled using historical data distributions."
   * @remarks **RCME-B3**
   */
  parameterUncertaintyCharacterisation?: string;

  /**
   * Description of the meteorological data set(s) used for the analysis, including the period of data collection and relevant parameters.
   * @example "Five years of hourly meteorological data (wind speed, wind direction, atmospheric stability) from the on-site meteorological tower were used."
   * @remarks **RCME-A11**
   */
  meteorologicalDataSetDescription?: string;

  /**
   * Description of how the frequency distribution of meteorological conditions is accounted for in the consequence analysis.
   * @example "A stratified random sampling approach was used to select meteorological sequences from the five-year data set to represent the frequency distribution of weather conditions."
   * @remarks **RCME-B3**
   */
  meteorologicalFrequencyDistributionTreatment?: string;

  /**
   * Description of how temporal changes in meteorological conditions are accommodated.
   * Required by **HLR-RCAD-D**.
   * @example "Hourly meteorological data was used to capture diurnal variations in wind patterns."
   */
  temporalChangesAccommodation?: string;

  /**
   * Time resolution of meteorological data.
   * @example "Hourly" | "Daily" | "Monthly"
   */
  timeResolution?: string;
}

//==============================================================================
/**
 * @group Consequence Quantification
 * @description Quantitative analysis of radiological consequences
 * @implements RCQ-A1, RCQ-A2, RCQ-A3, RCQ-D
 */
//==============================================================================

/**
 * Represents the quantification of radiological consequences.
 * @remarks **RCQ-A1**
 * @remarks **RCQ-A2**
 * @example
 * ```typescript
 * const consequenceQuantificationAnalysis = {
 *   selectedMetrics: ["Early Fatalities", "Latent Cancer Fatalities"],
 *   consequenceCodesUsed: ["MACCS2 code version 1.13"],
 *   modelAndCodeLimitations: [
 *     { feature: "Gaussian plume model", limitation: "Assumes flat terrain; not accurate in complex terrain." }
 *   ],
 *   eventSequenceConsequences: [
 *     {
 *       eventSequenceFamily: "Large LOCA with Containment Failure",
 *       consequences: { "Early Fatalities": 0.1, "Latent Cancer Fatalities": 5.0 }
 *     }
 *   ],
 *   uncertaintyCharacterization: "Uncertainty in meteorological conditions, source term magnitude, and dose coefficients were propagated.",
 *   supportingDocumentationReferences: ["Section 5 of the main report", "Appendix B: Consequence Code Validation"]
 * };
 * ```
 * @group Consequence Quantification
 */
export interface ConsequenceQuantificationAnalysis {
  /**
   * Selected consequence metrics for the analysis.
   * Required by **RCQ-A1**.
   * @example ["Early Fatalities", "Latent Cancer Fatalities (50-year TEDE)", "Maximum Off-site Dose"]
   * @remarks **RCQ-A1**
   */
  selectedMetrics: string[];

  /**
   * Models and computer codes used to perform the radiological consequence analysis.
   * @example "MACCS2 code version 1.13"
   * @remarks **RCQ-A1**
   */
  consequenceCodesUsed: string[];

  /**
   * Features and limitations of the models and codes used for consequence analysis that could impact the results.
   * Required by **RCQ-A2**.
   * @remarks **RCQ-A2**
   */
  modelAndCodeLimitations: {
    code?: string;
    feature: string;
    limitation: string;
    justification?: string;
  }[];

  /**
   * List of event sequence families and their associated radiological consequences.
   * Required by **RCQ-A3**.
   * @example [{ eventSequenceFamily: "ESF-001", consequences: { "Early Fatalities": 0.1, "Latent Cancer Fatalities": 0.5 } }]
   * @remarks **RCQ-A3**: Compiles a list of event sequence families and their associated radiological consequences.
   */
  eventSequenceConsequences: {
    eventSequenceFamily: EventSequenceFamilyReference;
    consequences: Record<string, number>;
    consequenceMetric?: string;
    meanValue?: number;
    uncertainty?: string;

    /**
     * Reference to the source term definition associated with this event sequence family.
     * This provides a link to the mechanistic source term analysis.
     */
    sourceTermReference?: SourceTermDefinitionReference;

    /**
     * Reference to the release category associated with this event sequence family.
     * This provides a link to the mechanistic source term analysis.
     */
    releaseCategoryReference?: MstReleaseCategoryReference;

    /**
     * Risk significance level determined by risk integration, if available.
     * This may be populated based on feedback from risk integration.
     */
    riskSignificance?: ImportanceLevel;

    /**
     * Insights from risk integration, if available.
     * This may be populated based on feedback from risk integration.
     */
    riskIntegrationInsights?: string[];
  }[];

  /**
   * Characterization of uncertainties in the Radiological Consequence Analysis.
   * @example "Uncertainty in meteorological conditions, source term magnitude, and dose coefficients were propagated."
   * @remarks **HLR-RCQ-D**
   */
  uncertaintyCharacterization?: string;

  /**
   * References to documentation of the input data, models, assumptions, and results of the Consequence Quantification analysis.
   * @example ["Section 5 of the main report", "Appendix B: Consequence Code Validation"]
   * @remarks **RCQ-D1**
   */
  supportingDocumentationReferences?: string[];

  /**
   * Health effects considered in the consequence analysis.
   * Supports **RCRE-A2(c)** and **RCRE-B2**.
   */
  healthEffectsConsidered?: {
    earlyEffects?: string[];
    latentEffects?: string[];
    doseResponseApproach?: string;
  };

  /**
   * Economic factors considered in the consequence analysis.
   * Supports **RCQ-A1**.
   */
  economicFactorsConsidered?: {
    costCategories?: string[];
    valuationApproach?: string;
    timeHorizon?: string;
  };

  /**
   * Mapping between consequence metrics and risk metrics used in risk integration.
   * This provides a direct link between radiological consequence analysis and risk integration.
   */
  riskMetricMapping?: {
    /**
     * Consequence metric from this analysis
     */
    consequenceMetric: string;

    /**
     * Corresponding risk metric in risk integration
     */
    riskMetric: RiskMetricType | string;

    /**
     * Description of how the consequence metric is used in risk integration
     */
    mappingDescription: string;

    /**
     * Any transformations or adjustments applied to the consequence metric
     * when used in risk integration
     */
    transformations?: string;
  }[];

  /**
   * Feedback received from risk integration.
   * This field contains feedback from risk integration that should be considered
   * in future revisions of the radiological consequence analysis.
   */
  riskIntegrationFeedback?: {
    /** ID of the risk integration analysis that provided the feedback */
    analysisId: string;

    /** Date the feedback was received */
    feedbackDate?: string;

    /** Feedback on consequence metrics */
    metricFeedback?: {
      /** Consequence metric */
      metric: string;

      /** Risk significance level determined by risk integration */
      riskSignificance?: ImportanceLevel;

      /** Insights from risk integration */
      insights?: string[];

      /** Recommendations for improving the consequence metric */
      recommendations?: string[];
    }[];

    /** General feedback on the consequence analysis */
    generalFeedback?: string;

    /** Response to the feedback */
    response?: {
      /** Description of how the feedback was or will be addressed */
      description: string;

      /** Changes made or planned in response to the feedback */
      changes?: string[];

      /** Status of the response */
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    };
  };
}

//==============================================================================
/**
 * @group Documentation & Traceability
 * @description Process documentation, requirements tracing, and peer review
 */
//==============================================================================

/**
 * Documentation of the Radiological Consequence Analysis process.
 * @example
 * ```typescript
 * const radiologicalConsequenceDocumentation = {
 *   uuid: "rcd-001",
 *   name: "Radiological Consequence Analysis Documentation",
 *   processDescription: "This analysis followed the standard methodology for radiological consequence assessment.",
 *   inputSources: ["Source term data from Mechanistic Source Term Analysis", "Site meteorological data"],
 *   appliedMethods: ["Gaussian plume dispersion modeling", "ICRP dosimetry methods"],
 *   resultsSummary: "Results indicate that all release categories meet the safety criteria.",
 *   peerReview: {
 *     reviewDate: "2023-06-15",
 *     reviewers: ["Dr. Jane Smith", "Dr. John Doe"],
 *     findings: [
 *       {
 *         id: "FIND-001",
 *         description: "Uncertainty analysis for evacuation timing needs improvement",
 *         significance: "MEDIUM",
 *         status: "OPEN"
 *       }
 *     ]
 *   },
 *   uncertaintiesAndAssumptions: [
 *     "Assumption: Population distribution is based on 2020 census data.",
 *     "Uncertainty: Evacuation timing has a significant impact on early health effects."
 *   ],
 *   sensitivityStudies: [
 *     {
 *       uuid: "sens-001",
 *       description: "Sensitivity to meteorological conditions",
 *       variedParameters: ["Wind speed", "Stability class"],
 *       parameterRanges: { "Wind speed": [1, 10], "Stability class": [1, 6] },
 *       results: "Results are most sensitive to stability class during the release."
 *     }
 *   ]
 * };
 * ```
 * @group Documentation & Traceability
 */
export interface RadiologicalConsequenceDocumentation
  extends BaseProcessDocumentation {
  /**
   * Input sources used in the analysis.
   * @example ["Source term data from Mechanistic Source Term Analysis", "Site meteorological data"]
   */
  inputSources: string[];

  /**
   * Methods applied in the analysis.
   * @example ["Gaussian plume dispersion modeling", "ICRP dosimetry methods"]
   */
  appliedMethods: string[];

  /**
   * Summary of analysis results.
   * @example "Results indicate that all release categories meet the safety criteria."
   */
  resultsSummary: string;

  /**
   * Peer review documentation.
   */
  peerReview?: BasePeerReviewDocumentation;

  /**
   * Documentation of uncertainties and assumptions.
   * @example ["Assumption: Population distribution is based on 2020 census data."]
   */
  uncertaintiesAndAssumptions: string[];

  /**
   * Sensitivity studies conducted.
   * Uses the standardized SensitivityStudy interface from shared-patterns.
   */
  sensitivityStudies?: SensitivityStudy[];

  /**
   * Model uncertainty documentation
   */
  modelUncertaintyDocumentation?: BaseModelUncertaintyDocumentation;

  /**
   * Specific assumptions made in the radiological consequence analysis
   */
  assumptions?: BaseAssumption[];

  /**
   * Traceability to requirements in standards and regulations
   */
  requirementTraceability?: {
    /** Requirement identifier */
    requirementId: string;
    /** Standard or regulation reference */
    standardReference: string;
    /** How the requirement is addressed */
    implementation: string;
  }[];

  /**
   * Documentation of the integration with risk integration.
   * Describes how this analysis is used in risk integration and how feedback is incorporated.
   */
  riskIntegrationDocumentation?: {
    /** Description of the integration process */
    integrationProcessDescription: string;

    /** How consequence metrics are used in risk integration */
    consequenceMetricUsage: {
      /** Consequence metric name */
      metricName: string;

      /** Corresponding risk metric in risk integration */
      correspondingRiskMetric?: RiskMetricType;

      /** Description of how the metric is used */
      usageDescription: string;
    }[];

    /** How uncertainties are propagated to risk integration */
    uncertaintyPropagation?: string;

    /** Challenges encountered during integration */
    integrationChallenges?: string[];

    /** How inconsistencies were resolved */
    inconsistencyResolution?: string;

    /** Feedback received from risk integration */
    feedbackReceived?: {
      /** Source of the feedback */
      source: string;

      /** Date feedback was received */
      date?: string;

      /** Description of the feedback */
      description: string;

      /** Significance of the feedback */
      significance: ImportanceLevel;
    }[];

    /** How feedback was incorporated */
    feedbackIncorporation?: {
      /** Reference to the feedback */
      feedbackReference: string;

      /** Description of how feedback was incorporated */
      incorporationDescription: string;

      /** Status of incorporation */
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

      /** Date of incorporation */
      date?: string;
    }[];

    /** Key insights about consequences derived from risk integration */
    keyInsights?: string[];

    /** References to risk integration analyses that use this consequence analysis */
    riskIntegrationReferences?: {
      /** ID of the risk integration analysis */
      analysisId: string;

      /** Version of the analysis */
      version?: string;

      /** Date of the analysis */
      date?: string;

      /** Description of how this analysis was used */
      usageDescription: string;
    }[];
  };
}

//==============================================================================
/**
 * @group API
 * @description Represents the technical element for 4.3.17 Radiological Consequence Analysis (RC).
 * @remarks This technical element addresses the analysis of off-site radiological consequences from postulated releases.
 * @remarks **HLR-RCRE-A**
 * @remarks **HLR-RCRE-B**
 * @remarks **HLR-RCAD-A**
 * @remarks **HLR-RCDO-B**
 * @remarks **HLR-RCQ-D**
 *
 * @example
 * ```typescript
 * const analysis: RadiologicalConsequenceAnalysis = {
 *   "technical-element-type": TechnicalElementTypes.CONSEQUENCE_ANALYSIS,
 *   "technical-element-code": "RC",
 *   metadata: {
 *     version: "1.0",
 *     analysis_date: "2024-03-15",
 *     analyst: "Jane Smith",
 *     scopeDefinition: {
 *       // ... scope details
 *     }
 *   },
 *   releaseCategoryToConsequence: { ... },
 *   atmosphericTransportAndDispersion: { ... },
 *   dosimetry: { ... },
 *   consequenceQuantification: { ... },
 *   protectiveActionParameters: { ... },
 *   meteorologicalData: { ... }
 * };
 * ```
 * @group API
 */
export interface RadiologicalConsequenceAnalysis
  extends TechnicalElement<TechnicalElementTypes.CONSEQUENCE_ANALYSIS> {
  'technical-element-type': TechnicalElementTypes.CONSEQUENCE_ANALYSIS;
  'technical-element-code': 'RC';

  /**
   * Metadata for the Radiological Consequence Analysis.
   */
  metadata: TechnicalElementMetadata & {
    /**
     * Scope of the radiological consequence analysis.
     */
    scopeDefinition: RadiologicalConsequenceAnalysisScope;

    /**
     * Additional metadata specific to Radiological Consequence Analysis.
     */
    additionalMetadata?: {
      /** Radiological consequence analysis specific limitations */
      limitations?: string[];

      /** Radiological consequence analysis specific assumptions */
      assumptions?: string[];

      /** Traceability information */
      traceability?: string;

      /**
       * References to risk integration results that use this analysis.
       * This provides traceability between technical elements.
       */
      riskIntegrationReferences?: {
        /** ID of the risk integration analysis */
        analysisId: string;

        /** Version or revision of the analysis */
        version?: string;

        /** Date the analysis was performed */
        date?: string;

        /** Description of how this analysis was used in risk integration */
        usageDescription: string;
      }[];
    };
  };

  /**
   * **4.3.17.1 Release Category to Radiological Consequence (RCRE)**
   * @group Release Category Analysis
   */
  releaseCategoryToConsequence: ReleaseCategoryToConsequenceAnalysis;

  /**
   * **4.3.17.4 Atmospheric Transport and Dispersion (RCAD)**
   * @group Atmospheric Dispersion Analysis
   */
  atmosphericTransportAndDispersion: AtmosphericDispersionAnalysis;

  /**
   * **4.3.17.5 Dosimetry (RCDO)**
   * @group Dosimetry Analysis
   */
  dosimetry: DosimetryAnalysis;

  /**
   * **4.3.17.8 Consequence Quantification (RCQ)**
   * @group Consequence Quantification
   */
  consequenceQuantification: ConsequenceQuantificationAnalysis;

  /**
   * **4.3.17.2 Protective Action Parameters and Other Site Data Analysis (RCPA)**
   * @group Protective Action Analysis
   */
  protectiveActionParameters: ProtectiveActionAnalysis;

  /**
   * **4.3.17.3 Meteorological Data (RCME)**
   * @group Meteorological Data Analysis
   */
  meteorologicalData: MeteorologicalDataAnalysis;

  /**
   * Documentation of the Radiological Consequence Analysis process
   * @group Documentation & Traceability
   */
  documentation?: RadiologicalConsequenceDocumentation;

  /**
   * Documentation of the integration with risk integration.
   * Describes how this analysis is used in risk integration and how feedback is incorporated.
   */
  riskIntegrationDescription?: {
    /** Description of how this analysis supports risk integration */
    supportDescription: string;

    /** How consequence metrics are used in risk integration */
    consequenceMetricUsage: string;

    /** How uncertainties are propagated to risk integration */
    uncertaintyPropagation?: string;

    /** Challenges in integrating with risk integration */
    integrationChallenges?: string[];

    /** How feedback from risk integration is incorporated */
    feedbackIncorporation?: string;

    /** Key insights about consequences derived from risk integration */
    keyInsights?: string[];
  };

  /**
   * Risk integration information.
   * This field provides information specifically structured for consumption by risk integration.
   * @remarks This helps maintain a clean dependency structure where Risk Integration depends on
   * Radiological Consequence Analysis rather than directly on multiple upstream elements.
   */
  riskIntegrationInfo?: {
    /**
     * Risk-significant consequences identified in this analysis.
     * This provides a simplified view of risk-significant consequences for risk integration.
     */
    riskSignificantConsequences: {
      /** Release category identifier */
      releaseCategoryId: string;

      /** Source term definition identifier */
      sourceTermDefinitionId?: string;

      /** Consequence metrics and their values */
      consequenceMetrics: Record<string, number>;

      /** Risk significance level */
      riskSignificance: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

      /** Risk insights derived from this consequence */
      riskInsights?: string[];

      /** Uncertainty description */
      uncertaintyDescription?: string;

      /** Mapped risk metrics used in risk integration */
      mappedRiskMetrics?: {
        /** Risk metric name */
        metricName: string;

        /** Description of how the consequence maps to this risk metric */
        mappingDescription: string;
      }[];
    }[];

    /**
     * Feedback received from risk integration.
     * This field contains feedback from risk integration that should be considered
     * in future revisions of the radiological consequence analysis.
     */
    riskIntegrationFeedback?: {
      /** ID of the risk integration analysis that provided the feedback */
      analysisId: string;

      /** Date the feedback was received */
      feedbackDate?: string;

      /** Feedback on specific consequence metrics */
      metricFeedback?: {
        /** Consequence metric */
        metric: string;

        /** Risk significance level determined by risk integration */
        riskSignificance?: ImportanceLevel;

        /** Insights from risk integration */
        insights?: string[];

        /** Recommendations for improving the consequence metric */
        recommendations?: string[];
      }[];

      /** General feedback on the consequence analysis */
      generalFeedback?: string;

      /** Response to the feedback */
      response?: {
        /** Description of how the feedback was or will be addressed */
        description: string;

        /** Changes made or planned in response to the feedback */
        changes?: string[];

        /** Status of the response */
        status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
      };
    };
  };
}

/**
 * @module radiological_consequence_analysis
 * @description Types and interfaces for Radiological Consequence Analysis based on relevant standards
 * 
 * The objectives of Radiological Consequence Analysis are met here
 
 * @preferred
 * @category Technical Elements 
 */

/**
 * Reference to a release category.
 * @example "RCAT-001", "RCAT-42"
 * @group Release Category Analysis
 */
export type ReleaseCategoryReference = string & tags.Pattern<'^RCAT-[1-9]+$'>;

/**
 * Reference to a site.
 * @example "SITE-001", "SITE-42"
 * @group Release Category Analysis
 */
export type SiteReference = string & tags.Pattern<'^SITE-[1-9]+$'>;

/**
 * Represents a bounding site with relevant characteristics for consequence analysis.
 * @example
 * ```typescript
 * const boundingSite: BoundingSite = {
 *   description: "A generic site located 10 km from a population centre with a flat terrain.",
 *   justification: "The distance to the population centre is the minimum for all sites, and the flat terrain represents the most conservative dispersion scenario.",
 *   characteristics: {
 *     siteBoundaryDistance: 0.5,
 *     populationCentreDistance: 10,
 *     terrain: "Flat",
 *     "predominantWindDirection": "West"
 *   }
 * };
 * ```
 * @group Release Category Analysis
 */
export interface BoundingSite {
  /**
   * Description of the bounding site.
   * @example "A generic site located 10 km from a population centre with a flat terrain."
   */
  description: string;

  /**
   * Justification for why this site bounds other sites in the scope of the PRA.
   * @example "The distance to the population centre is the minimum for all sites, and the flat terrain represents the most conservative dispersion scenario."
   */
  justification: string;

  /**
   * Key characteristics of the bounding site relevant to consequence analysis.
   */
  characteristics: {
    /**
     * Distance to the site boundary in km.
     * @example 0.5
     */
    siteBoundaryDistance?: number;

    /**
     * Distance to the nearest population centre in km.
     * @example 10
     */
    populationCentreDistance?: number;

    /**
     * Description of the terrain around the site.
     * @example "Flat" | "Hilly" | "Coastal"
     */
    terrain?: string;

    /**
     * Other relevant site characteristics.
     * @example "Predominant wind direction: West"
     */
    [key: string]: any;
  };

  /**
   * Detailed justification explaining how this site bounds all sites in the scope of the PRA.
   * Required by **RCRE-A1**.
   * @example "This site was selected as bounding because it has the shortest distance to population centers and most conservative meteorological conditions."
   */
  boundingJustification: string;

  /**
   * List of sites that are bounded by this site.
   * @example ["Site A", "Site B", "Site C"]
   */
  boundedSites?: string[];
}

/**
 * Represents the analysis of radiation doses to individuals and populations.
 * @remarks **RCDO-A1**
 * @remarks **RCDO-B**
 * @example
 * ```typescript
 * const dosimetryAnalysis: DosimetryAnalysis = {
 *   exposurePathways: ["Inhalation", "Ground Shine", "Cloud Submersion"],
 *   dcfSource: "ICRP Publication 72",
 *   shieldingConsiderations: "Shielding factors for residential areas were based on typical building attenuation.",
 *   occupancyConsiderations: "Time-dependent occupancy factors were used for different land use types.",
 *   dcfUncertainty: {
 *     sources: ["Age-dependent variability", "Biokinetic model parameters"],
 *     assumptions: ["Adult dose coefficients are used for the entire population"],
 *     alternatives: ["Age-specific dose coefficients for different population groups"]
 *   },
 *   dcfParameterUncertaintyCharacterisation: "Log-normal distributions were assumed for DCF parameter uncertainties.",
 *   receptorTypes: ["Adult", "Child (1 year)", "Infant (3 months)"],
 *   dosimetryModelsUsed: "Dose calculations were performed using the EPA Federal Guidance Report No. 11 and 12 methodologies.",
 *   doseAggregationMethod: "Organ doses were calculated for key organs, and effective dose was determined using ICRP Publication 103 weighting factors.",
 *   radionuclideDecayConsideration: "Radionuclide decay was accounted for during atmospheric transport and dose calculations using half-life data.",
 *   doseIntegrationPeriods: ["7-day thyroid dose", "50-year committed effective dose"]
 * };
 * ```
 * @group Dosimetry Analysis
 */
export interface DosimetryAnalysis {
  /**
   * Identified exposure pathways considered in the analysis.
   * Required by **RCDO-A1**.
   * @example ["Inhalation", "Ground Shine", "Cloud Submersion"]
   * @remarks **RCDO-A1**
   */
  exposurePathways: string[];

  /**
   * The recognized source(s) used for Dose Conversion Factors (DCFs).
   * Required by **RCDO-A2**.
   * @example "ICRP Publication 72", "Federal Guidance Report No. 11"
   * @remarks **RCDO-A3**
   */
  dcfSource: string;

  /**
   * Considerations for shielding factors appropriate for receptor locations and activities.
   * Relevant to **RCDO-A3**.
   * @example "Shielding factors for residential areas were based on typical building attenuation." | "No shielding factors were applied for conservative estimates."
   */
  shieldingConsiderations?: string;

  /**
   * Considerations for occupancy factors appropriate for receptor locations and activities.
   * Relevant to **RCDO-A3**.
   * @example "Occupancy factors were assumed to be 1 for all receptors for simplicity." | "Time-dependent occupancy factors were used for different land use types."
   */
  occupancyConsiderations?: string;

  /**
   * Sources of model uncertainty, related assumptions, and reasonable alternatives for DCFs.
   * Required by **RCDO-A10**.
   * @remarks **RCDO-A10**: Describes how organ doses are calculated and aggregated to determine effective dose or other relevant dose metrics.
   */
  dcfUncertainty: {
    sources: string[];
    assumptions: string[];
    alternatives: string[];
  };

  /**
   * Characterisation of the uncertainty distribution of DCF parameters.
   * Required by **RCDO-C2**.
   * @example "Log-normal distributions were assumed for DCF parameter uncertainties based on literature."
   * @remarks **RCDO-C2**
   */
  dcfParameterUncertaintyCharacterisation?: string;

  /**
   * Identifies the age groups or receptor types for which doses are calculated.
   * @example ["Adult", "Teenager", "Child (1 year)", "Infant (3 months)"]
   * @remarks **RCDO-A2**
   */
  receptorTypes?: string[];

  /**
   * The dosimetry models used in the analysis.
   * @example "Dose calculations were performed using the EPA Federal Guidance Report No. 11 and 12 methodologies."
   * @remarks **HLR-RCDO-B**
   */
  dosimetryModelsUsed?: string;

  /**
   * Describes how organ doses are calculated and aggregated to determine effective dose or other relevant dose metrics.
   * @example "Organ doses were calculated for key organs, and effective dose was determined using ICRP Publication 103 weighting factors."
   * @remarks **RCDO-A10**
   */
  doseAggregationMethod?: string;

  /**
   * Describes how the dosimetry analysis accounts for the physical and radiological decay of radionuclides.
   * @example "Radionuclide decay was accounted for during atmospheric transport and dose calculations using half-life data."
   * @remarks **HLR-RCDO-C**
   */
  radionuclideDecayConsideration?: string;

  /**
   * Specifies the time periods over which doses are integrated.
   * @example ["7-day thyroid dose", "50-year committed effective dose"]
   * @remarks **RCDO-C1**
   */
  doseIntegrationPeriods?: string[];
}

/**
 * Represents characteristics of a radionuclide release for consequence analysis.
 * @remarks **RCRE-A2**
 * @example
 * ```typescript
 * const releaseCharacteristics: ReleaseCharacteristics = {
 *   numberOfPlumes: 1,
 *   radionuclideGroupFractions: { NobleGases: 1.0, Iodines: 0.5 },
 *   importantRadionuclides: ["I-131", "Cs-137"],
 *   releaseTiming: "0 hour",
 *   releaseDuration: "2 hours",
 *   warningTime: "0.5 hours",
 *   releaseEnergy: "High",
 *   releaseHeight: "Ground"
 * };
 * ```
 * @group Release Category Analysis
 */
export interface ReleaseCharacteristics {
  /**
   * The number of plumes associated with the release.
   * @example 1
   */
  numberOfPlumes?: number;

  /**
   * Quantity of each radionuclide released by species in each time phase of release (in Becquerels or Curies).
   * This is a record where the key is the radionuclide (e.g., "Cs-137") and the value is an array of quantities for each time phase.
   * @example { "Cs-137": [1e15, 5e14], "I-131": [2e14, 1e14] }
   */
  radionuclideQuantities?: Record<string, number[]>;

  /**
   * Fractions of radionuclide groups released.
   * @example { NobleGases: 1.0, Iodines: 0.5 }
   */
  radionuclideGroupFractions?: Record<string, number>;

  /**
   * Radionuclide isotopes important to dose or health effects.
   * Required by **RCRE-A2(c)**.
   * @example ["I-131", "Cs-137", "Sr-90"]
   */
  importantRadionuclides?: string[];

  /**
   * Brief justification for why these radionuclides are important to health effects.
   * @example "I-131 is important for thyroid dose; Cs-137 for long-term exposure; Sr-90 for bone dose"
   */
  importantRadionuclidesJustification?: string;

  /**
   * Release timing and duration of each release phase in hours.
   * Array representing start time and duration for each phase.
   * @example [[2], [1, 5]] // Phase 1: starts at 0 hours, lasts 2 hours; Phase 2: starts at 5 hours, lasts 1 hour.
   */
  releaseTimingAndDuration?: [number, number][];

  /**
   * Release timing (start time) for each release phase in hours.
   * @example "0 hour"
   */
  releaseTiming?: string;

  /**
   * Release duration for each release phase in hours.
   * @example "2 hours"
   */
  releaseDuration?: string;

  /**
   * Warning time before the start of release or releases in hours.
   * @example 1
   */
  warningTime?: number;

  /**
   * Warning time as a string description.
   * @example "0.5 hours"
   */
  warningTimeDescription?: string;

  /**
   * Hazards impacting protective actions.
   * @example "Presence of smoke may hinder evacuation."
   */
  hazardsImpactingProtectiveActions?: string;

  /**
   * Thermal energy of the release(s) in Joules.
   * @example 1e9
   */
  releaseEnergy?: number;

  /**
   * Thermal energy description.
   * @example "High"
   */
  releaseEnergyDescription?: string;

  /**
   * Release height in meters above ground level.
   * @example 30
   */
  releaseHeight?: number;

  /**
   * Release height description.
   * @example "Ground"
   */
  releaseHeightDescription?: string;

  /**
   * Released particle size in micrometers (e.g., activity median aerodynamic diameter - AMAD).
   * @example 1.0
   */
  releasedParticleSize?: number;

  /**
   * Released particle size description.
   * @example "Aerosol"
   */
  releasedParticleSizeDescription?: string;

  /**
   * Uncertainties associated with the release characteristics.
   * @example "Uncertainty in release fraction for volatile isotopes."
   */
  releaseUncertainties?: string;
}

/**
 * Defines the scope of the Radiological Consequence Analysis.
 * @example
 * ```typescript
 * const scope: RadiologicalConsequenceAnalysisScope = {
 *   isSpecificSite: true,
 *   siteReference: "SITE-001",
 *   consequenceMetrics: ["Individual Early Fatality Risk", "Population Latent Cancer Risk"],
 *   protectiveActionsModellingDegree: "Detailed modelling based on site-specific emergency plans.",
 *   meteorologyModellingDegree: "Site-specific meteorological data used.",
 *   atmosphericDispersionModellingDegree: "Complex Gaussian plume model with terrain effects.",
 *   dosimetryModelsUsed: "Dose calculations using EPA Federal Guidance Report No. 11 and 12 methodologies.",
 *   doseAggregationMethod: "Organ doses calculated for key organs, effective dose determined using ICRP Publication 103 weighting factors.",
 *   radionuclideDecayConsideration: "Decay accounted for during atmospheric transport and dose calculations using half-life data.",
 *   doseIntegrationPeriods: ["7-day thyroid dose", "50-year committed effective dose"]
 * };
 * ```
 * @group Release Category Analysis
 */
export interface RadiologicalConsequenceAnalysisScope {
  /**
   * Indicates whether a specific site is being analysed.
   * If false, a bounding site is assumed.
   * @example true
   */
  isSpecificSite: boolean;

  /**
   * Reference to the specific site being analysed, if applicable.
   * @example "SITE-001"
   */
  siteReference?: SiteReference;

  /**
   * Description and justification of the bounding site used, if applicable.
   * @example { description: "...", justification: "...", characteristics: { ... } }
   */
  boundingSite?: BoundingSite;

  /**
   * Consequence measure(s) selected for the intended application of the PRA.
   * References to metrics defined in Risk Integration.
   * @example ["Individual Early Fatality Risk", "Population Latent Cancer Risk"]
   * @remarks **RCRE-B1**
   */
  consequenceMetrics: string[];

  /**
   * Degree to which protective actions are modelled.
   * @example "Detailed modelling based on site-specific emergency plans." | "Simplified bounding assumptions."
   */
  protectiveActionsModellingDegree: string;

  /**
   * Degree to which meteorology is modelled.
   * @example "Site-specific meteorological data used." | "Generic meteorological distributions."
   */
  meteorologyModellingDegree: string;

  /**
   * Degree to which atmospheric transport and dispersion are modelled.
   * @example "Complex Gaussian plume model with terrain effects." | "Simple straight-line Gaussian plume model."
   */
  atmosphericDispersionModellingDegree: string;

  /**
   * Degree to which dosimetry is modelled.
   * @example "Detailed organ dose calculations for multiple exposure pathways." | "Effective dose based on inhalation pathway only."
   */
  dosimetryModellingDegree: string;

  /**
   * Degree to which health effects are modelled.
   * @example "Probabilistic modelling of early and latent health effects." | "Bounding estimates of severe outcomes."
   */
  healthEffectsModellingDegree: string;

  /**
   * Degree to which economic factors are modelled.
   * @example "Comprehensive assessment of off-site economic impacts." | "Qualitative discussion of potential costs."
   */
  economicFactorsModellingDegree: string;
}

/**
 * Inputs required for the off-site Radiological Consequence Analysis methodology for a specific release category.
 * @example
 * ```typescript
 * const releaseCategoryInputs: ReleaseCategoryInputs = {
 *   releaseCategory: "RCAT-001",
 *   releaseCharacteristics: {
 *     numberOfPlumes: 1,
 *     radionuclideGroupFractions: { NobleGases: 1.0, Iodines: 0.5 },
 *     importantRadionuclides: ["I-131", "Cs-137"],
 *     releaseTiming: "0 hour",
 *     releaseDuration: "2 hours"
 *   }
 * };
 * ```
 * @group Release Category Analysis
 */
export interface ReleaseCategoryInputs {
  /**
   * Reference to the release category.
   * @example "RCAT-001"
   */
  releaseCategory: ReleaseCategoryReference;

  /**
   * Characteristics of the radionuclide release for this category.
   * @example { numberOfPlumes: 1, radionuclideQuantities: { ... }, ... }
   */
  releaseCharacteristics: ReleaseCharacteristics;
}

//==============================================================================
/**
 * @group Release Category Analysis
 * @description Analysis linking release categories to radiological consequences
 * @implements RCRE-A1, RCRE-A2, RCRE-A3, RCRE-B1, RCRE-C1
 */
//==============================================================================

/**
 * Represents the analysis linking release categories to radiological consequences.
 * @remarks **RCRE-A1**
 * @remarks **RCRE-A2**
 * @remarks **RCRE-A3**
 * @example
 * ```typescript
 * const releaseCategoryAnalysis = {
 *   siteInformation: {
 *     isBounding: false,
 *     siteReference: "SITE-001"
 *   },
 *   meteorologicalDataAssumptionsForBoundingSite: [],
 *   releaseCategoryInputs: [
 *     {
 *       releaseCategory: "RCAT-001",
 *       releaseCharacteristics: { ... }
 *     }
 *   ],
 *   releaseCategoryAndSourceTermReviewed: true,
 *   selectedConsequenceMeasures: ["Individual Early Fatality Risk", "Population Latent Cancer Risk"],
 *   releaseCategoryLinkageDocumentation: "See Event Sequence Analysis documentation for details."
 * };
 * ```
 * @group Release Category Analysis
 */
export interface ReleaseCategoryToConsequenceAnalysis {
  /**
   * Identification of the specific site or description of the bounding site used.
   * Required by **RCRE-A1**.
   * @remarks **RCRE-A1**
   */
  siteInformation:
    | {
        isBounding: false;
        siteReference: SiteReference;
      }
    | {
        isBounding: true;
        boundingSite: BoundingSite;
      };

  /**
   * Assumptions made due to the lack of site details related to meteorological data for bounding site PRAs.
   * Required by **RCME-A11** (within the scope of RCRE).
   * @example ["Assumption: Generic flat terrain meteorological data is conservative."]
   */
  meteorologicalDataAssumptionsForBoundingSite?: string[];

  /**
   * Inputs required for the off-site Radiological Consequence Analysis methodology for each release category.
   * Includes characteristics like number of plumes, radionuclide release quantities, isotopes, timing, energy, height, particle size, and uncertainties.
   * Derived from **RCRE-A2** and informed by **ES-C1** and **HLR-MS-A** (**RCRE-A3**).
   * @remarks **RCRE-A2**
   */
  releaseCategoryInputs: ReleaseCategoryInputs[];

  /**
   * Indicates that the release category definitions (ES-C1) and mechanistic source term parameters (HLR-MS-A) were reviewed for the identification of inputs.
   * @example true
   * @remarks **RCRE-A3**
   */
  releaseCategoryAndSourceTermReviewed: boolean;

  /**
   * Consequence measure(s) selected for the intended application of the PRA as per RI-A1.
   * @example ["Individual Early Fatality Risk", "Population Latent Cancer Risk"]
   * @remarks **RCRE-B1**
   */
  selectedConsequenceMeasures: string[];

  /**
   * Documents the linkage between modeled plant operating states, initiating events, and event sequences leading to defined release categories.
   * @example "Refer to the Event Sequence Analysis documentation for the mapping of event sequences to release categories."
   * @remarks **RCRE-C1**
   */
  releaseCategoryLinkageDocumentation?: string;

  /**
   * Mapping between release categories and risk metrics used in risk integration.
   * This provides a direct link between radiological consequence analysis and risk integration.
   */
  riskMetricMapping?: {
    /**
     * Reference to the release category
     */
    releaseCategory: ReleaseCategoryReference;

    /**
     * Corresponding risk metrics in risk integration
     */
    riskMetrics: {
      /**
       * Risk metric type from risk integration
       */
      riskMetric: RiskMetricType | string;

      /**
       * Description of how the release category contributes to this risk metric
       */
      contributionDescription: string;

      /**
       * Significance of this release category to the risk metric
       */
      significance?: ImportanceLevel;
    }[];
  }[];

  /**
   * Risk significance criteria used to evaluate release categories.
   * This provides information on how release categories are evaluated in terms of risk significance.
   */
  riskSignificanceCriteria?: {
    /**
     * Type of risk significance criteria
     */
    criteriaType: RiskSignificanceCriteriaType | string;

    /**
     * Description of the criteria
     */
    description: string;

    /**
     * Threshold values for different significance levels
     */
    thresholds?: {
      /**
       * Significance level
       */
      level: ImportanceLevel;

      /**
       * Threshold value
       */
      value: number;

      /**
       * Units of the threshold value
       */
      units?: string;
    }[];
  }[];

  /**
   * Feedback from risk integration related to release categories.
   * This field contains feedback from risk integration that should be considered
   * in future revisions of the radiological consequence analysis.
   */
  riskIntegrationFeedback?: {
    /** ID of the risk integration analysis that provided the feedback */
    analysisId: string;

    /** Date the feedback was received */
    feedbackDate?: string;

    /** Feedback on specific release categories */
    releaseCategoryFeedback?: {
      /** Release category */
      releaseCategory: ReleaseCategoryReference;

      /** Risk significance level determined by risk integration */
      riskSignificance?: ImportanceLevel;

      /** Insights from risk integration */
      insights?: string[];

      /** Recommendations for improving the analysis of this release category */
      recommendations?: string[];
    }[];

    /** General feedback on the release category analysis */
    generalFeedback?: string;

    /** Response to the feedback */
    response?: {
      /** Description of how the feedback was or will be addressed */
      description: string;

      /** Changes made or planned in response to the feedback */
      changes?: string[];

      /** Status of the response */
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    };
  };
}

//==============================================================================
/**
 * @group Atmospheric Dispersion Analysis
 * @description Models and analysis of radioactive material transport through the atmosphere
 * @implements RCAD-A1, RCAD-A2, RCAD-A4, RCAD-A7, RCAD-A8, RCAD-C6, RCAD-D4, RCAD-E7, RCAD-F3
 */
//==============================================================================

/**
 * Represents the analysis of atmospheric transport and dispersion of radioactive materials.
 * @remarks **RCAD-A1**
 * @remarks **RCAD-A2**
 * @example
 * ```typescript
 * const atmosphericAnalysis = {
 *   dispersionModel: "Gaussian Plume Model (e.g., AERMOD)",
 *   dispersionModelJustification: "AERMOD is suitable for near-field dispersion and can incorporate building downwash effects.",
 *   plumeRiseConsideration: "Plume rise was considered for high-energy releases using Briggs' equations.",
 *   buildingWakeEffectsConsideration: "Building wake effects were modelled using the PRIME algorithm within AERMOD.",
 *   terrainEffectsConsideration: "Terrain effects were addressed using the terrain preprocessor within AERMOD.",
 *   dispersionUncertainty: {
 *     sources: ["Wind direction variability", "Atmospheric stability classification"],
 *     assumptions: ["Neutral stability conditions are representative for the site"],
 *     alternatives: ["Lagrangian particle dispersion model for complex terrain"]
 *   },
 *   siteCharacteristicsConsidered: "Topographical data was used to adjust plume trajectories and dispersion coefficients.",
 *   meteorologicalDataSpecification: "Five years of hourly meteorological data were used.",
 *   receptorLocationsSpecification: "A polar grid extending to 50 miles with finer resolution near the site boundary.",
 *   uncertaintyAnalysisDescription: "Monte Carlo simulation was used to propagate meteorological uncertainties.",
 *   supportingDocumentationReferences: ["Appendix C of the main report", "Atmospheric Dispersion Model Validation Report"],
 *   modelLimitations: "The Gaussian plume model assumes flat terrain and may have limitations in complex terrain scenarios."
 * };
 * ```
 * @group Atmospheric Dispersion Analysis
 */
export interface AtmosphericDispersionAnalysis {
  /**
   * The selected atmospheric dispersion model(s).
   * Required by **RCAD-A2**.
   * @example "Gaussian Plume Model (e.g., AERMOD)"
   * @remarks **RCAD-A1**
   */
  dispersionModel: string;

  /**
   * Justification for the appropriateness of the selected dispersion model(s) for the source term and meteorological conditions.
   * Required by **RCAD-A2** (implicitly).
   * @example "AERMOD is suitable for near-field dispersion and can incorporate building downwash effects."
   * @remarks **RCAD-C6**
   */
  dispersionModelJustification: string;

  /**
   * Considerations for plume rise due to thermal buoyancy and/or momentum effects.
   * Relevant to **RCAD-A4**.
   * @example "Plume rise was considered for high-energy releases using Briggs' equations." | "Plume rise is negligible for the modelled releases."
   * @remarks **RCAD-A7**
   */
  plumeRiseConsideration?: string;

  /**
   * Considerations for building wake effects on plume dispersion.
   * Relevant to **RCAD-A7**.
   * @example "Building wake effects were modelled using the PRIME algorithm within AERMOD." | "Building wake effects are not significant due to release location."
   */
  buildingWakeEffectsConsideration?: string;

  /**
   * Considerations for the effects of complex terrain on plume transport and dispersion.
   * Relevant to **RCAD-A8**.
   * @example "Terrain effects were addressed using the terrain preprocessor within AERMOD." | "The site has relatively flat terrain, and these effects are minimal."
   */
  terrainEffectsConsideration?: string;

  /**
   * Sources of model uncertainty, related assumptions, and reasonable alternatives for atmospheric dispersion.
   * Required by **RCAD-C6**.
   */
  dispersionUncertainty: {
    sources: string[];
    assumptions: string[];
    alternatives: string[];
  };

  /**
   * Describes how site-specific characteristics (e.g., topography, nearby structures) are considered in the atmospheric dispersion analysis.
   * @example "Topographical data was used to adjust plume trajectories and dispersion coefficients. Building wake effects were modeled for releases near plant structures."
   * @remarks **RCAD-A2**
   */
  siteCharacteristicsConsidered?: string;

  /**
   * Specifies the meteorological data used for the atmospheric dispersion calculations.
   * @example "Refer to the Meteorological Data sub-element for details on the meteorological data used."
   * @remarks **RCAD-A4**
   */
  meteorologicalDataSpecification?: string;

  /**
   * Specifies the grid or receptor locations used for calculating off-site concentrations and deposition.
   * @example "A polar grid extending to 50 miles with finer resolution near the site boundary."
   * @remarks **RCAD-A8**
   */
  receptorLocationsSpecification?: string;

  /**
   * Describes the uncertainty analysis performed for the atmospheric transport and dispersion calculations.
   * @example "Uncertainty in meteorological parameters (wind speed, stability class) was propagated through the dispersion model using Monte Carlo simulation."
   * @remarks **RCAD-D4**
   */
  uncertaintyAnalysisDescription?: string;

  /**
   * References to documentation of the input data, models, and results of the atmospheric transport and dispersion analysis.
   * @example ["Appendix C of the main report", "Atmospheric Dispersion Model Validation Report"]
   * @remarks **RCAD-E7**
   */
  supportingDocumentationReferences?: string[];

  /**
   * Addresses any limitations of the atmospheric dispersion models used.
   * @example "The Gaussian plume model assumes flat terrain and may have limitations in complex terrain scenarios."
   * @remarks **RCAD-F3**
   */
  modelLimitations?: string;

  /**
   * Description of deposition modeling for radionuclide particles.
   * Required by **HLR-RCAD-E**.
   * @example "Dry and wet deposition were modeled using deposition velocities and washout coefficients."
   */
  depositionModeling?: string;

  /**
   * Dry deposition parameters.
   */
  dryDepositionParameters?: {
    depositionVelocities?: Record<string, number>;
    particleSizeDistribution?: string;
  };

  /**
   * Wet deposition parameters.
   */
  wetDepositionParameters?: {
    washoutCoefficients?: Record<string, number>;
    precipitationData?: string;
  };
}

//==============================================================================
/**
 * @group Protective Action Analysis
 * @description Analysis of emergency response and protective actions
 * @implements RCPA-A1, RCPA-A2, RCPA-A3, RCPA-A4, RCPA-A5
 */
//==============================================================================

/**
 * Represents the analysis of protective actions and other site data.
 * @remarks **RCPA-A1**
 * @remarks **RCPA-A2**
 * @example
 * ```typescript
 * const protectiveActionAnalysis = {
 *   protectiveActionParameters: {
 *     evacuationDelay: "2 hours",
 *     evacuationSpeed: "10 mph",
 *     shelteringEffectiveness: "50% reduction in dose"
 *   },
 *   populationDistribution: "Population data from the 2020 census was used, with a 10-mile radius divided into 16 sectors.",
 *   landUseCharacteristics: "Agricultural land use data was incorporated for ingestion pathway analysis.",
 *   emergencyResponseTimingBases: "Evacuation timing was based on the site emergency plan and local emergency response capabilities.",
 *   protectiveActionUncertainty: {
 *     sources: ["Evacuation timing", "Sheltering effectiveness"],
 *     assumptions: ["100% compliance with evacuation orders"],
 *     alternatives: ["Partial evacuation scenarios"]
 *   }
 * };
 * ```
 * @group Protective Action Analysis
 */
export interface ProtectiveActionAnalysis {
  /**
   * Protective action parameters used in the analysis.
   * Required by **RCPA-A1**.
   * @example { evacuationDelay: "2 hours", evacuationSpeed: "10 mph" }
   * @remarks **RCPA-A1**
   */
  protectiveActionParameters: {
    evacuationDelay?: string;
    evacuationSpeed?: string;
    shelteringEffectiveness?: string;
    [key: string]: string | undefined;
  };

  /**
   * Description of the population distribution around the site.
   * Required by **RCPA-A2**.
   * @example "Population data from the 2020 census was used, with a 10-mile radius divided into 16 sectors."
   * @remarks **RCPA-A2**
   */
  populationDistribution: string;

  /**
   * Description of the land use characteristics around the site.
   * Required by **RCPA-A3**.
   * @example "Agricultural land use data was incorporated for ingestion pathway analysis."
   * @remarks **RCPA-A3**
   */
  landUseCharacteristics: string;

  /**
   * Bases for emergency response timing assumptions.
   * Required by **RCPA-A4**.
   * @example "Evacuation timing was based on the site emergency plan and local emergency response capabilities."
   * @remarks **RCPA-A4**
   */
  emergencyResponseTimingBases: string;

  /**
   * Sources of model uncertainty, related assumptions, and reasonable alternatives for protective actions.
   * Required by **RCPA-A5**.
   * @remarks **RCPA-A5**
   */
  protectiveActionUncertainty: {
    sources: string[];
    assumptions: string[];
    alternatives: string[];
  };

  /**
   * Bounding assumptions for protective action warning time.
   * Required by **RCRE-A2(e)**.
   * @example "A minimum warning time of 30 minutes was assumed, which bounds the expected warning times for all potential sites."
   */
  boundingWarningTimeAssumption?: string;

  /**
   * Hazards that could impact the implementation of protective actions.
   * Required by **RCRE-A2(e)**.
   * @example "Severe weather conditions and potential road congestion were considered as bounding hazards that could delay evacuation."
   */
  protectiveActionImpactingHazards?: string;

  /**
   * Justification for population distribution assumptions as bounding for the analysis.
   * Required by **RCPA-B1**.
   * @example "A high-density population distribution based on the 95th percentile of U.S. nuclear plant sites was used, which bounds the population exposure for all potential sites."
   */
  populationDistributionJustification?: string;

  /**
   * Impact of protective actions on risk metrics.
   * This field describes how protective actions affect the risk metrics used in risk integration.
   */
  riskMetricImpact?: {
    /**
     * Risk metric affected by protective actions
     */
    riskMetric: RiskMetricType | string;

    /**
     * Description of how protective actions impact this risk metric
     */
    impactDescription: string;

    /**
     * Quantitative assessment of the impact, if available
     */
    quantitativeAssessment?: string;

    /**
     * Uncertainty in the impact assessment
     */
    uncertaintyDescription?: string;
  }[];

  /**
   * Sensitivity of risk metrics to protective action parameters.
   * This field describes how sensitive risk metrics are to changes in protective action parameters.
   */
  riskMetricSensitivity?: {
    /**
     * Protective action parameter
     */
    parameter: string;

    /**
     * Risk metrics affected by this parameter
     */
    affectedRiskMetrics: (RiskMetricType | string)[];

    /**
     * Description of the sensitivity
     */
    sensitivityDescription: string;

    /**
     * Importance level of this parameter to risk
     */
    importance?: ImportanceLevel;
  }[];

  /**
   * Feedback from risk integration related to protective actions.
   * This field contains feedback from risk integration that should be considered
   * in future revisions of the protective action analysis.
   */
  riskIntegrationFeedback?: {
    /** ID of the risk integration analysis that provided the feedback */
    analysisId: string;

    /** Date the feedback was received */
    feedbackDate?: string;

    /** Feedback on specific protective action parameters */
    parameterFeedback?: {
      /** Parameter name */
      parameter: string;

      /** Risk significance level determined by risk integration */
      riskSignificance?: ImportanceLevel;

      /** Insights from risk integration */
      insights?: string[];

      /** Recommendations for improving the parameter */
      recommendations?: string[];
    }[];

    /** General feedback on the protective action analysis */
    generalFeedback?: string;

    /** Response to the feedback */
    response?: {
      /** Description of how the feedback was or will be addressed */
      description: string;

      /** Changes made or planned in response to the feedback */
      changes?: string[];

      /** Status of the response */
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    };
  };
}

/**
 * JSON schema for validating {@link RadiologicalConsequenceAnalysis} entities.
 * @example
 * ```typescript
 * const rcAnalysis: RadiologicalConsequenceAnalysis = {
 *   // TechnicalElement properties
 *   "technical-element-type": TechnicalElementTypes.CONSEQUENCE_ANALYSIS,
 *   "technical-element-code": "RC",
 *   metadata: {
 *     version: "1.0",
 *     analysis_date: "2024-03-15",
 *     analyst: "Jane Smith",
 *     scopeDefinition: {
 *       isSpecificSite: true,
 *       siteReference: "SITE-001",
 *       consequenceMetrics: ["Individual Early Fatality Risk", "Population Latent Cancer Risk"],
 *       protectiveActionsModellingDegree: "Detailed modelling based on site-specific emergency plans.",
 *       meteorologyModellingDegree: "Site-specific meteorological data used.",
 *       atmosphericDispersionModellingDegree: "Complex Gaussian plume model with terrain effects.",
 *       dosimetryModellingDegree: "Detailed organ dose calculations for multiple exposure pathways.",
 *       healthEffectsModellingDegree: "Probabilistic modelling of early and latent health effects.",
 *       economicFactorsModellingDegree: "Comprehensive assessment of off-site economic impacts."
 *     }
 *   },
 *   releaseCategoryToConsequence: {
 *     siteInformation: {
 *       isBounding: false,
 *       siteReference: "SITE-001"
 *     },
 *     releaseCategoryInputs: [
 *       {
 *         releaseCategory: "RCAT-001",
 *         releaseCharacteristics: {
 *           numberOfPlumes: 1,
 *           radionuclideGroupFractions: { NobleGases: 1.0, Iodines: 0.5 },
 *           importantRadionuclides: ["I-131", "Cs-137"],
 *           releaseTiming: "0 hour",
 *           releaseDuration: "2 hours",
 *           warningTime: 0.5,
 *           warningTimeDescription: "0.5 hours",
 *           releaseEnergy: 1.0e9,
 *           releaseEnergyDescription: "High",
 *           releaseHeight: 30,
 *           releaseHeightDescription: "Elevated",
 *           releasedParticleSize: 1.0,
 *           releasedParticleSizeDescription: "Aerosol",
 *           releaseUncertainties: "Uncertainty in release fraction for volatile isotopes."
 *         }
 *       }
 *     ],
 *     releaseCategoryAndSourceTermReviewed: true,
 *     selectedConsequenceMeasures: ["Individual Early Fatality Risk", "Population Latent Cancer Risk"],
 *     releaseCategoryLinkageDocumentation: "See Event Sequence Analysis documentation for details."
 *   },
 *   atmosphericTransportAndDispersion: {
 *     dispersionModel: "Gaussian Plume Model (e.g., AERMOD)",
 *     dispersionModelJustification: "AERMOD is suitable for near-field dispersion and can incorporate building downwash effects.",
 *     plumeRiseConsideration: "Plume rise was considered for high-energy releases using Briggs' equations.",
 *     buildingWakeEffectsConsideration: "Building wake effects were modelled using the PRIME algorithm within AERMOD.",
 *     terrainEffectsConsideration: "Terrain effects were addressed using the terrain preprocessor within AERMOD.",
 *     dispersionUncertainty: {
 *       sources: ["Wind direction variability", "Atmospheric stability classification"],
 *       assumptions: ["Neutral stability conditions are representative for the site"],
 *       alternatives: ["Lagrangian particle dispersion model for complex terrain"]
 *     },
 *     siteCharacteristicsConsidered: "Topographical data was used to adjust plume trajectories and dispersion coefficients.",
 *     meteorologicalDataSpecification: "Five years of hourly meteorological data were used.",
 *     receptorLocationsSpecification: "A polar grid extending to 50 miles with finer resolution near the site boundary.",
 *     uncertaintyAnalysisDescription: "Monte Carlo simulation was used to propagate meteorological uncertainties.",
 *     supportingDocumentationReferences: ["Appendix C of the main report", "Atmospheric Dispersion Model Validation Report"],
 *     modelLimitations: "The Gaussian plume model assumes flat terrain and may have limitations in complex terrain scenarios.",
 *     depositionModeling: "Dry and wet deposition were modeled using deposition velocities and washout coefficients.",
 *     dryDepositionParameters: {
 *       depositionVelocities: { "I-131": 0.01, "Cs-137": 0.005 },
 *       particleSizeDistribution: "AMAD of 1 μm assumed for all particulates"
 *     },
 *     wetDepositionParameters: {
 *       washoutCoefficients: { "I-131": 1.0e-4, "Cs-137": 5.0e-5 },
 *       precipitationData: "Historical precipitation data from site meteorological station"
 *     }
 *   },
 *   dosimetry: {
 *     exposurePathways: ["Inhalation", "Ground Shine", "Cloud Submersion"],
 *     dcfSource: "ICRP Publication 72",
 *     shieldingConsiderations: "Shielding factors for residential areas were based on typical building attenuation.",
 *     occupancyConsiderations: "Time-dependent occupancy factors were used for different land use types.",
 *     dcfUncertainty: {
 *       sources: ["Age-dependent variability", "Biokinetic model parameters"],
 *       assumptions: ["Adult dose coefficients are used for the entire population"],
 *       alternatives: ["Age-specific dose coefficients for different population groups"]
 *     },
 *     dcfParameterUncertaintyCharacterisation: "Log-normal distributions were assumed for DCF parameter uncertainties.",
 *     receptorTypes: ["Adult", "Child (1 year)", "Infant (3 months)"],
 *     dosimetryModelsUsed: "Dose calculations were performed using the EPA Federal Guidance Report No. 11 and 12 methodologies.",
 *     doseAggregationMethod: "Organ doses were calculated for key organs, and effective dose was determined using ICRP Publication 103 weighting factors.",
 *     radionuclideDecayConsideration: "Radionuclide decay was accounted for during atmospheric transport and dose calculations using half-life data.",
 *     doseIntegrationPeriods: ["7-day thyroid dose", "50-year committed effective dose"]
 *   },
 *   consequenceQuantification: {
 *     selectedMetrics: ["Early Fatalities", "Latent Cancer Fatalities", "Maximum Off-site Dose"],
 *     consequenceCodesUsed: ["MACCS2 code version 1.13"],
 *     modelAndCodeLimitations: [
 *       { code: "MACCS2", feature: "Gaussian plume model", limitation: "Assumes flat terrain; not accurate in complex terrain.", justification: "Site is relatively flat" },
 *       { feature: "Straight-line trajectory", limitation: "Does not account for wind meander over long distances." }
 *     ],
 *     eventSequenceConsequences: [
 *       {
 *         eventSequenceFamily: "ESF-001",
 *         consequences: { "Early Fatalities": 0.1, "Latent Cancer Fatalities": 5.0 },
 *         consequenceMetric: "Early Fatality Risk (site boundary)",
 *         meanValue: 1.2e-7,
 *         uncertainty: "Log-normal distribution with GSD = 3.0"
 *       }
 *     ],
 *     uncertaintyCharacterization: "Uncertainty in meteorological conditions, source term magnitude, and dose coefficients were propagated.",
 *     supportingDocumentationReferences: ["Section 5 of the main report", "Appendix B: Consequence Code Validation"],
 *     healthEffectsConsidered: {
 *       earlyEffects: ["Acute radiation syndrome", "Thyroid effects"],
 *       latentEffects: ["Cancer", "Hereditary effects"],
 *       doseResponseApproach: "Linear no-threshold model for cancer effects"
 *     },
 *     economicFactorsConsidered: {
 *       costCategories: ["Evacuation costs", "Decontamination costs", "Health care costs"],
 *       valuationApproach: "Present value calculation with 3% discount rate",
 *       timeHorizon: "50 years"
 *     }
 *   },
 *   protectiveActionParameters: {
 *     protectiveActionParameters: {
 *       evacuationDelay: "2 hours",
 *       evacuationSpeed: "10 mph",
 *       shelteringEffectiveness: "50% reduction in dose"
 *     },
 *     populationDistribution: "Population data from the 2020 census was used, with a 10-mile radius divided into 16 sectors.",
 *     landUseCharacteristics: "Agricultural land use data was incorporated for ingestion pathway analysis.",
 *     emergencyResponseTimingBases: "Evacuation timing was based on the site emergency plan and local emergency response capabilities.",
 *     protectiveActionUncertainty: {
 *       sources: ["Evacuation timing", "Sheltering effectiveness"],
 *       assumptions: ["100% compliance with evacuation orders"],
 *       alternatives: ["Partial evacuation scenarios"]
 *     },
 *     boundingWarningTimeAssumption: "A minimum warning time of 30 minutes was assumed, which bounds the expected warning times for all potential sites.",
 *     protectiveActionImpactingHazards: "Severe weather conditions and potential road congestion were considered as bounding hazards that could delay evacuation.",
 *     populationDistributionJustification: "A high-density population distribution based on the 95th percentile of U.S. nuclear plant sites was used, which bounds the population exposure for all potential sites."
 *   },
 *   meteorologicalData: {
 *     parameterUncertaintyCharacterisation: "Uncertainty in wind speed and direction modelled using historical data distributions.",
 *     meteorologicalDataSetDescription: "Five years of hourly meteorological data from the on-site tower were used.",
 *     meteorologicalFrequencyDistributionTreatment: "A stratified random sampling approach was used to select representative weather sequences.",
 *     temporalChangesAccommodation: "Hourly meteorological data was used to capture diurnal variations in wind patterns.",
 *     timeResolution: "Hourly"
 *   },
 *   documentation: {
 *     uuid: "rcd-001",
 *     name: "Radiological Consequence Analysis Documentation",
 *     processDescription: "This analysis followed the standard methodology for radiological consequence assessment.",
 *     inputsDescription: "Source term data and site-specific meteorological information were used as primary inputs.",
 *     methodsDescription: "Standard dispersion and dosimetry models were applied following regulatory guidance.",
 *     resultsDescription: "Analysis shows that all release categories meet safety criteria with sufficient margin.",
 *     inputSources: ["Source term data from Mechanistic Source Term Analysis", "Site meteorological data"],
 *     appliedMethods: ["Gaussian plume dispersion modeling", "ICRP dosimetry methods"],
 *     resultsSummary: "Results indicate that all release categories meet the safety criteria.",
 *     peerReview: {
 *       uuid: "pr-001",
 *       name: "Radiological Consequence Analysis Peer Review",
 *       reviewDate: "2023-06-15",
 *       reviewers: ["Dr. Jane Smith", "Dr. John Doe"],
 *       findingsAndObservations: [
 *         {
 *           id: "FIND-001",
 *           description: "Uncertainty analysis for evacuation timing needs improvement",
 *           significance: "MEDIUM",
 *           resolutionStatus: "OPEN",
 *           resolutionActions: ["Additional sensitivity studies will be performed"]
 *         }
 *       ],
 *       scope: "Complete radiological consequence analysis methodology and results",
 *       methodology: "Independent expert review following NRC guidance"
 *     },
 *     uncertaintiesAndAssumptions: [
 *       "Assumption: Population distribution is based on 2020 census data.",
 *       "Uncertainty: Evacuation timing has a significant impact on early health effects."
 *     ],
 *     sensitivityStudies: [
 *       {
 *         uuid: "sens-001",
 *         description: "Sensitivity to meteorological conditions",
 *         variedParameters: ["Wind speed", "Stability class"],
 *         parameterRanges: { "Wind speed": [1, 10], "Stability class": [1, 6] },
 *         results: "Results are most sensitive to stability class during the release.",
 *         insights: "Stability class has a greater impact than wind speed on dose predictions",
 *         impact: "Moderate impact on overall risk metrics"
 *       }
 *     ],
 *     modelUncertaintyDocumentation: {
 *       uuid: "mud-001",
 *       name: "Radiological Consequence Model Uncertainty Documentation",
 *       uncertaintySources: [
 *         {
 *           source: "Atmospheric dispersion model simplifications",
 *           impact: "May underestimate dispersion in complex terrain"
 *         }
 *       ],
 *       relatedAssumptions: [
 *         {
 *           assumption: "Straight-line Gaussian plume is adequate for the site terrain",
 *           basis: "Site has relatively flat terrain within 10 miles"
 *         }
 *       ],
 *       reasonableAlternatives: [
 *         {
 *           alternative: "Lagrangian particle dispersion model",
 *           reasonNotSelected: "Computational complexity not justified by site characteristics"
 *         }
 *       ]
 *     },
 *     assumptions: [
 *       {
 *         uuid: "assum-001",
 *         description: "Population remains constant over the analysis period",
 *         impact: "May underestimate long-term consequences if population grows",
 *         rationale: "Conservative for near-term consequences which dominate risk metrics"
 *       }
 *     ],
 *     requirementTraceability: [
 *       {
 *         requirementId: "RCAD-A1",
 *         standardReference: "NRC RG 1.247",
 *         implementation: "Gaussian plume model selected and justified in Section 3.2"
 *       }
 *     ],
 *     riskIntegrationDocumentation: {
 *       integrationProcessDescription: "Integration process description",
 *       consequenceMetricUsage: [
 *         {
 *           metricName: "Individual Early Fatality Risk",
 *           correspondingRiskMetric: "Risk Metric 1",
 *           usageDescription: "Usage description for Individual Early Fatality Risk"
 *         },
 *         {
 *           metricName: "Population Latent Cancer Risk",
 *           correspondingRiskMetric: "Risk Metric 2",
 *           usageDescription: "Usage description for Population Latent Cancer Risk"
 *         }
 *       ],
 *       uncertaintyPropagation: "Uncertainty propagation description",
 *       integrationChallenges: ["Challenge 1", "Challenge 2"],
 *       inconsistencyResolution: "Inconsistency resolution description",
 *       feedbackReceived: [
 *         {
 *           source: "Risk Integration Analysis",
 *           date: "2024-03-15",
 *           description: "Feedback description from Risk Integration Analysis",
 *           significance: "HIGH"
 *         }
 *       ],
 *       feedbackIncorporation: [
 *         {
 *           feedbackReference: "Feedback Reference 1",
 *           incorporationDescription: "Feedback incorporation description 1",
 *           status: "COMPLETED",
 *           date: "2024-03-15"
 *         },
 *         {
 *           feedbackReference: "Feedback Reference 2",
 *           incorporationDescription: "Feedback incorporation description 2",
 *           status: "IN_PROGRESS",
 *           date: "2024-03-16"
 *         }
 *       ],
 *       keyInsights: ["Insight 1", "Insight 2"],
 *       riskIntegrationReferences: [
 *         {
 *           analysisId: "RI-001",
 *           version: "1.0",
 *           date: "2024-03-15",
 *           usageDescription: "Usage description for RI-001"
 *         }
 *       ]
 *     }
 *   }
 * };
 *
 * const schema = RadiologicalConsequenceAnalysisSchema;
 * const validationResult = schema.validateSync(rcAnalysis);
 * if (validationResult.errors) {
 *   console.error("Validation errors:", validationResult.errors);
 * } else {
 *   console.log("Radiological Consequence Analysis data is valid.");
 * }
 * ```
 * @group API
 */
export const RadiologicalConsequenceAnalysisSchema =
  typia.json.schemas<[RadiologicalConsequenceAnalysis]>();
