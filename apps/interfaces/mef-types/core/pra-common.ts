import { Unique } from "./meta";

export type CapabilityCategory = "CC-I" | "CC-II";

export type PlantStage = "OPERATIONAL" | "PRE_OPERATIONAL";

export type HlrId = "A" | "B" | "C" | "D" | "E" | "F";

export type SRStatus = "MET" | "PARTIAL" | "NOT_MET" | "NOT_APPLICABLE" | "PENDING_REVIEW";

export type WorkflowState =
  | "DRAFT"
  | "INTERNAL_TECHNICAL_REVIEW"
  | "INTERNAL_APPROVAL"
  | "REVISION_REQUIRED"
  | "AWAITING_EXTERNAL_REVIEW"
  | "FINAL"
  | "DEPRECATED";

export interface WorkflowHistoryEntry {
  state: WorkflowState;
  enteredAt: string;
  exitedAt?: string;
  actor: string;
  note?: string;
}

export interface SRReference {
  sr: string;
  hlr: HlrId;
}

export interface SRConformance {
  sr: string;
  hlr: HlrId;
  capabilityCategory: CapabilityCategory;
  applicableToStage: PlantStage[];
  status: SRStatus;
  satisfiedByElementPaths: string[];
  evidence: string;
  reviewNotes?: string;
}

export type ReviewerRole = "INTERNAL_REVIEWER" | "INTERNAL_APPROVER" | "EXTERNAL_PEER_REVIEWER" | "EXTERNAL_AUDITOR";

export interface ReviewComment extends Unique {
  authorRole: ReviewerRole;
  authorId: string;
  createdAt: string;
  associatedField?: string;
  associatedSr?: string;
  text: string;
  resolved: boolean;
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface CommentCollection {
  comments: ReviewComment[];
  openCount: number;
  resolvedCount: number;
}

export interface ReviewerReference {
  id: string;
  name: string;
  role: ReviewerRole;
  organization?: string;
}
