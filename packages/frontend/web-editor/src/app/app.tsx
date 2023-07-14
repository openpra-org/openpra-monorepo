import {createBrowserRouter, RouteObject, RouterProvider} from 'react-router-dom';
import ThemeProvider from "./theme/ThemeProvider";
import LandingPage from "./pages/LandingPage";
import ErrorPage from "./pages/errorPage";
import ModelsPage from "./pages/ModelsPage";
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
                        path: 'data-analysis/*',
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
