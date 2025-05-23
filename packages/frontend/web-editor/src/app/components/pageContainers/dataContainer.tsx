import { EuiPageTemplate } from "@elastic/eui";
import { Outlet } from "react-router-dom";

import { DataSidenav } from "../sidenavs/dataSidenav";

const DataContainer = (): JSX.Element => {
  return (
    <EuiPageTemplate
      panelled={false}
      offset={48}
      grow
      restrictWidth={false}
    >
      <EuiPageTemplate.Sidebar
        paddingSize="s"
        sticky
        minWidth={320}
        responsive={[]}
      >
        <DataSidenav />
      </EuiPageTemplate.Sidebar>
      <Outlet />
    </EuiPageTemplate>
  );
};

export { DataContainer };
