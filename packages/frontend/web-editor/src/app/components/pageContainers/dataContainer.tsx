import { Outlet } from "react-router-dom";
import {
  EuiPageBody,
  EuiPage,
  EuiPageSidebar, EuiPageTemplate
} from "@elastic/eui";
import ModelSidenav from "../sidenavs/modelSidenav";
import DataSidenav from "../sidenavs/dataSidenav";

export default function DataContainer() {
  return (
    <>
    <EuiPageTemplate panelled={false} offset={48} grow={true} restrictWidth={false}>
      <EuiPageTemplate.Sidebar
        paddingSize="s"
        sticky
        minWidth={320}
        responsive={[]}
      >
        <DataSidenav/>
      </EuiPageTemplate.Sidebar>
      <Outlet />
    </EuiPageTemplate>
    </>
  );
};