import NestedModelApiManager from "packages/shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function FaultTreeList(){

    return (
        <NestedModelList 
          getNestedEndpoint={NestedModelApiManager.getFaultTrees} 
          deleteNestedEndpoint={NestedModelApiManager.deleteFaultTree} 
          patchNestedEndpoint={NestedModelApiManager.patchFaultTreeLabel} 
          name='fault-tree'
        />
    );
}
