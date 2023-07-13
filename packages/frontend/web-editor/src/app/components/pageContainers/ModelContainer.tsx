import { Outlet } from "react-router-dom";
import {
  EuiPageBody,
  EuiPage,
  EuiPageSidebar, EuiPageTemplate
} from "@elastic/eui";
import ModelSidenav from "../sidenavs/modelSidenav";

export default () => {
  return (
    <>
    <EuiPageTemplate panelled={false} offset={48} grow={true} restrictWidth={false}>
      <EuiPageTemplate.Sidebar
        paddingSize="s"
        sticky
        minWidth={320}
        responsive={[]}
      >
        <ModelSidenav />
      </EuiPageTemplate.Sidebar>
      <Outlet />
    </EuiPageTemplate>
    </>
  );
};
