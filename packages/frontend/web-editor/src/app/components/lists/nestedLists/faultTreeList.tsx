import {
  DeleteFaultTree,
  DeleteHeatBalanceFaultTree,
  GetFaultTrees,
  GetHeatBalanceFaultTrees,
  PatchFaultTreeLabel,
  PatchHeatBalanceFaultTreeLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
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

function HeatBalanceFaultTreeList() {
  return (
    <NestedModelList
      getNestedEndpoint={GetHeatBalanceFaultTrees}
      deleteNestedEndpoint={DeleteHeatBalanceFaultTree}
      patchNestedEndpoint={PatchHeatBalanceFaultTreeLabel}
      name="heat-balance-fault-tree"
    />
  );
}

export { FaultTreeList, HeatBalanceFaultTreeList };
