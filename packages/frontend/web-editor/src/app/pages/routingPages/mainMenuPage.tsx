import { Route, Routes } from "react-router-dom";
import { ModelMenuContainer } from "../../components/pageContainers/modelMenuContainer";

function MenuPage(): JSX.Element {
  return (
    //routes
    <Routes>
      <Route
        path=""
        element={<ModelMenuContainer />}
      >
      </Route>
    </Routes>
  );
}

export { MenuPage };
