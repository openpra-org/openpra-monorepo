import { Route, RouteObject, RouterProvider, Routes } from "react-router-dom";
import { LabelJSON } from "shared-types/src/lib/types/Label";

import NewModelsPage from './newModelsPage';
import Model from './Model';
import ModelList from '../components/lists/ModelList';

//   children: [
//     { path: "overview", element: <OverviewPage /> },
//     { path: "event_sequence_diagrams", element: <EventSequenceDiagrams /> },
//     { path: "fault_trees", element: <FaultTrees /> },
//     { path: "bayesian_networks", element: <BayesianNetworks /> },
//     { path: "global_parameters", element: <ModelGlobalParameters /> },
//     { path: "quantification_history", element: <QuantificationHistory /> },
//     { path: "settings", element: <ModelSettings /> },
//     { path: "initiating_events", element: <InitiatingEvents /> },
//     { path: "event_trees", element: <EventTrees /> },
//     { path: "gates", element: <ModelGates /> },
//     { path: "basic_events", element: <BasicEvents /> },
//     { path: "ccf_groups", element: <CcfGroups /> },
//   ]
// }

// const router = createBrowserRouter(routes, {
//   future: {
//     // Normalize `useNavigation()`/`useFetcher()` `formMethod` to uppercase
//     v7_normalizeFormMethod: true,
//   },
// });

const getModelFixture = (): ModelProps => {
  return ({
    label: {
      name: "Model ABC",
      description: "I am model ABC",
    },
    id: 402,
    faultTrees: [
      {
        label: {
          name: "Fault Tree 123",
          description: "I am ft 123",
        },
        id: 123
      },
      {
        label: {
          name: "Fault Tree 456",
          description: "I am ft 456",
        },
        id: 456
      }
    ]
  });
}

export type FaultTreeProps = {
  id: string | number;
  label: LabelJSON;
}

export type ModelProps = {
  id: string | number;
  label: LabelJSON;
  faultTrees: FaultTreeProps[];
}
export async function loadModel() {
  return getModelFixture();
}

export default function ModelsPage() {
  return (
    <>
    <Routes>
      <Route path="" element=<ModelList/> />
      <Route path="new" element=<NewModelsPage/> />
      <Route
        path=":modelId"
        element=<Model/>
        loader={loadModel}
      />
    </Routes>
    </>
  );
}
