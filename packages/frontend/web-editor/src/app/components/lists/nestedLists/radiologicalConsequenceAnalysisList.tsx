import {
  DeleteRadiologicalConsequenceAnalysis,
  GetRadiologicalConsequenceAnalysis,
  PatchRadiologicalConsequenceLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function RadiologicalConsequenceAnalysisList() {
  return (
    <NestedModelList
      getNestedEndpoint={GetRadiologicalConsequenceAnalysis}
      deleteNestedEndpoint={DeleteRadiologicalConsequenceAnalysis}
      patchNestedEndpoint={PatchRadiologicalConsequenceLabel}
      name="radiological-consequence-analysis"
    />
  );
}
