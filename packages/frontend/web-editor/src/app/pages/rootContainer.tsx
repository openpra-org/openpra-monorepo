import {Outlet, useLocation} from "react-router-dom";
import RootHeader from "../components/headers/rootHeader";
import ApiManager from "shared-types/src/lib/api/ApiManager";
import { useEffect, useState } from "react";

export default function RootContainer() {

  const [isLoggedIn, setIsLoggedIn] = useState(ApiManager.isLoggedIn());
  const location = useLocation();

  useEffect(() => {
    setIsLoggedIn(ApiManager.isLoggedIn());
  }, [location.pathname]); //redoes everytime window changes, temp fix this isnt incredibly optional

  //conditional if not logged in don't render the header yet, as it lets people freely navigate
  if(!isLoggedIn && location.pathname == '/'){
    return (
        <>
      <Outlet/>
          </>
    )
  }

  //otherwise return the outlet with the rootheader
  return (
    <>
      <RootHeader/>
      <Outlet />
    </>
  );
}
