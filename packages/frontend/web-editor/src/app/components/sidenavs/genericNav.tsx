import React, { useState } from "react";
import { EuiSideNav } from "@elastic/eui";
import { useNavigate } from "react-router-dom";

interface NavItemHeader {
  name: string;
  id: string;
  icon: JSX.Element;
  items: NavItem[];
}

interface NavItem {
  name: string;
  url: string;
  data: object;
}

function NavInsideNav({ items }: { items: NavItemHeader[] }): JSX.Element {
  const navigate = useNavigate();
  const [isSideNavOpenOnMobile, setIsSideNavOpenOnMobile] = useState(false);
  const [selectedItemName, setSelectedItem] = useState<string | null>("Personal Data");
  const toggleOpenOnMobile = (): void => {
    setIsSideNavOpenOnMobile(!isSideNavOpenOnMobile);
  };
  const selectItem = (name: string): void => {
    setSelectedItem(name);
  };
  const createItem = (
    name: string,
    url: string,
    data = {},
  ): { id: string; name: string; isSelected: boolean; onClick: () => void } =>
    // NOTE: Duplicate `name` values will cause `id` collisions.
    ({
      id: name,
      name,
      isSelected: selectedItemName === name,
      onClick: (): void => {
        selectItem(name);
        navigate(url);
      },
      ...data,
    });

  const navItems = items.map((headerItem) => ({
    name: headerItem.name,
    id: headerItem.id,
    icon: headerItem.icon,
    items: headerItem.items.map((navItem) => createItem(navItem.name, navItem.url, navItem.data)),
  }));
  return (
    <EuiSideNav
      aria-label="Force-open example"
      mobileTitle="Navigation"
      toggleOpenOnMobile={toggleOpenOnMobile}
      isOpenOnMobile={isSideNavOpenOnMobile}
      items={navItems}
    />
  );
}

export { NavInsideNav, NavItem, NavItemHeader };
