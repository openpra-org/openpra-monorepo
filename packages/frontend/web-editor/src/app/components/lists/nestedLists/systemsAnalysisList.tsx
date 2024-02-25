import {
  DeleteSystemsAnalysis,
  GetSystemsAnalysis,
  PatchSystemsAnalysisLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function SystemsAnalysisList(): JSX.Element {
  return (
    <NestedModelList
      getNestedEndpoint={GetSystemsAnalysis}
      deleteNestedEndpoint={DeleteSystemsAnalysis}
      patchNestedEndpoint={PatchSystemsAnalysisLabel}
      name="systems-analysis"
    />
  );
}

export { SystemsAnalysisList };
