import { Route, Routes } from "react-router-dom";
import { InitiatingEventsList } from "../../components/lists/nestedLists/initiatingEventsList";

export function InitiatingEvents(): JSX.Element {
  return (
    <Routes>
      <Route path="" element={<InitiatingEventsList />} />
    </Routes>
  );
}
