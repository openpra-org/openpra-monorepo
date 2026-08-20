import { z } from "zod";
import { TechnicalElementTypes } from "../../technical-element";
import type {
  ComputerCodeControl,
  ConfigurationControlDocumentation,
  MonitoredChange,
  PRAConfigurationControl,
  PendingChangeImpactAssessment,
  PraUpdateRecord,
} from "../../cross-cutting/pra-configuration-control";
import { NamedSchema, UniqueSchema } from "../core/meta";
import { SRReferenceSchema } from "../core/pra-common";
import { technicalElementSchema } from "../technical-element";

export const MonitoredChangeSchema = z.object({
  ...UniqueSchema.shape,
  ...NamedSchema.shape,
  changeType: z.enum(["PLANT_DESIGN", "OPERATION", "PRA_TECHNOLOGY", "INDUSTRY_EXPERIENCE"]),
  description: z.string(),
  detectedAt: z.string(),
  source: z.string(),
  potentialPraImpact: z.string(),
  status: z.enum(["OPEN", "EVALUATED", "INCORPORATED", "DEFERRED"]),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PraUpdateRecordSchema = z.object({
  ...UniqueSchema.shape,
  description: z.string(),
  performedAt: z.string(),
  performedBy: z.string(),
  affectedTechnicalElementIds: z.array(z.string()),
  basisForUpdate: z.string(),
  consistencyWithPlant: z.enum(["AS_BUILT", "AS_OPERATED", "AS_DESIGNED", "AS_INTENDED_TO_OPERATE"]),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PendingChangeImpactAssessmentSchema = z.object({
  ...UniqueSchema.shape,
  pendingChangeIds: z.array(z.string()),
  individualImpacts: z.array(z.string()),
  cumulativeImpact: z.string(),
  riskApplicationsAffected: z.array(z.string()),
  conclusion: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ComputerCodeControlSchema = z.object({
  ...UniqueSchema.shape,
  ...NamedSchema.shape,
  codeName: z.string(),
  version: z.string(),
  controlledArtifactPaths: z.array(z.string()),
  configurationManagementSystem: z.string(),
  qualificationStatus: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ConfigurationControlDocumentationSchema = z.object({
  programDescription: z.string(),
  changeMonitoringProcess: z.string(),
  praMaintenanceProcess: z.string(),
  cumulativeImpactProcess: z.string(),
  codeControlProcess: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PRAConfigurationControlSchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.PRA_CONFIGURATION_CONTROL).shape,
  freezeDate: z.string(),
  plantConfigurationRevision: z.string().optional(),
  monitoredChanges: z.array(MonitoredChangeSchema),
  praUpdateRecords: z.array(PraUpdateRecordSchema),
  pendingChangeAssessments: z.array(PendingChangeImpactAssessmentSchema),
  computerCodeControls: z.array(ComputerCodeControlSchema),
  documentation: ConfigurationControlDocumentationSchema,
  invokedPriorToFirstPeerReview: z.boolean(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertMonitoredChange = Expect<Equal<z.infer<typeof MonitoredChangeSchema>, MonitoredChange>>;
type _AssertPraUpdateRecord = Expect<Equal<z.infer<typeof PraUpdateRecordSchema>, PraUpdateRecord>>;
type _AssertPendingChangeImpactAssessment = Expect<Equal<z.infer<typeof PendingChangeImpactAssessmentSchema>, PendingChangeImpactAssessment>>;
type _AssertComputerCodeControl = Expect<Equal<z.infer<typeof ComputerCodeControlSchema>, ComputerCodeControl>>;
type _AssertConfigurationControlDocumentation = Expect<Equal<z.infer<typeof ConfigurationControlDocumentationSchema>, ConfigurationControlDocumentation>>;
type _AssertPRAConfigurationControl = Expect<Equal<z.infer<typeof PRAConfigurationControlSchema>, PRAConfigurationControl>>;
