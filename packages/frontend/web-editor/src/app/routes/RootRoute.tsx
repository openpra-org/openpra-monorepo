import { createBrowserRouter, RouteObject } from "react-router-dom";
import { RootContainer } from "../pages/rootContainer";
import { ErrorPage } from "../pages/errorPage";
import { SettingsPage } from "../pages/routingPages/settingsPage";
import { PublicRoutes } from "./PublicRoutes";
import { AnalysisRoutes } from "./AnalysisRoutes";

export const RootRoute: RouteObject[] = [
  {
    path: "/",
    element: <RootContainer />,
    errorElement: <ErrorPage />,
    children: [
      // ...PublicRoutes,
      // ...AnalysisRoutes,
      // {
      //   children: [
      //     {
      //       path: "settings/*",
      //       element: <SettingsPage />,
      //     },
      //   ],
      // },
    ],
  },
];

export const BrowserRouter = createBrowserRouter(RootRoute, {
  future: {
    // Normalize `useNavigation()`/`useFetcher()` `formMethod` to uppercase
    v7_normalizeFormMethod: true,
  },
});

BrowserRouter;
