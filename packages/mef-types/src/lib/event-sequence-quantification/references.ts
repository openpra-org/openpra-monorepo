export {
  EventSequenceReference,
  EventSequenceFamilyReference,
  ReleaseCategoryMapping,
} from "../event-sequence-analysis/event-sequence-analysis";
export { PlantOperatingStateReference } from "../initiating-event-analysis/initiating-event-analysis";
export { SystemReference } from "../systems-analysis/systems-analysis";
export { SuccessCriteriaId } from "../core/shared-patterns";
export interface RiskSignificantEventSequence {
  sequenceId: string;
  sequenceType: "INDIVIDUAL" | "FAMILY";
  meanFrequency: number;
  frequencyUnit: string;
  riskSignificance: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  importanceMetrics?: {
    fussellVesely?: number;
    raw?: number;
    rrw?: number;
    birnbaum?: number;
  };
  riskSignificanceBasis?: string;
  riskInsights?: string[];
}
