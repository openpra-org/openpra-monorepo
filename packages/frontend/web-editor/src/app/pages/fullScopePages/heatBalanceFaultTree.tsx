import { Route, Routes } from "react-router-dom";
import React from "react";
import { HeatBalanceFaultTreeList } from "../../components/lists/nestedLists/heatBalanceFaultTreeList";
import { FaultTreeEditor } from "./faultTrees";
function HeatBalanceFaultTrees(): JSX.Element {
  return (
    <Routes>
      <Route
        path=""
        element={<HeatBalanceFaultTreeList />}
      />
      <Route
        path=":faultTreeId"
        element={<FaultTreeEditor />}
      />
    </Routes>
  );
}
export { HeatBalanceFaultTrees };
