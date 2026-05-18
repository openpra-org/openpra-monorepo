import { createBrowserRouter, Navigate, RouteObject, RouterProvider } from "react-router-dom";
import { JSX, ReactElement } from "react";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import { RoleContext } from "../role/roleProvider";
import { DefaultRole } from "../role/role";
import { ToastProvider } from "../toast/toastProvider";
import { ToastContainer } from "../toast/toastContainer";
import { AuthPage } from "../auth/authPage";
import { ResetPasswordPage } from "../auth/resetPassword";
import { WelcomePage } from "../welcome/welcomePage";
import { ProjectsPage } from "../projects/projectsPage";
import { ProfilePage } from "../profile/profilePage";
import { SettingsPage } from "../settings/settingsPage";

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
