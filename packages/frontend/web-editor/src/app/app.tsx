import {createBrowserRouter, RouteObject, RouterProvider} from 'react-router-dom';
import ThemeProvider from "./theme/ThemeProvider";
import LandingPage from "./pages/LandingPage";
import ErrorPage from "./pages/errorPage";
import ModelsPage from "./pages/ModelsPage";
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
