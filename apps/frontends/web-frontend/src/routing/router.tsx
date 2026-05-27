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
import { PosDemoPage } from "../pos-demo/posDemoPage";
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
    path: "/pos-demo",
    element: (
      <ProtectedRoute>
        <PosDemoPage />
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
