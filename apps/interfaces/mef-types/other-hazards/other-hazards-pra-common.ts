import { z } from "zod";
import { HlrId, PlantStage } from "../core/pra-common";
import {
  OtherHazardCategorySchema,
  OtherHazardEffectSchema,
  OtherHazardsAnalysisRecordSchema,
  OtherHazardsInvestigationSchema,
  OtherHazardsModelUncertaintySchema,
  OtherHazardsPraInterfaceRecordSchema,
  OtherHazardsPraSubelementSchema,
  OtherHazardsPreOperationalAssumptionSchema,
  OtherHazardsProcessDocumentationSchema,
  OtherHazardsRecordStatusSchema,
  OtherHazardsScreeningDecisionSchema,
} from "../zod/other-hazards/other-hazards-pra";

export type OtherHazardsPraSubelement = z.infer<typeof OtherHazardsPraSubelementSchema>;
export type OtherHazardsRecordStatus = z.infer<typeof OtherHazardsRecordStatusSchema>;
export type OtherHazardCategory = z.infer<typeof OtherHazardCategorySchema>;
export type OtherHazardEffect = z.infer<typeof OtherHazardEffectSchema>;
export type OtherHazardsAnalysisRecord = z.infer<typeof OtherHazardsAnalysisRecordSchema>;
export type OtherHazardsInvestigation = z.infer<typeof OtherHazardsInvestigationSchema>;
export type OtherHazardsModelUncertainty = z.infer<typeof OtherHazardsModelUncertaintySchema>;
export type OtherHazardsPreOperationalAssumption = z.infer<typeof OtherHazardsPreOperationalAssumptionSchema>;
export type OtherHazardsProcessDocumentation = z.infer<typeof OtherHazardsProcessDocumentationSchema>;
export type OtherHazardsScreeningDecision = z.infer<typeof OtherHazardsScreeningDecisionSchema>;
export type OtherHazardsPraInterfaceRecord = z.infer<typeof OtherHazardsPraInterfaceRecordSchema>;

export interface OtherHazardsSrCatalogEntry {
  hlr: HlrId;
  stages: PlantStage[];
  description: string;
}

export function createOtherHazardsSrCatalog(
  prefix: OtherHazardsPraSubelement,
  requirements: Record<string, string[]>,
  stageOverrides: Record<string, PlantStage[]> = {},
): Record<string, OtherHazardsSrCatalogEntry> {
  const catalog: Record<string, OtherHazardsSrCatalogEntry> = {};
  for (const [hlr, descriptions] of Object.entries(requirements)) {
    descriptions.forEach((description, index) => {
      const sr = `${prefix}-${hlr}${String(index + 1)}`;
      catalog[sr] = {
        hlr: hlr as HlrId,
        stages: stageOverrides[sr] ?? ["OPERATIONAL", "PRE_OPERATIONAL"],
        description,
      };
    });
  }
  return catalog;
}
