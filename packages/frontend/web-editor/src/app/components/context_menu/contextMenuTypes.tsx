import React from "react";
import { EuiContextMenu, EuiContextMenuProps } from "@elastic/eui";
export interface MenuPanelItem {
  name: string;
  icon?: JSX.Element;
  panel?: number;
  onClick?: () => void | Promise<void>;
}
export interface MenuPanel {
  id: number;
  title?: string;
  items: readonly MenuPanelItem[];
}
export interface TypedContextMenuProps {
  panels: readonly MenuPanel[];
  initialPanelId?: number;
  size?: EuiContextMenuProps["size"];
  className?: string;
}
export const TypedContextMenu: React.FC<TypedContextMenuProps> = ({
  panels,
  initialPanelId = 0,
  size = "s",
  className,
}) => {
  return (
    <EuiContextMenu
      panels={panels as unknown as EuiContextMenuProps["panels"]}
      initialPanelId={initialPanelId}
      size={size}
      className={className}
    />
  );
};
