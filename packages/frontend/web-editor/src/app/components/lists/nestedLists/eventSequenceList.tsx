import NestedModelApiManager from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function EventSequenceList() {
  return (
    <NestedModelList
      getNestedEndpoint={NestedModelApiManager.getEventSequenceDiagrams}
      deleteNestedEndpoint={NestedModelApiManager.deleteEventSequenceDiagram}
      patchNestedEndpoint={NestedModelApiManager.patchEventSequenceDiagramLabel}
      name="event-sequence-diagram"
    />
  );
}
