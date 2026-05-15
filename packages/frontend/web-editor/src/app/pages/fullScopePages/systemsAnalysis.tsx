import { Route, Routes } from "react-router-dom";
import { SystemsAnalysisList } from "../../components/lists/nestedLists/systemsAnalysisList";
import { SystemsAnalysisDetail } from "./systemsAnalysisDetail";
function SystemsAnalysis(): JSX.Element {
  return (
    <Routes>
      <Route
        path=""
        element={<SystemsAnalysisList />}
      />
      <Route
        path=":systemsAnalysisId"
        element={<SystemsAnalysisDetail />}
      />
    </Routes>
  );
}
export { SystemsAnalysis };
