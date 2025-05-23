import {
  DeleteWeibullAnalysis,
  GetWeibullAnalysis,
  PatchWeibullAnalysisLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";

import { NestedModelList } from "./templateList/nestedModelList";

const WeibullAnalysisList = (): JSX.Element => {
  return (
    <NestedModelList
      getNestedEndpoint={GetWeibullAnalysis}
      deleteNestedEndpoint={DeleteWeibullAnalysis}
      patchNestedEndpoint={PatchWeibullAnalysisLabel}
      name="weibull-analysis"
    />
  );
};

export { WeibullAnalysisList };
