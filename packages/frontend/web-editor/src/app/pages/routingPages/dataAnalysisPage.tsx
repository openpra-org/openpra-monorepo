import { Route, Routes } from "react-router-dom";

import { DataContainer } from "../../components/pageContainers/dataContainer";
import { Ccf } from "../dataPages/ccf";
import { ComponentReliability } from "../dataPages/componentReliability";
import { DataInitiatingEvents } from "../dataPages/dataInitiatingEvents";
import { SpecialEvents } from "../dataPages/specialEvents";
import { TrainUA } from "../dataPages/trainUA";

const DataPage = (): JSX.Element => {
  return (
    //routes
    <Routes>
      <Route
        path=""
        element={<DataContainer />}
      >
        <Route
          path="special-events/*"
          element={<SpecialEvents />}
        />
        <Route
          path="component-reliability/*"
          element={<ComponentReliability />}
        />
        <Route
          path="initiating-events/*"
          element={<DataInitiatingEvents />}
        />
        <Route
          path="train-ua/*"
          element={<TrainUA />}
        />
        <Route
          path="ccf/*"
          element={<Ccf />}
        />
      </Route>
    </Routes>
  );
};

export { DataPage };
