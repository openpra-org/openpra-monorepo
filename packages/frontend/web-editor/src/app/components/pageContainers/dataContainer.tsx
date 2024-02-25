import { Outlet } from "react-router-dom";
import { EuiPageTemplate } from "@elastic/eui";
import { DataSidenav } from "../sidenavs/dataSidenav";

function DataContainer(): JSX.Element {
  return (
    <EuiPageTemplate
      panelled={false}
      offset={48}
      grow={true}
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
}

export { DataContainer };
