import {
  DeleteHeatBalanceFaultTree,
  GetHeatBalanceFaultTrees,
  PatchHeatBalanceFaultTreeLabel,
} from "shared-sdk/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function HeatBalanceFaultTreeList(): JSX.Element {
  return (
    <NestedModelList
      getNestedEndpoint={GetHeatBalanceFaultTrees}
      deleteNestedEndpoint={DeleteHeatBalanceFaultTree}
      patchNestedEndpoint={PatchHeatBalanceFaultTreeLabel}
      name="heat-balance-fault-tree"
    />
  );
}

export { HeatBalanceFaultTreeList };
