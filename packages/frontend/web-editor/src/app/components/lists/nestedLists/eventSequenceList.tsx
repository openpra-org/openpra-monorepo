import NestedModelApiManager from "packages/shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function EventSequenceList(){

    return (
        <NestedModelList 
          getNestedEndpoint={NestedModelApiManager.getEventSequenceDiagrams} 
          deleteNestedEndpoint={NestedModelApiManager.deleteEventSequenceDiagram} 
          name='event-sequence-diagram'
        />
    );
}
