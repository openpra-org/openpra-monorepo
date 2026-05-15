export {
  ReleaseCategoryReference,
  SourceTermDefinitionReference,
  EventSequenceToReleaseCategoryMapping,
  ReleaseCategory,
  SourceTermDefinition,
} from "../mechanistic-source-term/mechanistic-source-term";
export interface RiskSignificantConsequence {
  releaseCategoryId: string;
  sourceTermDefinitionId?: string;
  consequenceMetrics: Record<string, number>;
  riskSignificance: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  riskInsights?: string[];
  uncertaintyDescription?: string;
  mappedRiskMetrics?: {
    metricName: string;
    mappingDescription: string;
  }[];
}
