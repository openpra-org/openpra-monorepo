import {
  DeleteEventSequenceQuantificationDiagram,
  GetEventSequenceQuantificationDiagram,
  PatchEventSequenceQuantificationDiagramLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function EventSequenceQuantificationDiagramList() {
  return (
    <NestedModelList
      getNestedEndpoint={GetEventSequenceQuantificationDiagram}
      deleteNestedEndpoint={DeleteEventSequenceQuantificationDiagram}
      patchNestedEndpoint={PatchEventSequenceQuantificationDiagramLabel}
      name="event-sequence-quantification-diagram"
    />
  );
}

export { EventSequenceQuantificationDiagramList };
