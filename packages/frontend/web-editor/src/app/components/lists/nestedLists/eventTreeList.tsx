import NestedModelApiManager from "packages/shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function EventTreeList(){

    return (
        <NestedModelList 
          getNestedEndpoint={NestedModelApiManager.getEventTrees} 
          deleteNestedEndpoint={NestedModelApiManager.deleteEventTree} 
          name='event-tree'
        />
    );
}
