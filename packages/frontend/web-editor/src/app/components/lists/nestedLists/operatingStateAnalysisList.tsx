import {
  DeleteOperatingStateAnalysis,
  GetOperatingStateAnalysis,
  PatchOperatingStateLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";

import { NestedModelList } from "./templateList/nestedModelList";

const OperatingStateAnalysisList = (): JSX.Element => {
  return (
    <NestedModelList
      getNestedEndpoint={GetOperatingStateAnalysis}
      deleteNestedEndpoint={DeleteOperatingStateAnalysis}
      patchNestedEndpoint={PatchOperatingStateLabel}
      name="operating-state-analysis"
    />
  );
};

export { OperatingStateAnalysisList };
