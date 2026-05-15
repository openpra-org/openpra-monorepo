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
import { AuthProvider } from "./api/auth/AuthContext";
import { PrivateRoute } from "./components/PrivateRoute";
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
            path: "invite/:inviteId/*",
            element: <InvitePage />,
          },
          {
            path: "internal-events/*",
            element: (
              <PrivateRoute>
                <InternalEventsPage />
              </PrivateRoute>
            ),
          },
          {
            path: "internal-hazards/*",
            element: (
              <PrivateRoute>
                <InternalHazardsPage />
              </PrivateRoute>
            ),
          },
          {
            path: "external-hazards/*",
            element: (
              <PrivateRoute>
                <ExternalHazardsPage />
              </PrivateRoute>
            ),
          },
          {
            path: "full-scope/*",
            element: (
              <PrivateRoute>
                <FullScopePage />
              </PrivateRoute>
            ),
          },
          {
            path: "about",
            element: (
              <PrivateRoute>
                <>about</>
              </PrivateRoute>
            ),
          },
          {
            path: "data-analysis/*",
            element: (
              <PrivateRoute>
                <DataPage />
              </PrivateRoute>
            ),
          },
          {
            path: "physical-security/*",
            element: (
              <PrivateRoute>
                <>WIP</>
              </PrivateRoute>
            ),
          },
          {
            path: "cybersecurity/*",
            element: (
              <PrivateRoute>
                <>WIP</>
              </PrivateRoute>
            ),
          },
          {
            path: "settings/*",
            element: (
              <PrivateRoute>
                <SettingsPage />
              </PrivateRoute>
            ),
          },
        ],
      },
    ],
  },
];
const router = createBrowserRouter(routes, {
  future: {
    v7_normalizeFormMethod: true,
  },
});
function App(): ReactElement {
  const ability = DefaultAbility();
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AbilityContext.Provider value={ability}>
            <RouterProvider router={router} />
            <GlobalToastList />
          </AbilityContext.Provider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
export { App };
