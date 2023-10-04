import { Outlet } from "react-router-dom";
import { EuiPageTemplate } from "@elastic/eui";
import ScopedNav from "../sidenavs/scopedNav";

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
        <ScopedNav type="InternalHazards"/>
      </EuiPageTemplate.Sidebar>
      <Outlet />
    </EuiPageTemplate>
    </>
  );
};
