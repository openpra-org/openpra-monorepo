import {createBrowserRouter, RouteObject, RouterProvider} from 'react-router-dom';
import ThemeProvider from "./theme/ThemeProvider";
import ErrorPage from "./pages/errorPage";
import InternalEventsPage from "./pages/routingPages/internalEventsPage";
import InternalHazardsPage from './pages/routingPages/internalHazardsPage';
import ExternalhazardsPage from './pages/routingPages/externalHazardsPage';
import RootContainer from "./pages/rootContainer";
import DataPage from "./pages/routingPages/dataAnalysisPage";
import FullScopePage from "./pages/routingPages/fullScope";
import LoginPage from './pages/LandingPage';

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
                        element: <LoginPage />
                    },
                    {
                        path: "internal-events/*",
                        element: <InternalEventsPage />,
                    },
                    {
                        path: "internal-hazards/*",
                        element: <InternalHazardsPage/>,
                    },
                    {
                        path: "external-hazards/*",
                        element: <ExternalhazardsPage/>
                    },
                    {
                        path: "full-scope/*",
                        element: <FullScopePage/>
                    },
                    {
                        path: "about",
                        element: <>about</>,
                    },
                    {
                        path: 'data-analysis/*',
                        element: <DataPage />
                    },
                    {
                        path: 'physical-security/*',
                        element: <>WIP</>
                    },
                    {
                        path: 'cybersecurity/*',
                        element: <>WIP</>
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
