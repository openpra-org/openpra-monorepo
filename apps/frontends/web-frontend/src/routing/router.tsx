import { createBrowserRouter, RouteObject, RouterProvider } from "react-router-dom";
import { ReactElement } from "react";
import { AuthProvider } from "../auth/AuthContext";
import { RoleContext } from "../role/roleProvider";
import { DefaultRole } from "../role/role";
import { ToastProvider } from "../toast/toastProvider";
import { ToastContainer } from "../toast/toastContainer";
import { AuthPage } from "../auth/authPage";
import { ResetPasswordPage } from "../auth/resetPassword";

const routes: RouteObject[] = [
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
  },
  {
    path: "/*",
    element: <AuthPage />,
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
