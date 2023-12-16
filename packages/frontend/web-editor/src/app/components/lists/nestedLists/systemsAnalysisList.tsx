import {
  DeleteSystemsAnalysis,
  GetSystemsAnalysis,
  PatchSystemsAnalysisLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function SystemsAnalysisList() {
  return (
    <NestedModelList
      getNestedEndpoint={GetSystemsAnalysis}
      deleteNestedEndpoint={DeleteSystemsAnalysis}
      patchNestedEndpoint={PatchSystemsAnalysisLabel}
      name="systems-analysis"
    />
  );
}
