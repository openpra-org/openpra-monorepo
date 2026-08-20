import { z } from "zod";
import type { RadiologicalConsequenceAnalysis } from "../../rc/radiological-consequence-analysis";
import { TechnicalElementTypes } from "../../technical-element";
import { technicalElementSchema } from "../technical-element";
import { ParameterDistributionSchema } from "../core/events";
import { ImportanceLevelSchema, SensitivityStudySchema } from "../core/shared-patterns";
import { BaseModelUncertaintyDocumentationSchema, PreOperationalAssumptionSchema } from "../core/documentation";
import { SRReferenceSchema } from "../core/pra-common";

export const RcSubElementSchema = z.enum(["RCRE", "RCPA", "RCME", "RCAD", "RCDO", "RCHE", "RCEC", "RCQ"]);

export const ModelUncertaintyIdentificationSchema = z.object({
  sources: z.array(z.string()),
  assumptions: z.array(z.string()),
  alternatives: z.array(z.string()),
});

export const BoundingSiteSchema = z.object({
  description: z.string(),
  characteristics: z.object({
    siteBoundaryDistance: z.number().optional(),
    populationCentreDistance: z.number().optional(),
    terrain: z.string().optional(),
    additionalCharacteristics: z
      .array(
        z.object({
          name: z.string(),
          value: z.string(),
        }),
      )
      .optional(),
  }),
  boundingJustification: z.string(),
  boundedSites: z.array(z.string()).optional(),
});

export const ReleaseCharacteristicsSchema = z.object({
  numberOfPlumes: z.number().optional(),
  radionuclideGroupFractions: z
    .array(
      z.object({
        group: z.string(),
        fraction: z.number(),
      }),
    )
    .optional(),
  importantRadionuclides: z.array(z.string()).optional(),
  importantRadionuclidesJustification: z.string().optional(),
  releasePhaseTimings: z
    .array(
      z.object({
        startTime: z.number(),
        duration: z.number(),
        timeUnit: z.string().optional(),
      }),
    )
    .optional(),
  warningTime: z.number().optional(),
  warningTimeDescription: z.string().optional(),
  hazardsImpactingProtectiveActions: z.string().optional(),
  releaseEnergy: z.number().optional(),
  releaseEnergyDescription: z.string().optional(),
  releaseHeight: z.number().optional(),
  releaseHeightDescription: z.string().optional(),
  releasedParticleSize: z.number().optional(),
  releasedParticleSizeDescription: z.string().optional(),
  releaseUncertainties: z.string().optional(),
});

export const ReleaseCategoryInputsSchema = z.object({
  releaseCategory: z.string(),
  sourceTermDefinitionRef: z.string().optional(),
  releaseCharacteristics: ReleaseCharacteristicsSchema,
});

