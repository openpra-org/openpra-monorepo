import { Route, Routes } from "react-router-dom";
import SpecialEvents from "../dataPages/specialEvents";
import ComponentReliability from "../dataPages/componentReliability";
import DataInitiatingEvents from "../dataPages/dataInitiatingEvents";
import TrainUA from "../dataPages/trainUA";
import Ccf from "../dataPages/ccf";
import DataContainer from "../../components/pageContainers/dataContainer";

export default function DataPage() {
  return (
    //routes
    <Routes>
      <Route path="" element=<DataContainer />>
        <Route path="special-events/*" element={<SpecialEvents />} />
        <Route
          path="component-reliability/*"
          element={<ComponentReliability />}
        />
        <Route path="initiating-events/*" element={<DataInitiatingEvents />} />
        <Route path="train-ua/*" element={<TrainUA />} />
        <Route path="ccf/*" element={<Ccf />} />
      </Route>
    </Routes>
  );
}
