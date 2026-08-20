import { z } from "zod";
import type { PeerReview, PeerReviewWorkflowState, PeerReviewer } from "../../workflows/peer-review";
import { UniqueSchema } from "../core/meta";
import { CommentCollectionSchema, PlantStageSchema, ReviewerReferenceSchema } from "../core/pra-common";
import { BasePeerReviewDocumentationSchema } from "../core/documentation";

export const PeerReviewWorkflowStateSchema = z.enum([
  "NOT_STARTED",
  "TEAM_ASSEMBLY",
  "IN_REVIEW",
  "COMMENT_RESOLUTION",
  "FINAL_REPORT",
  "CLOSED",
]);

export const PeerReviewerSchema = z.object({
  ...ReviewerReferenceSchema.shape,
  qualifications: z.array(z.string()),
  assignedTechnicalElementCodes: z.array(z.string()),
});

export const PeerReviewSchema = z.object({
  ...UniqueSchema.shape,
  reviewedArtifactId: z.string(),
  reviewedArtifactKind: z.enum(["TECHNICAL_ELEMENT", "CONFIGURATION_CONTROL", "NEWLY_DEVELOPED_METHOD"]),
  plantStage: PlantStageSchema,
  workflowState: PeerReviewWorkflowStateSchema,
  startedAt: z.string().optional(),
  closedAt: z.string().optional(),
  team: z.array(PeerReviewerSchema),
  comments: CommentCollectionSchema,
  finalDocumentation: BasePeerReviewDocumentationSchema.optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertPeerReviewWorkflowState = Expect<Equal<z.infer<typeof PeerReviewWorkflowStateSchema>, PeerReviewWorkflowState>>;
type _AssertPeerReviewer = Expect<Equal<z.infer<typeof PeerReviewerSchema>, PeerReviewer>>;
type _AssertPeerReview = Expect<Equal<z.infer<typeof PeerReviewSchema>, PeerReview>>;
