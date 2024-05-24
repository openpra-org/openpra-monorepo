import { Outlet, useLocation } from "react-router-dom";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import { ReactElement, useEffect, useRef, useState } from "react";
import { RootHeader } from "../components/headers/rootHeader";

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
  const timer: React.MutableRefObject<number> = useRef(ApiManager.getTokenTimer());

  /**
   * The current location object, which represents where the app is now.
   */
  const location = useLocation();

  useEffect(() => {
    // Update login status and token timer on mount and when the pathname changes.
    setIsLoggedIn(ApiManager.isLoggedIn());

    // get the token time
    timer.current = ApiManager.getTokenTimer();

    // Set an interval to refresh the login status and token timer every 30 seconds.
    setInterval(() => {
      setIsLoggedIn(ApiManager.isLoggedIn());
      timer.current = ApiManager.getTokenTimer();
    }, 30000);

    // Clear the interval when the component unmounts or the dependency changes.
    return (): void => {
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [location.pathname]);

  // Render only the outlet if not logged in and on the root path.
  if (!isLoggedIn && (location.pathname === "/" || location.pathname.startsWith("/invite/"))) {
    return <Outlet />;
  } else {
    // Render the header and the outlet when logged in or not on the root path.
    return (
      <>
        <RootHeader />
        <Outlet />
      </>
    );
  }
};

export { RootContainer };
