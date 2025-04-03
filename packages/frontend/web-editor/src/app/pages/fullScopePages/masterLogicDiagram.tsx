import { Route, Routes } from "react-router-dom";
import React from "react";
import { MasterLogicDiagramList } from "../../components/lists/nestedLists/masterLogicDiagramList";
import { FaultTreeEditor } from "./faultTrees";

/**
 * Function to mimic fault tree behaviour for heat balance fault tree
 * @constructor
 */
function MasterLogicDiagram() {
  return (
    <Routes>
      <Route
        path=""
        element={<MasterLogicDiagramList />}
      />
      <Route
        path=":faultTreeId"
        element={<FaultTreeEditor />}
      />
    </Routes>
  );
}

export { MasterLogicDiagram };
