import { Outlet } from "react-router-dom";
import { EuiPageTemplate } from "@elastic/eui";
import { SidebarContent, useSidebarCollapsed, EXPANDED_WIDTH, COLLAPSED_WIDTH } from "../sidenavs/collapsibleSidebar";
const InternalHazardsContainer = (): JSX.Element => {
  const { collapsed, toggle } = useSidebarCollapsed();
  return (
    <EuiPageTemplate
      panelled={false}
      offset={0}
      grow={true}
      restrictWidth={false}
    >
      <EuiPageTemplate.Sidebar
        paddingSize="none"
        sticky
        minWidth={collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH}
        responsive={[]}
        style={{ height: "calc(100vh - var(--euiFixedHeadersOffset, 0))" }}
      >
        <SidebarContent
          type="InternalHazards"
          collapsed={collapsed}
          onToggle={toggle}
        />
      </EuiPageTemplate.Sidebar>
      <Outlet />
    </EuiPageTemplate>
  );
};
export { InternalHazardsContainer };
