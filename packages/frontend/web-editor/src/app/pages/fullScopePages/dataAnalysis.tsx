import { Route, Routes } from "react-router-dom";
import { DataAnalysisList } from "../../components/lists/nestedLists/dataAnalysisList";
import { DataAnalysisDetail } from "./dataAnalysisDetail";
function DataAnalysis(): JSX.Element {
  return (
    <Routes>
      <Route
        path=""
        element={<DataAnalysisList />}
      />
      <Route
        path=":dataAnalysisId"
        element={<DataAnalysisDetail />}
      />
    </Routes>
  );
}
export { DataAnalysis };
