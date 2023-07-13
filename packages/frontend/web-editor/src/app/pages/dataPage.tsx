import PageLayout from "../components/stylingaids/pageLayout";
import { Route, Routes } from "react-router-dom";
import ModelList from "../components/lists/ModelList";
import NewModelsPage from "./newModelsPage";
import ModelContainer from "./ModelContainer";
import EventSequenceDiagrams from "./modelPages/eventSequenceDiagrams";
import SpecialEvents from "./dataPages/specialEvents";
import ComponentReliability from "./dataPages/componentReliability";
import DataInitiatingEvents from "./dataPages/dataInitiatingEvents";
import TrainUA from "./dataPages/trainUA";
import Ccf from "./dataPages/ccf";

export default function DataPage() {
  return (
      <Routes>
          <Route
              path="specialevents"
              element={<SpecialEvents />}
          />
          <Route
              path="componentreliability"
              element= {<ComponentReliability />}
          />
          <Route
            path="initiatingevents"
            element={<DataInitiatingEvents />}
          />
          <Route
              path="trainua"
              element={<TrainUA />}
          />
          <Route
              path="ccf"
              element={<Ccf />}
          />
      </Routes>
  )
}
