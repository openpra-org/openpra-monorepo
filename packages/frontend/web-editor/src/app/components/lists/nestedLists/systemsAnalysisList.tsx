import NestedModelApiManager from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function SystemsAnalysisList() {
  return (
    <NestedModelList
      getNestedEndpoint={NestedModelApiManager.getSystemsAnalysis}
      deleteNestedEndpoint={NestedModelApiManager.deleteSystemsAnalysis}
      patchNestedEndpoint={NestedModelApiManager.patchSystemsAnalysisLabel}
      name="systems-analysis"
    />
  );
}
