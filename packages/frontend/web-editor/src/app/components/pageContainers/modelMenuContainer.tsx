import { Outlet } from "react-router-dom";
import { EuiPageTemplate } from "@elastic/eui";
import {MenuSideNav} from "../sidenavs/menuSidenav";

function ModelMenuContainer(): JSX.Element {
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
        <MenuSideNav type="FullScope" />
      </EuiPageTemplate.Sidebar>
      <Outlet />
    </EuiPageTemplate>
  );
}

export { ModelMenuContainer };
