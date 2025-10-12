import {
  DeleteSuccessCriteria,
  GetSuccessCriteria,
  PatchSuccessCriteriaLabel,
} from "shared-sdk/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function SuccessCriteriaList(): JSX.Element {
  return (
    <NestedModelList
      getNestedEndpoint={GetSuccessCriteria}
      deleteNestedEndpoint={DeleteSuccessCriteria}
      patchNestedEndpoint={PatchSuccessCriteriaLabel}
      name="success-criteria"
    />
  );
}

export { SuccessCriteriaList };
