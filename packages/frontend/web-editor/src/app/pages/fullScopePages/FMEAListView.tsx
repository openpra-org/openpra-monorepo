import React from "react";

import { Route, Routes } from "react-router-dom";
import { EditableTable } from "./fmeaEditor";

import { FailureModesAndEffectsAnalysesList } from "../../components/lists/nestedLists/failureModesAndEffectsAnalysesList";
import FmeaIndividualState from "./fmeaIndividualState";
import { EuiPageTemplate } from "@elastic/eui";

function FMEAListView(): JSX.Element {
  return (
    <>
      <EuiPageTemplate panelled={false} offset={48} grow={false}>
        <EuiPageTemplate.Section>
          <Routes>
            <Route path="" element={<FailureModesAndEffectsAnalysesList />} />
            <Route path=":fmeaId" element={<EditableTable />} />
            <Route path=":fmeaId/:rowId" element={<FmeaIndividualState />} />
          </Routes>
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
    </>
  );
}

export { FMEAListView };
