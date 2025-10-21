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
  top: _top,
  left: _left,
  right: _right,
  bottom: _bottom,
  ..._props
}: TreeNodeContextMenuProps): JSX.Element {
  const { handleContextMenuClick } = useEventTreeContextMenuClick(id);
  return <div onClick={handleContextMenuClick}>awdawdwd </div>;
}
