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
import DataPage from "./pages/dataPage";

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
                        path: 'data/*',
                        element: <DataPage />
                    }
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
