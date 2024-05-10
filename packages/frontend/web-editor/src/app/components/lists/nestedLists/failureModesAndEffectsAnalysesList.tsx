import {
  DeleteFailureModesAndEffectsAnalyses,
  GetFailureModesAndEffectsAnalyses,
  PatchFailureModesAndEffectsAnalysesLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function FailureModesAndEffectsAnalysesList(): JSX.Element {
  return (
    <NestedModelList
      getNestedEndpoint={GetFailureModesAndEffectsAnalyses}
      deleteNestedEndpoint={DeleteFailureModesAndEffectsAnalyses}
      patchNestedEndpoint={PatchFailureModesAndEffectsAnalysesLabel}
      name="failure-modes-and-effects-analyses"
    />
  );
}

export { FailureModesAndEffectsAnalysesList };
