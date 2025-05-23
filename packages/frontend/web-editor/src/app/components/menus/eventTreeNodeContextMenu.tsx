import { useEventTreeContextMenuClick } from "../../hooks/eventTree/useEventTreeContextMenuClick";

export interface treeNodeContextMenuProps {
  id: string;
  top: number | false | undefined;
  left: number | false | undefined;
  right: number | false | undefined;
  bottom: number | false | undefined;
  onClick?: () => void;
}

export default function EventTreeNodeContextMenu({ id, top, left, right, bottom, ...props }: treeNodeContextMenuProps) {
  const { handleContextMenuClick } = useEventTreeContextMenuClick(id);
  return <div onClick={handleContextMenuClick}>awdawdwd </div>;
}
