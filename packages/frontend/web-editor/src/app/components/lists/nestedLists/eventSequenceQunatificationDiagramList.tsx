import {
  DeleteEventSequenceQuantificationDiagram,
  GetEventSequenceQuantificationDiagram,
  PatchEventSequenceQuantificationDiagramLabel,
} from "shared-sdk/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function EventSequenceQuantificationDiagramList(): JSX.Element {
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
