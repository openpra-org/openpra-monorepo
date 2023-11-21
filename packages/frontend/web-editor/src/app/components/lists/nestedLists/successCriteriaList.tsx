import NestedModelApiManager from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function SuccessCriteriaList() {
  return (
    <NestedModelList
      getNestedEndpoint={NestedModelApiManager.getSuccessCriteria}
      deleteNestedEndpoint={NestedModelApiManager.deleteSuccessCriteria}
      patchNestedEndpoint={NestedModelApiManager.patchSuccessCriteriaLabel}
      name="success-criteria"
    />
  );
}
