import NestedModelApiManager from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function EventSequenceQuantificationDiagramList(){

    return (
        <NestedModelList 
          getNestedEndpoint={NestedModelApiManager.getEventSequenceQuantificationDiagram} 
          deleteNestedEndpoint={NestedModelApiManager.deleteEventSequenceQuantificationDiagram} 
          patchNestedEndpoint={NestedModelApiManager.patchEventSequenceQuantificationDiagramLabel} 
          name='event-sequence-quantification-diagram'
        />
    );
}
