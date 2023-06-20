import {createBrowserRouter, RouteObject, RouterProvider} from 'react-router-dom';
import ThemeProvider from "./theme/ThemeProvider";
import LandingPage from "./pages/landingPage";
import RootContainer from "./pages/rootContainer";
import ErrorPage from "./pages/errorPage";
import ModelsPage from "./pages/modelsPage";
import ModelPage from './pages/modelPage';
import NewModelsPage from "./pages/newModelsPage"
import React from "react";

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
