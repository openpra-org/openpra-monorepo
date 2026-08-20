import { Unique } from "../core/meta";
import { CommentCollection, PlantStage, ReviewerReference } from "../core/pra-common";
import { BasePeerReviewDocumentation } from "../core/documentation";

export type PeerReviewWorkflowState =
  | "NOT_STARTED"
  | "TEAM_ASSEMBLY"
  | "IN_REVIEW"
  | "COMMENT_RESOLUTION"
  | "FINAL_REPORT"
  | "CLOSED";

export interface PeerReviewer extends ReviewerReference {
  qualifications: string[];
  assignedTechnicalElementCodes: string[];
}

export interface PeerReview extends Unique {
  reviewedArtifactId: string;
  reviewedArtifactKind: "TECHNICAL_ELEMENT" | "CONFIGURATION_CONTROL" | "NEWLY_DEVELOPED_METHOD";
  plantStage: PlantStage;
  workflowState: PeerReviewWorkflowState;
  startedAt?: string;
  closedAt?: string;
  team: PeerReviewer[];
  comments: CommentCollection;
  finalDocumentation?: BasePeerReviewDocumentation;
}
