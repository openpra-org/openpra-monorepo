import { z } from "zod";
import type { SuccessCriteriaDevelopment } from "../../sc/success-criteria-development";
import { AnalysisType } from "../../sc/success-criteria-development";
import { EndState } from "../../core/events";
import { TechnicalElementTypes } from "../../technical-element";
import { technicalElementSchema } from "../technical-element";
import { SensitivityStudySchema, SuccessCriteriaIdSchema } from "../core/shared-patterns";
import {
  BaseDesignInformationSchema,
  BaseModelUncertaintyDocumentationSchema,
  PreOperationalAssumptionSchema,
} from "../core/documentation";
import { SRReferenceSchema } from "../core/pra-common";

export const ScEndStateSchema = z.enum(EndState);
export const AnalysisTypeSchema = z.enum(AnalysisType);

export const SafeStableStateDefinitionSchema = z.object({
  definition: z.string(),
  basis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PlantDamageStateConditionSchema = z.object({
  pdsId: z.string(),
  physicalConditions: z.string(),
  successCriteriaIds: z.array(SuccessCriteriaIdSchema),
});

export const EndStateDefinitionSchema = z.object({
  uuid: z.string(),
  endState: ScEndStateSchema,
  definition: z.string(),
  releaseCategoryReferences: z.array(z.string()),
  determiningParameters: z.array(
    z.object({
      parameter: z.string(),
      criterion: z.string(),
      basis: z.string(),
    }),
  ),
  releaseBelowRiThreshold: z.boolean().optional(),
  resultingReleaseCategoryId: z.string().optional(),
  marginJustification: z.string().optional(),
  realisticSelectionBasis: z.string().optional(),
  plantDamageStateConditions: z.array(PlantDamageStateConditionSchema).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SafetyFunctionSuccessCriterionSchema = z.object({
  uuid: z.string(),
  safetyFunctionId: z.string(),
  initiatingEventId: z.string(),
  plantOperatingStateId: z.string(),
  criteria: z.array(z.string()),
  engineeringAnalysisReferences: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const OverallSuccessCriteriaDefinitionSchema = z.object({
  uuid: z.string(),
  successCriteriaId: SuccessCriteriaIdSchema,
  description: z.string(),
  criteria: z.array(z.string()),
  eventSequenceReference: z.string().optional(),
  eventSequenceFamilyReference: z.string().optional(),
  endStateDefinitionId: z.string().optional(),
  keySafetyFunctions: z.array(z.string()),
  radionuclideBarriers: z.array(z.string()),
  engineeringAnalysisReferences: z.array(z.string()),
  applicablePlantOperatingStates: z.array(z.string()).optional(),
  applicableInitiatingEvents: z.array(z.string()).optional(),
  isRiskSignificant: z.boolean(),
  usesRealisticCriteria: z.boolean().optional(),
  genericAnalysisBasis: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SystemSuccessCriteriaDefinitionSchema = z.object({
  uuid: z.string(),
  systemId: z.string(),
  description: z.string(),
  requiredCapacities: z.array(
    z.object({
      parameter: z.string(),
      value: z.string(),
      basis: z.string(),
    }),
  ),
  systemDependencies: z
    .array(
      z.object({
        dependentSystemId: z.string(),
        dependencyNature: z.string(),
      }),
    )
    .optional(),
  analysisReferences: z.array(z.string()),
  overallSuccessCriteriaId: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ComponentSuccessCriteriaDefinitionSchema = z.object({
  uuid: z.string(),
  componentId: z.string(),
  description: z.string(),
  requiredPerformance: z.string(),
  systemId: z.string(),
  analysisReferences: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HumanActionSuccessCriteriaDefinitionSchema = z.object({
  uuid: z.string(),
  humanActionId: z.string(),
  description: z.string(),
  timeAvailable: z.string(),
  successCriteria: z.string(),
  procedureReference: z.string().optional(),
  analysisReferences: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RadionuclideBarrierCriterionSchema = z.object({
  uuid: z.string(),
  barrierId: z.string(),
  protectionParameters: z.array(
    z.object({
      parameter: z.string(),
      criterion: z.string(),
      basis: z.string(),
    }),
  ),
  challengeLoads: z.array(
    z.object({
      eventSequenceReference: z.string().optional(),
      loadDescription: z.string(),
      physicalAttributes: z.array(z.string()),
    }),
  ),
  capacityParameters: z.array(z.string()),
  effectivenessEvaluationMethod: z.enum(["CONSERVATIVE", "REALISTIC"]),
  uncertaintyAssessment: z.string().optional(),
  engineeringAnalysisReferences: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PassiveSafetyFunctionCriterionSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  safetyFunctionId: z.string(),
  passivePhenomena: z.array(z.string()),
  mechanisticModelDescription: z.string(),
  empiricalDataReferences: z.array(z.string()),
  modelUncertaintyCharacterization: z.string(),
  inputDataUncertaintyCharacterization: z.string(),
  passiveFunctionalReliabilityBasis: z.string(),
  engineeringAnalysisReferences: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SharedResourceDefinitionSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  sharedBySystems: z.array(z.string()),
  sharedByReactors: z.array(z.string()),
  commonInitiatingEventReferences: z.array(z.string()),
  allocationStrategy: z.string(),
  successCriteriaImpact: z.string(),
  analysisReferences: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const MissionTimeDefinitionSchema = z.object({
  uuid: z.string(),
  eventSequenceReference: z.string(),
  missionTimeHours: z.number(),
  basis: z.string(),
  safeStableStateAchievedWithinMissionTime: z.boolean(),
  treatmentWhenNotAchieved: z.enum(["CONSERVATIVE_END_STATE", "EXTENDED_MISSION_TIME", "ADDITIONAL_EVALUATION"]).optional(),
  treatmentJustification: z.string().optional(),
  analysisReferences: z.array(z.string()),
  isRiskSignificant: z.boolean().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ComponentMissionTimeDefinitionSchema = z.object({
  uuid: z.string(),
  componentId: z.string(),
  missionTimeHours: z.number(),
  eventSequenceReference: z.string(),
  shorterMissionTimeJustification: z.string().optional(),
  analysisReferences: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ConsistencyVerificationSchema = z.object({
  uuid: z.string(),
  successCriteriaId: SuccessCriteriaIdSchema,
  designBasesVerification: z.object({
    isConsistent: z.boolean(),
    description: z.string(),
    references: z.array(z.string()),
  }),
  licensingBasesVerification: z.object({
    isConsistent: z.boolean(),
    description: z.string(),
    references: z.array(z.string()),
  }),
  operationalPracticesVerification: z.object({
    isConsistent: z.boolean(),
    description: z.string(),
    references: z.array(z.string()),
  }),
  implementsSrs: z.array(SRReferenceSchema),
});

export const AnalysisDetailConsistencySchema = z.object({
  consistentWithInitiatingEventGrouping: z.boolean(),
  consistentWithPlantOperatingStateDefinition: z.boolean(),
  consistentWithEventSequenceModeling: z.boolean(),
  basis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const EngineeringAnalysisSchema = z.object({
  uuid: z.string(),
  analysisId: z.string(),
  analysisType: AnalysisTypeSchema,
  description: z.string(),
  computerCode: z.string().optional(),
  codeVersion: z.string().optional(),
  validationVerificationBasis: z.string().optional(),
  analyst: z.string().optional(),
  applicabilityToPlantConditions: z.string(),
  keyParametersAndResults: z.record(z.string(), z.string()),
  referenceDocuments: z.array(z.string()).optional(),
  limitations: z.array(z.string()).optional(),
  reasonablenessReview: z
    .object({
      performed: z.boolean(),
      method: z.string(),
      conclusion: z.string(),
    })
    .optional(),
  supportedSuccessCriteria: z.array(SuccessCriteriaIdSchema),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ThermalFluidAnalysisSchema = z.object({
  uuid: z.string(),
  engineeringAnalysisId: z.string(),
  eventSequencesAnalyzed: z.array(z.string()),
  systemResponsesModeled: z.array(z.string()),
  thermalParametersAnalyzed: z.array(z.string()),
  analysisTimeSpan: z.string(),
  resultsSummary: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const StructuralAnalysisSchema = z.object({
  uuid: z.string(),
  engineeringAnalysisId: z.string(),
  structuresAnalyzed: z.array(z.string()),
  loadingConditionsAnalyzed: z.array(z.string()),
  failureModesEvaluated: z.array(z.string()),
  analysisMethods: z.array(z.string()),
  resultsSummary: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ComputerCodeValidationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  computerCode: z.string(),
  codeVersion: z.string(),
  verificationDocumentation: z.string(),
  experimentalValidation: z
    .array(
      z.object({
        experimentDescription: z.string(),
        validationResults: z.string(),
        reference: z.string(),
      }),
    )
    .optional(),
  plantSpecificValidation: z
    .array(
      z.object({
        benchmarkDescription: z.string(),
        validationResults: z.string(),
        reference: z.string(),
      }),
    )
    .optional(),
  phenomenaValidation: z.array(
    z.object({
      phenomenonDescription: z.string(),
      validationResults: z.string(),
      reference: z.string(),
    }),
  ),
  limitations: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const AnalystQualificationSchema = z.object({
  uuid: z.string(),
  analystName: z.string(),
  qualifications: z.array(z.string()),
  relevantExperience: z.string(),
  codeTraining: z
    .array(
      z.object({
        codeName: z.string(),
        trainingDescription: z.string(),
        trainingDate: z.string(),
      }),
    )
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PlantSpecificDesignInformationSchema = z.object({
  ...BaseDesignInformationSchema.shape,
  plantSystems: z.array(z.string()),
  operatingConfigurations: z.array(z.string()),
  designParameters: z.record(z.string(), z.string()),
  operatingPhilosophies: z.array(z.string()).optional(),
});

export const ExpertJudgmentSchema = z.object({
  uuid: z.string(),
  topic: z.string(),
  justification: z.string(),
  panelMembers: z.array(z.string()),
  processDescription: z.string(),
  processDocumentationReference: z.string(),
  outcome: z.string(),
  informedSuccessCriteria: z.array(SuccessCriteriaIdSchema),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ScDocumentationSchema = z.object({
  processDescription: z.string(),
  endStateDefinitionsBasis: z.string(),
  successCriteriaPerFunctionEventState: z.string(),
  missionTimesBasis: z.string(),
  calculationsAndCodesUsed: z.string(),
  codeValidationAndLimitations: z.string(),
  expertJudgmentUse: z.string(),
  sharedSystemsTreatment: z.string(),
  passiveSafetyTreatment: z.string(),
  consistencyWithPlantDesign: z.string(),
  modelUncertaintySources: z.string(),
  asBuiltLimitations: z.string(),
  praTaskInterfaces: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SuccessCriteriaDevelopmentSchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.SUCCESS_CRITERIA_DEVELOPMENT).shape,
  praScope: z.string(),
  safeStableStateDefinition: SafeStableStateDefinitionSchema,
  endStateDefinitions: z.array(EndStateDefinitionSchema),
  safetyFunctionSuccessCriteria: z.array(SafetyFunctionSuccessCriterionSchema),
  overallSuccessCriteria: z.array(OverallSuccessCriteriaDefinitionSchema),
  systemSuccessCriteria: z.array(SystemSuccessCriteriaDefinitionSchema).optional(),
  componentSuccessCriteria: z.array(ComponentSuccessCriteriaDefinitionSchema).optional(),
  humanActionSuccessCriteria: z.array(HumanActionSuccessCriteriaDefinitionSchema).optional(),
  radionuclideBarrierCriteria: z.array(RadionuclideBarrierCriterionSchema),
  passiveSafetyFunctionCriteria: z.array(PassiveSafetyFunctionCriterionSchema).optional(),
  sharedResources: z.array(SharedResourceDefinitionSchema).optional(),
  missionTimes: z.array(MissionTimeDefinitionSchema),
  componentMissionTimes: z.array(ComponentMissionTimeDefinitionSchema).optional(),
  engineeringAnalyses: z.array(EngineeringAnalysisSchema),
  thermalFluidAnalyses: z.array(ThermalFluidAnalysisSchema).optional(),
  structuralAnalyses: z.array(StructuralAnalysisSchema).optional(),
  computerCodeValidations: z.array(ComputerCodeValidationSchema).optional(),
  analystQualifications: z.array(AnalystQualificationSchema).optional(),
  plantSpecificDesign: z.array(PlantSpecificDesignInformationSchema).optional(),
  expertJudgments: z.array(ExpertJudgmentSchema).optional(),
  analysisDetailConsistency: AnalysisDetailConsistencySchema,
  consistencyVerifications: z.array(ConsistencyVerificationSchema).optional(),
  modelUncertainty: BaseModelUncertaintyDocumentationSchema,
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  sensitivityStudies: z.array(SensitivityStudySchema).optional(),
  documentation: ScDocumentationSchema,
  configurationControlRecordId: z.string().optional(),
  newlyDevelopedMethodIds: z.array(z.string()).optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertScMirrorsType = Expect<Equal<z.infer<typeof SuccessCriteriaDevelopmentSchema>, SuccessCriteriaDevelopment>>;
