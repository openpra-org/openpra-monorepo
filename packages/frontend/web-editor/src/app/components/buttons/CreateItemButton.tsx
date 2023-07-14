import ButtonWithPopover, { ButtonWithClosablePopover } from "./ButtonWithPopover";
import { EuiFlexGroup, EuiFlexItem, logicalStyle } from "@elastic/eui";
import { toTitleCase } from "../../../utils/StringUtils";
import ItemFormAction, { ItemFormProps } from "../forms/ItemFormAction";
import { useEffect, useState } from "react";

export type CreateItemButtonProps = {

} & Omit<ItemFormProps, "action">;

/**
 *
 * @param itemName the type of item that is being passed
 * @param endpoint endpoint that will be used to add the item
 * @returns the create item button
 */
export default function CreateItemButton({ itemName, endpoint }: CreateItemButtonProps) {


  const popoverExtra = (child: JSX.Element) => (
    <div style={logicalStyle('max-width', 240)}>
      {child}
    </div>
  );

  return (
    <ButtonWithClosablePopover
      popoverExtra={popoverExtra}
      closeProp="onCancel"
      buttonText="Create"
      confirmDiscard={true}
      popoverProps={{
        initialFocus: "#name"
      }}
      iconType="plusInCircleFilled"
      iconSize="m"
      size="s"
    >
      <ItemFormAction compressed action="create" itemName={itemName} endpoint={endpoint} />
    </ButtonWithClosablePopover>
  );
}

export function CreateModelButton() {
  return <CreateItemButton itemName="model" endpoint="/api/model" />
}

export function CreateFaultTreeButton() {
  return <CreateItemButton itemName="fault tree" endpoint="/api/model/:id/fault_tree" />
}

export function CreateBayesianNetworkButton() {
  return <CreateItemButton itemName="bayesian network" endpoint="/api/model/:id/bayesian_network" />
}

export function CreateESDButton() {
  return <CreateItemButton itemName="event sequence diagram" endpoint="/api/model/:id/esd" />
}

export function CreateEventTreeButton() {
  return <CreateItemButton itemName="event tree" endpoint="/api/model/:id/event_tree" />
}

export function CreateInitiatingEventButton() {
  return <CreateItemButton itemName="initiating event" endpoint="/api/model/:id/initiating_event" />
}
