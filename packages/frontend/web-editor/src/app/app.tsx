import {createBrowserRouter, RouteObject, RouterProvider} from 'react-router-dom';
import ThemeProvider from "./theme/ThemeProvider";
import LandingPage from "./pages/landingPage";
import RootContainer from "./pages/rootContainer";
import ErrorPage from "./pages/errorPage";
import ModelsPage from "./pages/modelsPage";
import NewModelsPage from "./pages/newModelsPage"
import DataPage from "./pages/dataPage"
import OverviewPage from './pages/modelPages/overveiwPage';
import FaultTrees from './pages/modelPages/faultTrees';
import BayesianNetworks from './pages/modelPages/bayesianNetworks';
import ModelGlobalParameters from './pages/modelPages/modelGlobalParameters';
import QuantificationHistory from './pages/modelPages/quantificationHistory';
import ModelSettings from './pages/modelPages/modelSettings';
import EventSequenceDiagrams from './pages/modelPages/eventSequenceDiagrams';
import InitiatingEvents from './pages/modelPages/initiatingEvents';
import EventTrees from './pages/modelPages/eventTrees';
import CcfGroups from './pages/modelPages/ccfGroups';
import BasicEvents from './pages/modelPages/basicEvents';
import ModelGates from './pages/modelPages/modelGates';
import DataInitiatingEvents from './pages/dataPages/dataInitiatingEvents';
import ComponentReliability from './pages/dataPages/componentReliability';
import SpecialEvents from './pages/dataPages/specialEvents';
import Ccf from './pages/dataPages/ccf';
import TrainUA from './pages/dataPages/trainUA';

const routes: RouteObject[] = [
    {
        path: "/",
        element: <RootContainer />,
        errorElement: <ErrorPage />,
        children: [
            {
                children: [
                    {
                        path: "",
                        element: <LandingPage />,
                    },
                    {
                        path: "about",
                        element: <>about</>,
                    },
                    {
                        path: "models",
                        element: <ModelsPage />,
                    },
                    {
                        path: "model/new",
                        element: <NewModelsPage />
                    },
                    {
                        path: 'data',
                        element: <DataPage />
                    },
                    {
                        path: 'model/1/overview',
                        element: <OverviewPage />
                    },
                    {
                        path: 'model/1/eventsequencediagrams',
                        element: <EventSequenceDiagrams />
                    },
                    {
                        path: 'model/1/faulttrees',
                        element: <FaultTrees />
                    },
                    {
                        path: 'model/1/bayesiannetworks',
                        element: <BayesianNetworks />
                    },
                    {
                        path: 'model/1/globalParameters',
                        element: <ModelGlobalParameters />
                    },
                    {
                        path: 'model/1/quantificationhistory',
                        element: <QuantificationHistory />
                    },
                    {
                        path: 'model/1/settings',
                        element: <ModelSettings />
                    },
                    {
                        path: 'model/1/initiatingevents',
                        element: <InitiatingEvents />
                    },
                    {
                        path: 'model/1/eventtrees',
                        element: <EventTrees />
                    },
                    {
                        path: 'model/1/gates',
                        element: <ModelGates />
                    },
                    {
                        path: 'model/1/basicevents',
                        element: <BasicEvents />
                    },
                    {
                        path: 'model/1/ccfgroups',
                        element: <CcfGroups />
                    },
                    {
                        path: 'data/specialevents',
                        element: <SpecialEvents />
                    },
                    {
                        path: 'data/componentreliability',
                        element: <ComponentReliability />
                    },
                    {
                        path: 'data/initiatingevents',
                        element: <DataInitiatingEvents />
                    },
                    {
                        path: 'data/trainua',
                        element: <TrainUA />
                    },
                    {
                        path: 'data/ccf',
                        element: <Ccf />
                    },
                ]
            }
        ],
    },
];

const router = createBrowserRouter(routes, {
    future: {
        // Normalize `useNavigation()`/`useFetcher()` `formMethod` to uppercase
        v7_normalizeFormMethod: true,
    },
});

export function App() {
  return (
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
  );
}

export default App;
