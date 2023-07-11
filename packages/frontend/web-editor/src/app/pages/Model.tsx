import { Outlet } from "react-router-dom";
import {
  EuiPageTemplate,
} from '@elastic/eui';
import ModelSidenav from "../components/smallcomponents/sidenavs/modelSidenav";

export default () => {
  return (
    <EuiPageTemplate>
      <EuiPageTemplate.Sidebar>
        <ModelSidenav isNavOpen={false} onNavToggle={function (isOpen: boolean): void {
          throw new Error("Function not implemented.");
        } }/>
      </EuiPageTemplate.Sidebar>
      <Outlet />
    </EuiPageTemplate>
  );
};
