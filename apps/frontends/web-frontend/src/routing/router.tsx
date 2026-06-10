import { createBrowserRouter, Navigate, RouteObject, RouterProvider } from "react-router-dom";
import { JSX, ReactElement, useEffect } from "react";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import { RoleContext } from "../role/roleProvider";
import { DefaultRole } from "../role/role";
import { ToastProvider } from "../toast/toastProvider";
import { ToastContainer } from "../toast/toastContainer";
import { AuthPage } from "../auth/authPage";
import { OAuthCallbackPage } from "../auth/oauthCallback";
import { ResetPasswordPage } from "../auth/resetPassword";
import { WelcomePage } from "../welcome/welcomePage";
import { ProjectsPage } from "../projects/projectsPage";
import { ProjectWorkspacePage } from "../projects/projectWorkspacePage";
import { PosDemoPage } from "../pos-workbooks/posDemoPage";
import { PosWorkbookPage } from "../pos-workbooks/posWorkbookPage";
import { IeDemoPage } from "../ie-workbooks/ieDemoPage";
import { IeWorkbookPage } from "../ie-workbooks/ieWorkbookPage";
import { EsDemoPage } from "../es-workbooks/esDemoPage";
import { EsWorkbookPage } from "../es-workbooks/esWorkbookPage";
import { ScDemoPage } from "../sc-workbooks/scDemoPage";
import { ScWorkbookPage } from "../sc-workbooks/scWorkbookPage";
import { SyDemoPage } from "../sy-workbooks/syDemoPage";
import { SyWorkbookPage } from "../sy-workbooks/syWorkbookPage";
import { HrDemoPage } from "../hr-workbooks/hrDemoPage";
import { HrWorkbookPage } from "../hr-workbooks/hrWorkbookPage";
import { DaDemoPage } from "../da-workbooks/daDemoPage";
import { DaWorkbookPage } from "../da-workbooks/daWorkbookPage";
import { ProfilePage } from "../profile/profilePage";
import { SettingsPage } from "../settings/settingsPage";
import { TeamPage } from "../teams/teamPage";
import { UserProfilePage } from "../users/userProfilePage";
import { applyAppearance, loadStoredAppearance } from "../settings/useAppearancePrefs";

function ProtectedRoute({ children }: { children: JSX.Element }): JSX.Element {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

const routes: RouteObject[] = [
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
  },
  {
    path: "/auth/*",
    element: <AuthPage />,
  },
  {
    path: "/oauth/callback",
    element: <OAuthCallbackPage />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <WelcomePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/projects",
    element: (
      <ProtectedRoute>
        <ProjectsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/projects/:id",
    element: (
      <ProtectedRoute>
        <ProjectWorkspacePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/pos-workbooks/example",
    element: (
      <ProtectedRoute>
        <PosDemoPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/pos-workbooks/:id",
    element: (
      <ProtectedRoute>
        <PosWorkbookPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ie-workbooks/example",
    element: (
      <ProtectedRoute>
        <IeDemoPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ie-workbooks/:id",
    element: (
      <ProtectedRoute>
        <IeWorkbookPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/es-workbooks/example",
    element: (
      <ProtectedRoute>
        <EsDemoPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/es-workbooks/:id",
    element: (
      <ProtectedRoute>
        <EsWorkbookPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/sc-workbooks/example",
    element: (
      <ProtectedRoute>
        <ScDemoPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/sc-workbooks/:id",
    element: (
      <ProtectedRoute>
        <ScWorkbookPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/sy-workbooks/example",
    element: (
      <ProtectedRoute>
        <SyDemoPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/sy-workbooks/:id",
    element: (
      <ProtectedRoute>
        <SyWorkbookPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/hr-workbooks/example",
    element: (
      <ProtectedRoute>
        <HrDemoPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/hr-workbooks/:id",
    element: (
      <ProtectedRoute>
        <HrWorkbookPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/da-workbooks/example",
    element: (
      <ProtectedRoute>
        <DaDemoPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/da-workbooks/:id",
    element: (
      <ProtectedRoute>
        <DaWorkbookPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile",
    element: (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/settings",
    element: (
      <ProtectedRoute>
        <SettingsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/teams/:id",
    element: (
      <ProtectedRoute>
        <TeamPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/users/:username",
    element: (
      <ProtectedRoute>
        <UserProfilePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
];

const router = createBrowserRouter(routes, {
  future: {
    v7_normalizeFormMethod: true,
  },
});

function App(): ReactElement {
  const role = DefaultRole();
  useEffect(() => {
    applyAppearance(loadStoredAppearance());
  }, []);
  return (
    <ToastProvider>
      <AuthProvider>
        <RoleContext.Provider value={role}>
          <RouterProvider router={router} />
          <ToastContainer />
        </RoleContext.Provider>
      </AuthProvider>
    </ToastProvider>
  );
}

export { App };
