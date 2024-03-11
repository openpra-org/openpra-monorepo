import { Outlet } from "react-router-dom";
import { EuiPageTemplate } from "@elastic/eui";
import { ScopedNav } from "../sidenavs/scopedNav";

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
      <ScopedNav type="InternalEvents" />
    </EuiPageTemplate.Sidebar>
    <Outlet />
  </EuiPageTemplate>
);

export { InternalEventsContainer };
