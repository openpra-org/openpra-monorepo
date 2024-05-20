import React from "react";

import { Route, Routes } from "react-router-dom";
import { EditableTable } from "./fmeaEditor";

import { FailureModesAndEffectsAnalysesList } from "../../components/lists/nestedLists/failureModesAndEffectsAnalysesList";

function FMEAListView(): JSX.Element {
  return (
    <Routes>
      <Route path="" element={<FailureModesAndEffectsAnalysesList />} />
      <Route path=":fmeaId" element={<EditableTable />} />
    </Routes>
  );
}

export { FMEAListView };
