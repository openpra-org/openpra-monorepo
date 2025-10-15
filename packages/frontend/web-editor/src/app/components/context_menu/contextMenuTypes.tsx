import React from "react";
import { EuiContextMenu, EuiContextMenuProps } from "@elastic/eui";

/**
 * Local, stricter versions of EUI context menu descriptor types to avoid any leakage
 * and concentrate the only type assertion boundary inside TypedContextMenu.
 */
export interface MenuPanelItem {
  name: string;
  icon?: JSX.Element;
  panel?: number; // navigate to panel id
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

/**
 * Wrapper that narrows panels to our stricter shape while casting once into EUI's looser types.
 * This prevents repetitive unsafe assignments in each menu file.
 */
export const TypedContextMenu: React.FC<TypedContextMenuProps> = ({
  panels,
  initialPanelId = 0,
  size = "s",
  className,
}) => {
  return (
    <EuiContextMenu
      // Single, contained assertion: we know our descriptors satisfy EUI expectations.
      panels={panels as unknown as EuiContextMenuProps["panels"]}
      initialPanelId={initialPanelId}
      size={size}
      className={className}
    />
  );
};
