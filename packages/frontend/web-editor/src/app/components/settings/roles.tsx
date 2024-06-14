import { EuiIcon, EuiPageTemplate, EuiSkeletonRectangle } from "@elastic/eui";
import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { GetAllRoles } from "shared-types/src/lib/api/roles/rolesApi";
import { NavInsideNav, NavItemHeader } from "../sidenavs/genericNav";
import { UseToastContext } from "../../providers/toastProvider";
import { GetESToast } from "../../../utils/treeUtils";

const Roles = (): JSX.Element => {
  const { addToast } = UseToastContext();
  const [navItems, setNavItems] = useState<NavItemHeader[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    setIsLoading(true);
    GetAllRoles([])
      .then((res) => {
        const navItems = [
          {
            name: "Predefined Roles",
            id: "General",
            icon: <EuiIcon type="gear" />,
            items: res.map((x) => {
              return {
                name: x.name,
                url: x.id.toLowerCase(),
                data: {},
              };
            }),
          },
        ];
        setNavItems(navItems);
        setIsLoading(false);
      })
      .catch((err: Error) => {
        addToast(GetESToast("danger", err.message));
        setIsLoading(false);
      });
  }, []);
  return (
    <EuiPageTemplate
      panelled={false}
      restrictWidth={true}
      paddingSize={"s"}
    >
      <EuiPageTemplate.Sidebar>
        {
          <EuiSkeletonRectangle isLoading={isLoading}>
            <NavInsideNav items={navItems} />
          </EuiSkeletonRectangle>
        }
      </EuiPageTemplate.Sidebar>
      <EuiPageTemplate.Section>
        <Outlet />
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
};

export { Roles };
