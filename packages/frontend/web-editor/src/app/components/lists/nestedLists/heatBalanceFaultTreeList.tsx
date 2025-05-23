import {
  DeleteHeatBalanceFaultTree,
  GetHeatBalanceFaultTrees,
  PatchHeatBalanceFaultTreeLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";

import { NestedModelList } from "./templateList/nestedModelList";

const HeatBalanceFaultTreeList = () => {
  return (
    <NestedModelList
      getNestedEndpoint={GetHeatBalanceFaultTrees}
      deleteNestedEndpoint={DeleteHeatBalanceFaultTree}
      patchNestedEndpoint={PatchHeatBalanceFaultTreeLabel}
      name="heat-balance-fault-tree"
    />
  );
};

export { HeatBalanceFaultTreeList };
