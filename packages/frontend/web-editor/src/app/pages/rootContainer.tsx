import { Outlet, useLocation } from "react-router-dom";
import RootHeader from "../components/headers/rootHeader";
import ApiManager from "shared-types/src/lib/api/ApiManager";
import { useEffect, useRef, useState } from "react";

export default function RootContainer() {
  const [isLoggedIn, setIsLoggedIn] = useState(ApiManager.isLoggedIn());
  const timer = useRef(ApiManager.getTokenTimer());
  const location = useLocation();

  useEffect(() => {
    setIsLoggedIn(ApiManager.isLoggedIn());
    timer.current = ApiManager.getTokenTimer();
    //console.log(timer.current)

    const interval = setInterval(() => {
      // Code inside this block will be executed at the specified interval in ms
      setIsLoggedIn(ApiManager.isLoggedIn());
      timer.current = ApiManager.getTokenTimer();
      //console.log(timer.current)
    }, 30000);

    // Code inside this block will be executed when the component unmounts or the dependency changes.
    return () => {
      clearInterval(interval);
    };
  }, [location.pathname]); //redoes everytime window changes as well

  //conditional if not logged in don't render the header yet, as it lets people freely navigate
  if (!isLoggedIn && location.pathname == "/") {
    return <Outlet />;
  } else {
    return (
      <>
        <RootHeader />
        <Outlet />
      </>
    );
  }
}
