import { logicalStyle } from "@elastic/eui";
import { EuiButtonIconPropsForButton } from "@elastic/eui/src/components/button/button_icon/button_icon";
import {
  ButtonWithClosablePopover,
  ButtonWithPopoverProps,
} from "../buttons/ButtonWithPopover";
import { ToTitleCase } from "../../../utils/StringUtils";
import {
  TypedModelActionForm,
  ItemFormProps,
} from "../forms/typedModelActionForm";
import { GenericListItemProps } from "./GenericListItem";
import { ListItemContextMenu } from "./ListItemContextMenu";

export type ListItemActionProps = NonNullable<unknown> &
  ButtonWithPopoverProps &
  Omit<EuiButtonIconPropsForButton, "iconType"> &
  ItemFormProps;

export function ListItemContextMenuButton(
  props: GenericListItemProps,
): JSX.Element {
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

export function ListItemEditAction({
  itemName,
  patchFunction,
  patchEndpoint,
  ...rest
}: ListItemActionProps): JSX.Element {
  const label = ToTitleCase(itemName);

  const scaffolding = (child: JSX.Element): JSX.Element => (
    <div style={logicalStyle("max-width", 260)}>{child}</div>
  );

  return (
    <ButtonWithClosablePopover
      closeProp="onCancel"
      popoverExtra={scaffolding}
      iconType="documentEdit"
      isIcon={true}
      aria-label="Edit Item"
      confirmDiscard={true}
      popoverProps={{
        initialFocus: "#name",
      }}
      color="text"
    >
      <TypedModelActionForm
        compressed
        noHeader
        action="edit"
        itemName={label}
        patchFunction={patchFunction}
        patchEndpoint={patchEndpoint}
      />
    </ButtonWithClosablePopover>
  );
}
