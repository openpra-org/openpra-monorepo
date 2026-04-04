import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ApiManager } from "shared-sdk/lib/api/ApiManager";
import { onAuthEvent } from "shared-sdk/lib/api/AuthEvents";
import { ReactElement, useEffect, useRef, useState } from "react";
import { RootHeader } from "../components/headers/rootHeader";
import { RecentModelsPage } from "./routingPages/recentModelsPage";

const RootContainer = (): ReactElement => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(ApiManager.isLoggedIn());

  const tokenTimerRef: React.MutableRefObject<number> = useRef(ApiManager.getTokenTimer());

  const location = useLocation();

  useEffect(() => {
    setIsLoggedIn(ApiManager.isLoggedIn());
    tokenTimerRef.current = ApiManager.getTokenTimer();

    const unsubscribe = onAuthEvent((evt) => {
      if (evt.type === "login") {
        setIsLoggedIn(true);
        tokenTimerRef.current = ApiManager.getTokenTimer();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (!isLoggedIn && (location.pathname === "/" || location.pathname.startsWith("/invite/"))) {
    return <Outlet />;
  } else if (!isLoggedIn) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  } else {
    const atRoot = location.pathname === "/";
    return (
      <>
        <RootHeader />
        {atRoot ?
          <RecentModelsPage />
        : <Outlet />}
      </>
    );
  }
};

export { RootContainer };
