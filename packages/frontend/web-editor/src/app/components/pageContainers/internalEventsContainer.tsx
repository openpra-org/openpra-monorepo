import { Outlet } from "react-router-dom";
import { EuiPageTemplate } from "@elastic/eui";
import ScopedNav from "../sidenavs/scopedNav";
import PinnableScopedNav from "../sidenavs/PinnableScopedNav";

export default () => (
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
