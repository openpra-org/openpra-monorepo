import { Outlet, useLocation } from "react-router-dom";
import { ApiManager } from "shared-sdk/lib/api/ApiManager";
import { onAuthEvent } from "shared-sdk/lib/api/AuthEvents";
import { ReactElement, useEffect, useRef, useState } from "react";
import { RootHeader } from "../components/headers/rootHeader";
import { RecentModelsPage } from "./routingPages/recentModelsPage";

/**
 * A React functional component that renders the application layout with a header and outlet for nested routes.
 * It checks if the user is logged in and updates the login status at a regular interval.
 * If the user is not logged in and is on the root path, it renders only the outlet without the header.
 *
 * @returns {@link ReactElement} The component structure to be rendered.
 */
const RootContainer = (): ReactElement => {
  /**
   * State to track if the user is logged in.
   */
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(ApiManager.isLoggedIn());

  /**
   * A ref to store the token timer returned by the ApiManager.
   */
  const tokenTimerRef: React.MutableRefObject<number> = useRef(ApiManager.getTokenTimer());

  /**
   * The current location object, which represents where the app is now.
   */
  const location = useLocation();

  useEffect(() => {
    // On mount, initialize auth state and token timer
    setIsLoggedIn(ApiManager.isLoggedIn());
    tokenTimerRef.current = ApiManager.getTokenTimer();

    // Subscribe to auth changes for immediate UI updates
    const unsubscribe = onAuthEvent((evt) => {
      if (evt.type === "login") {
        setIsLoggedIn(true);
        tokenTimerRef.current = ApiManager.getTokenTimer();
      } else if (evt.type === "logout") {
        setIsLoggedIn(false);
        tokenTimerRef.current = ApiManager.getTokenTimer();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Render only the outlet if not logged in and on the root path.
  if (!isLoggedIn && (location.pathname === "/" || location.pathname.startsWith("/invite/"))) {
    return <Outlet />;
  } else {
    // When logged in and at root, show recent models page instead of login
    const atRoot = location.pathname === "/";
    return (
      <>
        <RootHeader />
        {atRoot ? <RecentModelsPage /> : <Outlet />}
      </>
    );
  }
};

export { RootContainer };
