import {
  DeleteFaultTree,
  GetFaultTrees,
  PatchFaultTreeLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function FaultTreeList() {
  return (
    <NestedModelList
      getNestedEndpoint={GetFaultTrees}
      deleteNestedEndpoint={DeleteFaultTree}
      patchNestedEndpoint={PatchFaultTreeLabel}
      name="fault-tree"
    />
  );
}
