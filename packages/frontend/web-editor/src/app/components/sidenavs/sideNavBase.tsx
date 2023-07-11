import { EuiSideNav, EuiSideNavItemType } from '@elastic/eui';

interface NavItem {
  id: string;
  title?: string;
  items?: NavItem[];
  label?: string;
  icon?: JSX.Element;
  href?: string;
}

interface SideNavProps {
  navItems: NavItem[];
}

export default function SideNavBase({ navItems }: SideNavProps) {
  const convertNavItemsToEuiSideNav = (items: NavItem[]): EuiSideNavItemType<any>[] => {
    return items.map((item) => {
      if (item.items) {
        return {
          id: item.id,
          name: item.title,
          items: convertNavItemsToEuiSideNav(item.items),
        };
      } else {
        return {
          id: item.id,
          name: item.title,
        };
      }
    });
  };

  const sideNavItems = convertNavItemsToEuiSideNav(navItems);

  return (
    <EuiSideNav
      items={sideNavItems}
      style={{eight: "100%", width: '335px' }}
      mobileTitle="Navigation"
      toggleOpenOnMobileText="Toggle navigation"
      isOpenOnMobile={true}
    />
  );
}
