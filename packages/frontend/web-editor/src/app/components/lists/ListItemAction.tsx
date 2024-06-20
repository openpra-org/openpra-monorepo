import { ButtonWithClosablePopover } from "../buttons/ButtonWithPopover";
import { GenericListItemProps } from "./GenericListItem";
import { ListItemContextMenu } from "./ListItemContextMenu";

export function ListItemContextMenuButton(props: GenericListItemProps): JSX.Element {
  return (
    <ButtonWithClosablePopover
      closeProp="onCancel"
      iconType="boxesHorizontal"
      isIcon={true}
      aria-label="Edit Item"
      confirmDiscard={false}
      popoverProps={{
        initialFocus: "#name",
        panelPaddingSize: "s",
      }}
      color="text"
    >
      <ListItemContextMenu {...props} />
    </ButtonWithClosablePopover>
  );
}
