import { EuiPageTemplate } from "@elastic/eui";
import { Outlet } from "react-router-dom";

import { ScopedNav } from "../sidenavs/scopedNav";

const ExternalHazardsContainer = (): JSX.Element => (
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
      <ScopedNav type="ExternalHazards" />
    </EuiPageTemplate.Sidebar>
    <Outlet />
  </EuiPageTemplate>
);

export { ExternalHazardsContainer };
