import { Outlet } from "react-router-dom";
import { ReactElement } from "react";
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
      {/*<RootHeader />*/}
      <h2>i am root</h2>
      <Outlet />
    </>
  );
};

export { RootContainer };
