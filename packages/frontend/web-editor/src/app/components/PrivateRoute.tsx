import { JSX } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ApiManager } from "shared-sdk/lib/api/ApiManager";

export function PrivateRoute({ children }: { children: JSX.Element }): JSX.Element {
  const location = useLocation();

  if (!ApiManager.isLoggedIn()) {
    return (
      <Navigate
        to="/"
        state={{ from: location }}
        replace
      />
    );
  }

  return children;
}
