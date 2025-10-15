/* eslint-disable import/no-default-export */
import React from "react";

import { useEventTreeContextMenuClick } from "../../hooks/eventTree/useEventTreeContextMenuClick";

export interface TreeNodeContextMenuProps {
  id: string;
  top: number | false | undefined;
  left: number | false | undefined;
  right: number | false | undefined;
  bottom: number | false | undefined;
  onClick?: () => void;
}

export default function EventTreeNodeContextMenu({
  id,
  top,
  left,
  right,
  bottom,
  ...props
}: TreeNodeContextMenuProps): JSX.Element {
  const { handleContextMenuClick } = useEventTreeContextMenuClick(id);
  return <div onClick={handleContextMenuClick}>awdawdwd </div>;
}
