import axios from "axios";
import {
  createBrowserRouter,
  RouteObject,
  RouterProvider,
} from "react-router-dom";
import { ReactElement } from "react";
import { ThemeProvider } from "./theme/ThemeProvider";
import { ErrorPage } from "./pages/errorPage";
import { InternalEventsPage } from "./pages/routingPages/internalEventsPage";
import { InternalHazardsPage } from "./pages/routingPages/internalHazardsPage";
import { ExternalHazardsPage } from "./pages/routingPages/externalHazardsPage";
import { RootContainer } from "./pages/rootContainer";
import { DataPage } from "./pages/routingPages/dataAnalysisPage";
import { FullScopePage } from "./pages/routingPages/fullScope";
import { LoginPage } from "./pages/LandingPage";
import { SettingsPage } from "./pages/routingPages/settingsPage";

// Axios interceptor setup
axios.interceptors.request.use((req) => {
  console.log("Inside request interceptor: " + req);
  return req; // Ensure the request config is returned
});
axios.interceptors.response.use(
  (response) => {
    console.log("Inside response interceptor: ", response);
    return response; // Ensure the response is returned
  },
  (error) => {
    console.error("Response error: ", error);
    return Promise.reject(error); // Handle the error
  },
);
axios
  .get("https://jsonplaceholder.typicode.com/todos/1")
  .then((response) => console.log(response.data))
  .catch((error) => console.error(error));

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
            element: <LoginPage />,
          },
          {
            path: "internal-events/*",
            element: <InternalEventsPage />,
          },
          {
            path: "internal-hazards/*",
            element: <InternalHazardsPage />,
          },
          {
            path: "external-hazards/*",
            element: <ExternalHazardsPage />,
          },
          {
            path: "full-scope/*",
            element: <FullScopePage />,
          },
          {
            path: "about",
            element: <>about</>,
          },
          {
            path: "data-analysis/*",
            element: <DataPage />,
          },
          {
            path: "physical-security/*",
            element: <>WIP</>,
          },
          {
            path: "cybersecurity/*",
            element: <>WIP</>,
          },
          {
            path: "settings/*",
            element: <SettingsPage />,
          },
        ],
      },
    ],
  },
];

const router = createBrowserRouter(routes, {
  future: {
    // Normalize `useNavigation()`/`useFetcher()` `formMethod` to uppercase
    v7_normalizeFormMethod: true,
  },
});

function App(): ReactElement {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

export { App };
