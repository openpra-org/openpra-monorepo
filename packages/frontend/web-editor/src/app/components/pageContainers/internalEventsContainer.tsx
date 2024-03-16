import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
// import {
//   // EuiPage,
//   // EuiResizableContainer,
//   // useIsWithinBreakpoints,
//   // EuiPageSection,
// } from "@elastic/eui";
// import { EuiResizablePanel } from "@elastic/eui/src/components/resizable_container/resizable_panel";
// import ScopedNav from "../sidenavs/scopedNav";
import { EuiPageTemplate } from "@elastic/eui";
// import { ScopedNav } from "../sidenavs/scopedNav";
import PinnableScopedNav from "../sidenavs/PinnableScopedNav";

export default () => {
  // variable to handle sidebar's visibility on collapsed state
  // variable to handle sidebar's visibility according to screen sizes
  // const isNavCollapsed = useIsWithinBreakpoints(["xs", "s"]);
  const [isNavOpenOnCollapsed, setIsNavOpenOnCollapsed] = useState(
    localStorage.getItem("isNavOpenOnCollapsed"),
  );

  useEffect(() => {
    const handleStorage = () => {
      setIsNavOpenOnCollapsed(localStorage.getItem("isNavOpenOnCollapsed"));
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [isNavOpenOnCollapsed]);
  // const isMobile = useIsWithinBreakpoints(["xs", "s"]);
  // const style = isMobile ? { height: "100%" } : { minHeight: "100%" };

  return (
    <Outlet />
  );
};
const InternalEventsContainer = (): JSX.Element => (
  <EuiPageTemplate
    panelled={false}
    offset={0}
    grow={true}
    restrictWidth={false}
  >
    <EuiPageTemplate.Sidebar
      paddingSize="s"
      sticky
      minWidth={320}
      responsive={[]}
    >
      {/*<ScopedNav type="InternalEvents" />*/}
      <PinnableScopedNav />
    </EuiPageTemplate.Sidebar>
    <Outlet />
  </EuiPageTemplate>
);

export { InternalEventsContainer };
