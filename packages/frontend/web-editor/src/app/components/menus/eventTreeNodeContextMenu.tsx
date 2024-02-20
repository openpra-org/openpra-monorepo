import React from "react";
import { Position } from "reactflow";

import { useEventTreeContextMenuClick } from "../../hooks/eventTree/useEventTreeContextMenuClick";

export type treeNodeContextMenuProps = {
  id: string;
  top: Position.Top | undefined;
  left: any;
  right: any;
  bottom: any;
  onClick?: () => void;
};

export default function EventTreeNodeContextMenu({
  id,
  top,
  left,
  right,
  bottom,
  ...props
}: treeNodeContextMenuProps) {
  const { handleContextMenuClick } = useEventTreeContextMenuClick(id);
  return <div onClick={handleContextMenuClick}>awdawdwd </div>;
}
