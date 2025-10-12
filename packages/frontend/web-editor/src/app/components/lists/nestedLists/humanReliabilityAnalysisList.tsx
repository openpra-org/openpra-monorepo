import {
  DeleteHumanReliabilityAnalysis,
  GetHumanReliabilityAnalysis,
  PatchHumanReliabilityLabel,
} from "shared-sdk/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function HumanReliabilityAnalysisList(): JSX.Element {
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
