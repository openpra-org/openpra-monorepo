import {
  DeleteRadiologicalConsequenceAnalysis,
  GetRadiologicalConsequenceAnalysis,
  PatchRadiologicalConsequenceLabel,
} from "shared-sdk/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function RadiologicalConsequenceAnalysisList(): JSX.Element {
  return (
    <NestedModelList
      getNestedEndpoint={GetRadiologicalConsequenceAnalysis}
      deleteNestedEndpoint={DeleteRadiologicalConsequenceAnalysis}
      patchNestedEndpoint={PatchRadiologicalConsequenceLabel}
      name="radiological-consequence-analysis"
    />
  );
}

export { RadiologicalConsequenceAnalysisList };
