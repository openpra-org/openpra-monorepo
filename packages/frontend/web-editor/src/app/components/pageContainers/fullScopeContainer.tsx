import { EuiPageTemplate } from "@elastic/eui";
import { Outlet } from "react-router-dom";

import { ScopedNav } from "../sidenavs/scopedNav";

const FullScopeContainer = (): JSX.Element => (
  <EuiPageTemplate
    panelled={false}
    offset={0}
    grow
    restrictWidth={false}
  >
    <EuiPageTemplate.Sidebar
      paddingSize="s"
      sticky
      minWidth={320}
      responsive={[]}
    >
      <ScopedNav type="FullScope" />
    </EuiPageTemplate.Sidebar>
    <Outlet />
  </EuiPageTemplate>
);
export { FullScopeContainer };
