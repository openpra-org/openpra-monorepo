import {
  DeleteWeibullAnalysis,
  GetWeibullAnalysis,
  PatchWeibullAnalysisLabel,
} from "shared-sdk/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function WeibullAnalysisList(): JSX.Element {
  return (
    <NestedModelList
      getNestedEndpoint={GetWeibullAnalysis}
      deleteNestedEndpoint={DeleteWeibullAnalysis}
      patchNestedEndpoint={PatchWeibullAnalysisLabel}
      name="weibull-analysis"
    />
  );
}

export { WeibullAnalysisList };
