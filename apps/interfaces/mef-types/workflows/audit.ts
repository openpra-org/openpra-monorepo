import { Unique } from "../core/meta";
import { CommentCollection, ReviewerReference } from "../core/pra-common";

export type AuditWorkflowState =
  | "NOT_STARTED"
  | "AUDITOR_ASSIGNMENT"
  | "IN_AUDIT"
  | "FINDINGS_ISSUED"
  | "CORRECTIVE_ACTION"
  | "CLOSED";

export type AuditScope = "NQA_1_ALIGNED" | "CONFIGURATION_CONTROL" | "TECHNICAL_ELEMENT" | "OTHER";

export interface Auditor extends ReviewerReference {
  qualifications: string[];
}

export interface AuditFinding extends Unique {
  description: string;
  severity: "MAJOR" | "MINOR" | "OBSERVATION";
  associatedRequirement?: string;
  correctiveActionRequired: boolean;
  correctiveActionPath?: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
}

export interface Audit extends Unique {
  auditedArtifactId: string;
  auditedArtifactKind: "TECHNICAL_ELEMENT" | "CONFIGURATION_CONTROL" | "NEWLY_DEVELOPED_METHOD" | "ORGANIZATION";
  scope: AuditScope;
  workflowState: AuditWorkflowState;
  startedAt?: string;
  closedAt?: string;
  auditors: Auditor[];
  findings: AuditFinding[];
  comments: CommentCollection;
  finalReportPath?: string;
}
