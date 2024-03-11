import {
  DeleteEventTree,
  GetEventTrees,
  PatchEventTreeLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function EventTreeList(): JSX.Element {
  return (
    <NestedModelList
      getNestedEndpoint={GetEventTrees}
      deleteNestedEndpoint={DeleteEventTree}
      patchNestedEndpoint={PatchEventTreeLabel}
      name="event-tree"
    />
  );
}

export { EventTreeList };
