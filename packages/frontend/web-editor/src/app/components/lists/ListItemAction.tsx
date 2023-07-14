import { logicalStyle } from "@elastic/eui";
import { EuiButtonIconPropsForButton } from "@elastic/eui/src/components/button/button_icon/button_icon";
import ButtonWithPopover, { ButtonWithClosablePopover, ButtonWithPopoverProps } from "../buttons/ButtonWithPopover";
import { toTitleCase } from "../../../utils/StringUtils";
import ItemFormAction, { ItemFormProps } from "../forms/ItemFormAction";
import ListItemActionContextMenu from "./ListItemContextMenu";
import { GenericListItemProps } from "../lists/GenericListItem";

export type ListItemActionProps = {

} & ButtonWithPopoverProps & Omit<EuiButtonIconPropsForButton, "iconType"> & ItemFormProps;



export function ListItemContextMenuButton(props: GenericListItemProps) {

  return (
    <ButtonWithPopover
      iconType="gear"
      isIcon={true}
      aria-label="Edit Item"
      confirmDiscard={false}
      popoverProps={{
        initialFocus: "#name",
        panelPaddingSize: "s",
      }}
      color="text"
    >
      <ListItemActionContextMenu {...props} />
    </ButtonWithPopover>
  );
}

export default function ListItemAction() {

}

export function ListItemEditAction({ itemName, endpoint, ...rest }: ListItemActionProps) {
  const label = toTitleCase(itemName);

  const scaffolding = (child: JSX.Element) => {
    return (
      <div style={logicalStyle('max-width', 260)}>
        {child}
      </div>
    );
  }

  return (
    <ButtonWithClosablePopover
      closeProp="onCancel"
      popoverExtra={scaffolding}
      iconType="documentEdit"
      isIcon={true}
      aria-label="Edit Item"
      confirmDiscard={true}
      popoverProps={{
        initialFocus: "#name"
      }}
      color="text"
    >
      <ItemFormAction compressed noHeader action="edit" itemName={label} endpoint={endpoint} />
    </ButtonWithClosablePopover>
  );
}






