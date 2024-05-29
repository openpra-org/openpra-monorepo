import { Route, Routes } from "react-router-dom";
import { SpecialEvents } from "../dataPages/specialEvents";
import { ComponentReliability } from "../dataPages/componentReliability";
import { DataInitiatingEvents } from "../dataPages/dataInitiatingEvents";
import { TrainUA } from "../dataPages/trainUA";
import { Ccf } from "../dataPages/ccf";
import { ModelMenuContainer } from "../../components/pageContainers/modelMenuContainer";

function MenuPage(): JSX.Element {
  return (
    //routes
    <Routes>
      <Route
        path=""
        element={<ModelMenuContainer />}
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
}

export { MenuPage };
