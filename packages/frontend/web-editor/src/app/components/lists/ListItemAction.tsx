import { logicalStyle } from "@elastic/eui";
import { EuiButtonIconPropsForButton } from "@elastic/eui/src/components/button/button_icon/button_icon";
import ButtonWithPopover, { ButtonWithClosablePopover, ButtonWithPopoverProps } from "../buttons/ButtonWithPopover";
import { toTitleCase } from "../../../utils/StringUtils";
import ItemFormAction, { ItemFormProps } from "../forms/typedModelActionForm";
import ListItemActionContextMenu from "./ListItemContextMenu";
import { GenericListItemProps } from "../lists/GenericListItem";
import TypedModelApiManager from "packages/shared-types/src/lib/api/TypedModelApiManager";

export type ListItemActionProps = {

} & ButtonWithPopoverProps & Omit<EuiButtonIconPropsForButton, "iconType"> & ItemFormProps;



export function ListItemContextMenuButton(props: GenericListItemProps) {

  return (
    <ButtonWithPopover
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
      <ListItemActionContextMenu {...props} />
    </ButtonWithPopover>
  );
}

export default function ListItemAction() {

}

//TODO 
export function ListItemEditAction({ itemName, patchEndpoint, ...rest }: ListItemActionProps) {
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
      <ItemFormAction compressed noHeader action="edit" itemName={label} patchEndpoint={TypedModelApiManager.patchInternalEvent} />
    </ButtonWithClosablePopover>
  );
}






