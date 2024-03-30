import React, { useState } from "react";
import { EuiIcon, EuiSideNav, EuiText, slugify } from "@elastic/eui";
import { useNavigate } from "react-router-dom";

function NavInsideNav(): JSX.Element {
  const navigate = useNavigate();
  const [isSideNavOpenOnMobile, setIsSideNavOpenOnMobile] = useState(false);
  const [selectedItemName, setSelectedItem] = useState<string | null>(
    "Personal Data",
  );
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
  const sideNav = [
    {
      name: "General",
      id: "General",
      icon: <EuiIcon type="gear" />,
      items: [createItem("Personal Data", "personal-data", {})],
    },
    {
      name: "Authentication",
      id: "Authentication",
      icon: <EuiIcon type="gear" />,
      items: [createItem("Logins", "logins", {})],
    },
  ];
  return (
    <EuiSideNav
      aria-label="Force-open example"
      mobileTitle="Navigation"
      toggleOpenOnMobile={toggleOpenOnMobile}
      isOpenOnMobile={isSideNavOpenOnMobile}
      items={sideNav}
    />
  );
}

export { NavInsideNav };
