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
  return (
    <>
      <RootHeader />
      <Outlet />
    </>
  );
};

export { RootContainer };
