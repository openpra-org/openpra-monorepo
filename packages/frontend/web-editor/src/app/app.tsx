import {createBrowserRouter, RouteObject, RouterProvider} from 'react-router-dom';
import ThemeProvider from "./theme/ThemeProvider";
import LandingPage from "./pages/landingPage";
import RootContainer from "./pages/rootContainer";
import ErrorPage from "./pages/errorPage";
import ModelsPage from "./pages/modelsPage";
import ModelPage from './pages/modelPage';
import NewModelsPage from "./pages/newModelsPage"
import DataPage from "./pages/newModelsPage"
import OverviewPage from './pages/overveiwPage';
import EventSequence from './pages/eventSequences';
import FaultTrees from './pages/faultTrees';
import BayesianNetworks from './pages/bayesianNetworks';
import ModelGlobalParameters from './pages/modelGlobalParameters';
import QuantificationHistory from './pages/quantificationHistory';
import ModelSettings from './pages/modelSettings';

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
                        path: 'model/1',
                        element: <ModelPage />
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
                        path: 'model/1/eventsequence',
                        element: <EventSequence />
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
