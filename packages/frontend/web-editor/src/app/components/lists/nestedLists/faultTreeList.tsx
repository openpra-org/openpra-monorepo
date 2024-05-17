import { DeleteFaultTree, GetFaultTrees, PatchFaultTreeLabel } from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function FaultTreeList(): JSX.Element {
  return (
    <NestedModelList
      getNestedEndpoint={GetFaultTrees}
      deleteNestedEndpoint={DeleteFaultTree}
      patchNestedEndpoint={PatchFaultTreeLabel}
      name="fault-tree"
    />
  );
}

export { FaultTreeList };
