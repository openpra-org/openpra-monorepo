import NestedModelApiManager from "packages/shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function FunctionalEventsList(){

    return (
        <NestedModelList 
          getNestedEndpoint={NestedModelApiManager.getFunctionalEvents} 
          deleteNestedEndpoint={NestedModelApiManager.deleteFunctionalEvent} 
          patchNestedEndpoint={NestedModelApiManager.patchFunctionalEventLabel} 
          name='functional-event'
        />
    );
}
