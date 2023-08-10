import NestedModelApiManager from "packages/shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function InitiatingEventsList(){

    return (
        <NestedModelList 
          getNestedEndpoint={NestedModelApiManager.getInitiatingEvents} 
          deleteNestedEndpoint={NestedModelApiManager.deleteInitiatingEvent} 
          name='initiating-event'
        />
    );
}
