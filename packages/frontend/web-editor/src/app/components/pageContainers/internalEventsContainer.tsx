import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { EuiPageTemplate, useIsWithinBreakpoints } from "@elastic/eui";
import ScopedNav from "../sidenavs/scopedNav";
import PinnableScopedNav from "../sidenavs/PinnableScopedNav";

export default () => {
  // variable to handle sidebar's visibility on collapsed state
  // variable to handle sidebar's visibility according to screen sizes
  const isNavCollapsed = useIsWithinBreakpoints(["xs", "s"]);
  const [isNavOpenOnCollapsed, setIsNavOpenOnCollapsed] = useState(localStorage.getItem("isNavOpenOnCollapsed"));

  useEffect(() => {
    const handleStorage = () => {
      setIsNavOpenOnCollapsed(localStorage.getItem("isNavOpenOnCollapsed"));
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [isNavOpenOnCollapsed]);

  return (
    <EuiPageTemplate
      panelled={false}
      offset={0}
      grow={true}
      restrictWidth={false}
    >
      {(!isNavCollapsed || isNavOpenOnCollapsed === "true") && (
        <EuiPageTemplate.Sidebar
          paddingSize="s"
          sticky
          minWidth={320}
          responsive={[]}
        >
          {/*<ScopedNav type="InternalEvents" />*/}
          <PinnableScopedNav />
        </EuiPageTemplate.Sidebar>
      )}
      <Outlet />
    </EuiPageTemplate>
  );
};
