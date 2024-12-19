import { createBrowserRouter, RouteObject, RouterProvider } from "react-router-dom";
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
import { ToastProvider } from "./providers/toastProvider";
import { GlobalToastList } from "./components/lists/globalToastList";
import { InvitePage } from "./pages/invitePage";
import { AbilityContext } from "./providers/abilityProvider";
import { DefaultAbility } from "./casl/ability";
import { OidcCallback } from "./components/login/OidcCallback";

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
            path: "/callback",
            element: <OidcCallback />,
          },
          {
            path: "invite/:inviteId/*",
            element: <InvitePage />,
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
  const ability = DefaultAbility();
  return (
    <ThemeProvider>
      <ToastProvider>
        <AbilityContext.Provider value={ability}>
          <RouterProvider router={router} />
          <GlobalToastList />
        </AbilityContext.Provider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export { App };
