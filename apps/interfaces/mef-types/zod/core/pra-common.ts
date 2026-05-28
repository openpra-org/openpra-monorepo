import { z } from "zod";
import { UniqueSchema } from "./meta";
import type {
  CapabilityCategory,
  CommentCollection,
  HlrId,
  PlantStage,
  ReviewComment,
  ReviewCommentSeverity,
  ReviewerReference,
  ReviewerRole,
  SRConformance,
  SRReference,
  SRStatus,
  WorkflowHistoryEntry,
  WorkflowState,
} from "../../core/pra-common";

export const CapabilityCategorySchema = z.enum(["CC-I", "CC-II"]);
export const PlantStageSchema = z.enum(["OPERATIONAL", "PRE_OPERATIONAL"]);
export const HlrIdSchema = z.enum(["A", "B", "C", "D", "E", "F"]);
export const SRStatusSchema = z.enum(["MET", "PARTIAL", "NOT_MET", "NOT_APPLICABLE", "PENDING_REVIEW"]);

export const WorkflowStateSchema = z.enum([
  "DRAFT",
  "INTERNAL_TECHNICAL_REVIEW",
  "INTERNAL_APPROVAL",
  "REVISION_REQUIRED",
  "AWAITING_EXTERNAL_REVIEW",
  "FINAL",
  "DEPRECATED",
]);

export const WorkflowHistoryEntrySchema = z.object({
  state: WorkflowStateSchema,
  enteredAt: z.string(),
  exitedAt: z.string().optional(),
  actor: z.string(),
  note: z.string().optional(),
});

export const SRReferenceSchema = z.object({
  sr: z.string(),
  hlr: HlrIdSchema,
});

export const SRConformanceSchema = z.object({
  sr: z.string(),
  hlr: HlrIdSchema,
  capabilityCategory: CapabilityCategorySchema,
  applicableToStage: z.array(PlantStageSchema),
  status: SRStatusSchema,
  satisfiedByElementPaths: z.array(z.string()),
  evidence: z.string(),
  reviewNotes: z.string().optional(),
});

export const ReviewerRoleSchema = z.enum([
  "INTERNAL_REVIEWER",
  "INTERNAL_APPROVER",
  "EXTERNAL_PEER_REVIEWER",
  "EXTERNAL_AUDITOR",
]);

export const ReviewCommentSeveritySchema = z.enum(["MAJOR", "MINOR", "OBSERVATION"]);

export const ReviewCommentSchema = z.object({
  ...UniqueSchema.shape,
  authorRole: ReviewerRoleSchema,
  authorId: z.string(),
  createdAt: z.string(),
  associatedField: z.string().optional(),
  associatedSr: z.string().optional(),
  text: z.string(),
  resolved: z.boolean(),
  resolution: z.string().optional(),
  resolvedAt: z.string().optional(),
  resolvedBy: z.string().optional(),
  severity: ReviewCommentSeveritySchema.optional(),
});

export const CommentCollectionSchema = z.object({
  comments: z.array(ReviewCommentSchema),
  openCount: z.number(),
  resolvedCount: z.number(),
});

export const ReviewerReferenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: ReviewerRoleSchema,
  organization: z.string().optional(),
  title: z.string().optional(),
  qualification: z.string().optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertCapabilityCategory = Expect<Equal<z.infer<typeof CapabilityCategorySchema>, CapabilityCategory>>;
type _AssertPlantStage = Expect<Equal<z.infer<typeof PlantStageSchema>, PlantStage>>;
type _AssertHlrId = Expect<Equal<z.infer<typeof HlrIdSchema>, HlrId>>;
type _AssertSRStatus = Expect<Equal<z.infer<typeof SRStatusSchema>, SRStatus>>;
type _AssertWorkflowState = Expect<Equal<z.infer<typeof WorkflowStateSchema>, WorkflowState>>;
type _AssertWorkflowHistoryEntry = Expect<Equal<z.infer<typeof WorkflowHistoryEntrySchema>, WorkflowHistoryEntry>>;
type _AssertSRReference = Expect<Equal<z.infer<typeof SRReferenceSchema>, SRReference>>;
type _AssertSRConformance = Expect<Equal<z.infer<typeof SRConformanceSchema>, SRConformance>>;
type _AssertReviewerRole = Expect<Equal<z.infer<typeof ReviewerRoleSchema>, ReviewerRole>>;
type _AssertReviewCommentSeverity = Expect<Equal<z.infer<typeof ReviewCommentSeveritySchema>, ReviewCommentSeverity>>;
type _AssertReviewComment = Expect<Equal<z.infer<typeof ReviewCommentSchema>, ReviewComment>>;
type _AssertCommentCollection = Expect<Equal<z.infer<typeof CommentCollectionSchema>, CommentCollection>>;
type _AssertReviewerReference = Expect<Equal<z.infer<typeof ReviewerReferenceSchema>, ReviewerReference>>;
