import {
  DeleteSuccessCriteria,
  GetSuccessCriteria,
  PatchSuccessCriteriaLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";

import { NestedModelList } from "./templateList/nestedModelList";

const SuccessCriteriaList = (): JSX.Element => {
  return (
    <NestedModelList
      getNestedEndpoint={GetSuccessCriteria}
      deleteNestedEndpoint={DeleteSuccessCriteria}
      patchNestedEndpoint={PatchSuccessCriteriaLabel}
      name="success-criteria"
    />
  );
};

export { SuccessCriteriaList };
