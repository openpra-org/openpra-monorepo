import { MethodBase } from "./master-logic-diagram";

export type OeApplicability = "HIGH" | "MEDIUM" | "SCREENED" | "OPEN";

export type OePrecursorDisposition = "RETAINED" | "GROUPED" | "SCREENED" | "OPEN";

export interface OeSource {
  id: string;
  name: string;
  type: string;
  period: string;
  eventsReviewed: number;
  applicability: OeApplicability;
  note: string;
}

export interface OePrecursor {
  id: string;
  event: string;
  sourceId: string;
  date: string;
  derivedInitiatorIds: string[];
  disposition: OePrecursorDisposition;
}

export interface OperatingExperienceReview extends MethodBase {
  methodKind: "OPERATING_EXPERIENCE_REVIEW";
  sources: OeSource[];
  precursors: OePrecursor[];
}
