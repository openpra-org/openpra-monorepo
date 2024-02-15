import {
  DeleteHumanReliabilityAnalysis,
  GetHumanReliabilityAnalysis,
  PatchHumanReliabilityLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function HumanReliabilityAnalysisList() {
  return (
    <NestedModelList
      getNestedEndpoint={GetHumanReliabilityAnalysis}
      deleteNestedEndpoint={DeleteHumanReliabilityAnalysis}
      patchNestedEndpoint={PatchHumanReliabilityLabel}
      name="human-reliability-analysis"
    />
  );
}

export { HumanReliabilityAnalysisList };
