import {
  DeleteWeibullAnalysis,
  GetWeibullAnalysis,
  PatchWeibullAnalysisLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function WeibullAnalysisList() {
  return (
    <NestedModelList
      getNestedEndpoint={GetWeibullAnalysis}
      deleteNestedEndpoint={DeleteWeibullAnalysis}
      patchNestedEndpoint={PatchWeibullAnalysisLabel}
      name="weibull-analysis"
    />
  );
}
