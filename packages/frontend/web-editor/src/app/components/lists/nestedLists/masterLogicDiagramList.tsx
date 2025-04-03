import {
  DeleteMasterLogicDiagram,
  GetMasterLogicDiagrams,
  PatchMasterlogicDiagramLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function MasterLogicDiagramList() {
  return (
    <NestedModelList
      getNestedEndpoint={GetMasterLogicDiagrams}
      deleteNestedEndpoint={DeleteMasterLogicDiagram}
      patchNestedEndpoint={PatchMasterlogicDiagramLabel}
      name="master-logic-diagram"
    />
  );
}

export { MasterLogicDiagramList };
