import {createBrowserRouter, RouteObject, RouterProvider} from 'react-router-dom';
import ThemeProvider from "./theme/ThemeProvider";
import LandingPage from "./pages/LandingPage";
import ErrorPage from "./pages/errorPage";
import ModelsPage from "./pages/ModelsPage";
import NewModelsPage from "./pages/newModelsPage"
import DataPage from "./pages/dataPage"
import OverviewPage from './pages/modelPages/overviewPage';
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
import RootContainer from "./pages/rootContainer";

const routes: RouteObject[] = [
    {
        path: "/",
        element: <RootContainer />,
        errorElement: <ErrorPage />,
        children: [
            {
                children: [
                    {
                        index: true,
                        element: <LandingPage />
                    },
                    {
                        path: "models/*",
                        element: <ModelsPage />,
                    },
                    {
                        path: "about",
                        element: <>about</>,
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
