import {
  DeleteDataAnalysis,
  GetDataAnalysis,
  PatchDataAnalysisLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";

import { NestedModelList } from "./templateList/nestedModelList";

const DataAnalysisList = (): JSX.Element => {
  return (
    <NestedModelList
      getNestedEndpoint={GetDataAnalysis}
      deleteNestedEndpoint={DeleteDataAnalysis}
      patchNestedEndpoint={PatchDataAnalysisLabel}
      name="data-analysis"
    />
  );
};
export { DataAnalysisList };
