import { z } from "zod";
import type { Audit, AuditFinding, AuditScope, AuditWorkflowState, Auditor } from "../../workflows/audit";
import { UniqueSchema } from "../core/meta";
import { CommentCollectionSchema, ReviewerReferenceSchema } from "../core/pra-common";

export const AuditWorkflowStateSchema = z.enum([
  "NOT_STARTED",
  "AUDITOR_ASSIGNMENT",
  "IN_AUDIT",
  "FINDINGS_ISSUED",
  "CORRECTIVE_ACTION",
  "CLOSED",
]);

export const AuditScopeSchema = z.enum([
  "NQA_1_ALIGNED",
  "CONFIGURATION_CONTROL",
  "TECHNICAL_ELEMENT",
  "OTHER",
]);

export const AuditorSchema = z.object({
  ...ReviewerReferenceSchema.shape,
  qualifications: z.array(z.string()),
});

export const AuditFindingSchema = z.object({
  ...UniqueSchema.shape,
  description: z.string(),
  severity: z.enum(["MAJOR", "MINOR", "OBSERVATION"]),
  associatedRequirement: z.string().optional(),
  correctiveActionRequired: z.boolean(),
  correctiveActionPath: z.string().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]),
});

export const AuditSchema = z.object({
  ...UniqueSchema.shape,
  auditedArtifactId: z.string(),
  auditedArtifactKind: z.enum([
    "TECHNICAL_ELEMENT",
    "CONFIGURATION_CONTROL",
    "NEWLY_DEVELOPED_METHOD",
    "ORGANIZATION",
  ]),
  scope: AuditScopeSchema,
  workflowState: AuditWorkflowStateSchema,
  startedAt: z.string().optional(),
  closedAt: z.string().optional(),
  auditors: z.array(AuditorSchema),
  findings: z.array(AuditFindingSchema),
  comments: CommentCollectionSchema,
  finalReportPath: z.string().optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertAuditWorkflowState = Expect<Equal<z.infer<typeof AuditWorkflowStateSchema>, AuditWorkflowState>>;
type _AssertAuditScope = Expect<Equal<z.infer<typeof AuditScopeSchema>, AuditScope>>;
type _AssertAuditor = Expect<Equal<z.infer<typeof AuditorSchema>, Auditor>>;
type _AssertAuditFinding = Expect<Equal<z.infer<typeof AuditFindingSchema>, AuditFinding>>;
type _AssertAudit = Expect<Equal<z.infer<typeof AuditSchema>, Audit>>;