export const RcScopeSchema = z.object({
  consequenceMetrics: z.array(z.string()),
  metricSelectionApplicationBasis: z.string().optional(),
  protectiveActionsModellingDegree: z.string(),
  meteorologyModellingDegree: z.string(),
  atmosphericDispersionModellingDegree: z.string(),
  dosimetryModellingDegree: z.string(),
  healthEffectsModellingDegree: z.string(),
  economicFactorsModellingDegree: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ReleaseCategoryToConsequenceAnalysisSchema = z.object({
  siteInformation: z.union([
    z.object({
      isBounding: z.literal(false),
      siteReference: z.string(),
    }),
    z.object({
      isBounding: z.literal(true),
      boundingSite: BoundingSiteSchema,
    }),
  ]),
  releaseCategoryInputs: z.array(ReleaseCategoryInputsSchema),
  releaseCategoryAndSourceTermReviewed: z.boolean(),
  reviewBasis: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ProtectiveActionAnalysisSchema = z.object({
  protectiveActionsIncluded: z.array(
    z.object({
      action: z.enum(["EVACUATION", "SHELTERING", "RELOCATION", "LAND_INTERDICTION_REMEDIATION", "FOOD_INTERDICTION_REMEDIATION"]),
      included: z.boolean(),
      applicabilityJustification: z.string().optional(),
    }),
  ),
  incidentPhasesModeled: z.array(
    z.object({
      phase: z.enum(["EARLY", "INTERMEDIATE", "LATE_LONG_TERM"]),
      criteriaDescription: z.string(),
    }),
  ),
  sourceDocuments: z.array(
    z.object({
      document: z.string(),
      usage: z.string(),
      justification: z.string().optional(),
    }),
  ),
  cohortModeling: z.object({
    approach: z.enum(["SINGLE_COHORT", "MULTIPLE_COHORTS"]),
    cohorts: z
      .array(
        z.object({
          name: z.string(),
          description: z.string(),
          complianceAssumption: z.string().optional(),
        }),
      )
      .optional(),
  }),
  complianceAssumptions: z.array(
    z.object({
      description: z.string(),
      basis: z.string(),
    }),
  ),
  shelterInPlaceCredit: z
    .object({
      credited: z.boolean(),
      justification: z.string().optional(),
    })
    .optional(),
  protectionParameters: z
    .array(
      z.object({
        parameter: z.string(),
        value: z.string(),
        source: z.string(),
      }),
    )
    .optional(),
  evacuationModeling: z
    .object({
      approach: z.string(),
      description: z.string().optional(),
    })
    .optional(),
  evacuationDelayComponents: z
    .array(
      z.object({
        component: z.enum([
          "GENERAL_EMERGENCY_DECLARATION",
          "SITE_NOTIFIES_OFFICIALS",
          "OFFICIALS_NOTIFY_PUBLIC",
          "PUBLIC_RECEIVES_INSTRUCTIONS",
          "SECURE_PERSONAL_PROPERTY",
          "LOAD_VEHICLES",
        ]),
        estimate: z.string(),
      }),
    )
    .optional(),
  evacuationSpeed: z
    .object({
      basis: z.string(),
      daytimeNighttimeConsidered: z.boolean(),
      adverseWeatherConsidered: z.boolean(),
      specialEventsConsidered: z.boolean(),
      transientPopulationsConsidered: z.boolean(),
    })
    .optional(),
  hazardGroupAdjustments: z
    .array(
      z.object({
        hazardGroup: z.string(),
        adjustmentDescription: z.string(),
      }),
    )
    .optional(),
  populationDistribution: z.object({
    basis: z.enum(["ASSUMED_JUSTIFIED", "DEMOGRAPHIC_SOURCES"]),
    description: z.string(),
    justification: z.string().optional(),
    transientPopulationsIncluded: z.boolean().optional(),
    projectionAdjustments: z.string().optional(),
  }),
  landUseData: z.object({
    basis: z.enum(["GENERIC_SIMPLIFIED", "REGIONAL_SPECIFIC"]),
    description: z.string(),
    intraRegionalAdjustments: z.string().optional(),
  }),
  plantPhysicalCharacteristics: z.object({
    basis: z.enum(["ESTIMATED", "ACTUAL"]),
    description: z.string(),
  }),
  releaseSourceGeographicLocation: z.string(),
  boundingSiteLocationJustification: z.string().optional(),
  parameterUncertaintyCharacterization: z.string().optional(),
  modelUncertainty: ModelUncertaintyIdentificationSchema,
  implementsSrs: z.array(SRReferenceSchema),
});

export const MeteorologicalDataAnalysisSchema = z.object({
  dataSource: z.string(),
  spatialRepresentativenessJustification: z.string(),
  periodSelection: z.object({
    approach: z.enum(["REPRESENTATIVE_SINGLE_YEAR", "MULTI_YEAR_EVALUATION"]),
    periodDescription: z.string(),
  }),
  dataRecovery: z.object({
    combinedRecoveryPercent: z.number().optional(),
    meetsNinetyPercent: z.boolean().optional(),
    lowRecoveryJustification: z.string().optional(),
    substitutionTechniques: z.string().optional(),
    meteorologistReview: z
      .object({
        performed: z.boolean(),
        reviewerQualification: z.string().optional(),
        considerations: z.string().optional(),
      })
      .optional(),
  }),
  instrumentationQuality: z
    .object({
      calibratedProgram: z.boolean(),
      description: z.string().optional(),
    })
    .optional(),
  extractedParameters: z.object({
    windSpeedAndDirection10m: z.boolean(),
    stabilityClassMeasurement: z.boolean(),
    precipitation: z.boolean().optional(),
  }),
  mixingHeights: z
    .object({
      scope: z.enum(["SEASONAL_AFTERNOON", "SEASONAL_MORNING_AND_AFTERNOON"]),
      source: z.string(),
    })
    .optional(),
  stabilityClassificationMethod: z.object({
    approach: z.enum(["SIMPLIFIED", "RECOGNIZED_SOURCE"]),
    description: z.string(),
  }),
  accuracyReview: z.object({
    performed: z.boolean(),
    findings: z.string().optional(),
  }),
  temporalChangesAccommodation: z.string().optional(),
  timeResolution: z.string().optional(),
  parameterUncertaintyCharacterization: z.string().optional(),
  modelUncertainty: ModelUncertaintyIdentificationSchema,
  implementsSrs: z.array(SRReferenceSchema),
});

export const AtmosphericDispersionAnalysisSchema = z.object({
  dispersionModel: z.object({
    modelClass: z.enum(["STRAIGHT_LINE_GAUSSIAN", "SEGMENTED_PLUME", "OTHER_VARIABLE_TRAJECTORY"]),
    name: z.string().optional(),
    justification: z.string(),
  }),
  temporalResolution: z.object({
    approach: z.enum(["STEADY_STATE", "HOURLY_UPDATES"]),
    description: z.string().optional(),
  }),
  spatialTreatment: z.object({
    approach: z.enum(["CENTERLINE", "TWO_DIMENSIONAL_GRID"]),
    gridDescription: z.string().optional(),
    gridJustification: z.string().optional(),
  }),
  windFieldData: z.string(),
  windRepresentativeness: z.string().optional(),
  meteorologicalDataPerRcme: z.boolean(),
  meteorologicalSampling: z.object({
    approach: z.enum(["BOUNDING_CONDITIONS", "STATISTICAL_SAMPLING"]),
    technique: z.string().optional(),
    meanShiftValidation: z
      .object({
        performed: z.boolean(),
        meanShiftPercent: z.number().optional(),
        justification: z.string().optional(),
      })
      .optional(),
  }),
  elevatedReleaseAlgorithms: z.string().optional(),
  plumeRise: z.object({
    credited: z.boolean(),
    algorithmsDescription: z.string().optional(),
  }),
  buildingWakeEffects: z.string().optional(),
  plumeSegmentation: z.object({
    approach: z.enum(["SINGLE_PLUME", "MULTIPLE_PLUMES"]),
    description: z.string().optional(),
  }),
  deposition: z.object({
    dryDeposition: z.object({
      included: z.boolean(),
      approach: z.enum(["SINGLE_VELOCITY", "PER_PARTICLE_SIZE"]).optional(),
      velocities: z
        .array(
          z.object({
            particleSize: z.string().optional(),
            velocity: z.number(),
          }),
        )
        .optional(),
    }),
    wetDeposition: z.object({
      included: z.boolean(),
      precipitationIntensityDependent: z.boolean().optional(),
      washoutCoefficients: z
        .array(
          z.object({
            condition: z.string(),
            coefficient: z.number(),
          }),
        )
        .optional(),
    }),
    sourceDepletion: z.object({
      included: z.boolean(),
      scope: z.enum(["DRY_ONLY_JUSTIFIED", "DRY_AND_WET"]).optional(),
      wetExclusionJustification: z.string().optional(),
    }),
    resuspension: z.object({
      included: z.boolean(),
      description: z.string().optional(),
    }),
  }),
  terrainEffectsConsideration: z.string().optional(),
  siteCharacteristicsConsidered: z.string().optional(),
  receptorLocationsSpecification: z.string().optional(),
  modelLimitations: z.string().optional(),
  parameterUncertaintyCharacterization: z.string().optional(),
  modelUncertainty: ModelUncertaintyIdentificationSchema,
  implementsSrs: z.array(SRReferenceSchema),
});

export const DosimetryAnalysisSchema = z.object({
  exposurePathways: z.array(
    z.object({
      pathway: z.enum(["CLOUDSHINE", "GROUNDSHINE", "SKIN_DEPOSITION", "INHALATION", "INGESTION"]),
      included: z.boolean(),
      exclusionJustification: z.string().optional(),
    }),
  ),
  dispersionResultsUsed: z.boolean(),
  exposurePeriods: z.array(
    z.object({
      period: z.string(),
      justification: z.string(),
    }),
  ),
  cloudImmersionModel: z.object({
    approach: z.enum(["SEMI_INFINITE", "FINITE_PLUME_OR_CORRECTED"]),
    description: z.string().optional(),
  }),
  groundshineIntegration: z.string().optional(),
  skinBetaTreatment: z.string().optional(),
  breathingRates: z.object({
    approach: z.enum(["GENERIC", "PER_COHORT_JUSTIFIED"]),
    description: z.string().optional(),
  }),
  ingestionTreatment: z.object({
    approach: z.enum(["EXCLUDED", "GENERIC_INTAKE"]),
    description: z.string().optional(),
  }),
  dcf: z.object({
    source: z.string(),
    type: z.enum(["EFFECTIVE", "ORGAN_SPECIFIC"]),
  }),
  shieldingConsiderations: z.string().optional(),
  occupancyConsiderations: z.string().optional(),
  receptorTypes: z.array(z.string()).optional(),
  dosimetryModelsUsed: z.string().optional(),
  doseAggregationMethod: z.string().optional(),
  radionuclideDecayConsideration: z.string().optional(),
  parameterUncertaintyCharacterization: z.string().optional(),
  modelUncertainty: ModelUncertaintyIdentificationSchema,
  implementsSrs: z.array(SRReferenceSchema),
});

export const HealthEffectsAnalysisSchema = z.object({
  earlyHealthEffects: z.array(z.string()),
  latentHealthEffects: z.array(z.string()),
  earlyEffectParameters: z.object({
    approach: z.enum(["SIMPLIFIED_ORGANS_OR_REDUCED_RADIONUCLIDES", "ORGAN_SPECIFIC_DOSE_RESPONSE"]),
    description: z.string(),
  }),
  latentEffectParameters: z.object({
    approach: z.enum(["SIMPLIFIED_TEDE_OR_REDUCED_RADIONUCLIDES", "ORGAN_SPECIFIC_FACTORS"]),
    description: z.string(),
  }),
  ageGenderHomogeneous: z.boolean(),
  riskFactorSources: z.array(
    z.object({
      source: z.string(),
      recognizedBody: z.string(),
      version: z.string().optional(),
    }),
  ),
  parameterUncertaintyCharacterization: z.string().optional(),
  modelUncertainty: ModelUncertaintyIdentificationSchema,
  implementsSrs: z.array(SRReferenceSchema),
});

export const EconomicFactorsAnalysisSchema = z.object({
  costCategories: z.array(
    z.object({
      category: z.string(),
      parameterDefinitions: z.array(z.string()),
    }),
  ),
  parameterConsistencyConfirmed: z.boolean(),
  costParameterEstimates: z.array(
    z.object({
      parameter: z.string(),
      dataBasis: z.enum(["REGIONAL_SITE_APPLICABLE", "GENERIC_JUSTIFIED"]),
      source: z.string(),
      justification: z.string().optional(),
      timeFrameAdjustment: z.string().optional(),
    }),
  ),
  parameterUncertaintyCharacterization: z.string().optional(),
  modelUncertainty: ModelUncertaintyIdentificationSchema,
  implementsSrs: z.array(SRReferenceSchema),
});

export const ConsequenceQuantificationAnalysisSchema = z.object({
  consequenceCodesUsed: z.array(
    z.object({
      code: z.string(),
      benchmarkBasis: z.string().optional(),
    }),
  ),
  modelAndCodeLimitations: z.array(
    z.object({
      code: z.string().optional(),
      feature: z.string(),
      limitation: z.string(),
      justification: z.string().optional(),
    }),
  ),
  eventSequenceConsequences: z.array(
    z.object({
      uuid: z.string().optional(),
      eventSequenceFamily: z.string(),
      releaseCategoryReference: z.string().optional(),
      sourceTermReference: z.string().optional(),
      consequenceResults: z.array(
        z.object({
          metric: z.string(),
          meanValue: z.number(),
          unit: z.string().optional(),
          uncertaintyDistribution: ParameterDistributionSchema.optional(),
          uncertaintyDescription: z.string().optional(),
        }),
      ),
      riskSignificance: ImportanceLevelSchema.optional(),
    }),
  ),
  outputReview: z.object({
    performed: z.boolean(),
    indicationsFound: z.array(z.string()).optional(),
    acceptanceJustifications: z.array(z.string()).optional(),
  }),
  resultsConfirmation: z.object({
    performed: z.boolean(),
    description: z.string().optional(),
  }),
  riskSignificantContributors: z
    .array(
      z.object({
        contributor: z.string(),
        basisPerRiB: z.string(),
        significance: ImportanceLevelSchema.optional(),
      }),
    )
    .optional(),
  riskSignificanceCriteriaUsed: z
    .array(
      z.object({
        criteriaType: z.string(),
        description: z.string(),
      }),
    )
    .optional(),
  modelUncertaintyAssessments: z.array(
    z.object({
      sourceSubElement: RcSubElementSchema,
      uncertaintySource: z.string(),
      relatedAssumptions: z.array(z.string()),
      reasonableAlternatives: z.array(z.string()).optional(),
      evaluationType: z.enum(["QUALITATIVE", "QUANTITATIVE"]),
      evaluationScope: z.enum(["INDIVIDUAL", "COMBINATION"]),
      effectOnMetrics: z.string(),
    }),
  ),
  uncertaintyCharacterization: z.object({
    level: z.enum(["CHARACTERIZED", "PROPAGATED_WITH_PHENOMENA_DEPENDENCIES"]),
    description: z.string(),
    phenomenaDependencies: z
      .array(
        z.object({
          description: z.string(),
          dependentPhenomena: z.array(z.string()),
          treatmentMethod: z.string(),
        }),
      )
      .optional(),
  }),
  riskMetricMapping: z
    .array(
      z.object({
        consequenceMetric: z.string(),
        riskMetric: z.string(),
        mappingDescription: z.string(),
        transformations: z.string().optional(),
      }),
    )
    .optional(),
  quantificationLimitations: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RcRiskIntegrationFeedbackSchema = z.object({
  analysisRef: z.string(),
  feedbackDate: z.string().optional(),
  metricFeedback: z
    .array(
      z.object({
        metric: z.string(),
        riskSignificance: ImportanceLevelSchema.optional(),
        insights: z.array(z.string()).optional(),
        recommendations: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  releaseCategoryFeedback: z
    .array(
      z.object({
        releaseCategoryReference: z.string(),
        riskSignificance: ImportanceLevelSchema.optional(),
        insights: z.array(z.string()).optional(),
        recommendations: z.array(z.string()).optional(),
        status: z.enum(["PENDING", "IN_PROGRESS", "ADDRESSED", "DEFERRED"]).optional(),
      }),
    )
    .optional(),
  generalFeedback: z.string().optional(),
  response: z
    .object({
      description: z.string(),
      changes: z.array(z.string()).optional(),
      status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]),
    })
    .optional(),
});

export const RcDocumentationSchema = z.object({
  processDescription: z.string(),
  inputsDescription: z.string(),
  appliedMethods: z.string(),
  resultsSummary: z.string(),
  rcreProcess: z.string(),
  rcpaProcess: z.string(),
  rcpaModelUncertaintySources: z.string(),
  rcpaBoundingSiteDocumentation: z.string().optional(),
  rcmeProcess: z.string(),
  rcmeModelUncertaintySources: z.string(),
  rcmeBoundingSiteDocumentation: z.string().optional(),
  rcadProcess: z.string(),
  rcadModelUncertaintySources: z.string(),
  rcadBoundingSiteDocumentation: z.string().optional(),
  rcdoProcess: z.string(),
  rcdoModelUncertaintySources: z.string(),
  rcheProcess: z.string(),
  rcheModelUncertaintySources: z.string(),
  rcheBoundingSiteDocumentation: z.string().optional(),
  rcecProcess: z.string(),
  rcecModelUncertaintySources: z.string(),
  rcecBoundingSiteDocumentation: z.string().optional(),
  rcqProcess: z.string(),
  rcqModelUncertaintySources: z.string(),
  rcqLimitations: z.string(),
  praTaskInterfaces: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RadiologicalConsequenceAnalysisSchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.CONSEQUENCE_ANALYSIS).shape,
  praScope: z.string(),
  scope: RcScopeSchema,
  releaseCategoryToConsequence: ReleaseCategoryToConsequenceAnalysisSchema,
  protectiveActionParameters: ProtectiveActionAnalysisSchema,
  meteorologicalData: MeteorologicalDataAnalysisSchema,
  atmosphericTransportAndDispersion: AtmosphericDispersionAnalysisSchema,
  dosimetry: DosimetryAnalysisSchema,
  healthEffects: HealthEffectsAnalysisSchema,
  economicFactors: EconomicFactorsAnalysisSchema,
  consequenceQuantification: ConsequenceQuantificationAnalysisSchema,
  sensitivityStudies: z.array(SensitivityStudySchema).optional(),
  riskIntegrationFeedback: RcRiskIntegrationFeedbackSchema.optional(),
  modelUncertainty: BaseModelUncertaintyDocumentationSchema,
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  boundingSiteAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  documentation: RcDocumentationSchema,
  configurationControlRecordId: z.string().optional(),
  exampleDocuments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(["doc", "sheet", "image"]),
    sizeLabel: z.string(),
    uploadedLabel: z.string(),
    extracted: z.string(),
    linked: z.number(),
    url: z.string().optional(),
  })).optional(),
  newlyDevelopedMethodIds: z.array(z.string()).optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertRcMirrorsType = Expect<Equal<z.infer<typeof RadiologicalConsequenceAnalysisSchema>, RadiologicalConsequenceAnalysis>>;
