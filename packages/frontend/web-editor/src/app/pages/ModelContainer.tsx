import { Outlet } from "react-router-dom";
import {
  EuiPageBody,
  EuiPage,
  EuiPageSidebar,
} from '@elastic/eui';
import ModelSidenav from "../components/sidenavs/modelSidenav";

export default () => {
  return (
    <EuiPage
      grow={true}
      paddingSize="none"
      direction="row"
    >
      <EuiPageSidebar
        paddingSize="s"
        sticky
        minWidth={300}
        responsive={["xs"]}
      >
        <ModelSidenav
          isNavOpen={false}
          onNavToggle={function (isOpen: boolean): void {throw new Error("Function not implemented.");}}
        />
      </EuiPageSidebar>
      <EuiPageBody
        paddingSize="none"
        panelled={false}
      >
        <Outlet />
      </EuiPageBody>
    </EuiPage>
  );
};
