import { ButtonWithClosablePopover } from "./ButtonWithPopover";
import { logicalStyle } from "@elastic/eui";
import ItemFormAction, { ItemFormProps } from "../forms/ItemFormAction";

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
      //iconType="plusInCircleFilled"
      iconSize="m"
      size="s"
    >
      <ItemFormAction compressed action="create" itemName={itemName} endpoint={endpoint} />
    </ButtonWithClosablePopover>
  );
}

export function CreateInternalEventsButton() {
  return <CreateItemButton itemName="internal-event" endpoint="/api/internal-events" />
}

export function CreateInternalHazardsButton() {
  return <CreateItemButton itemName="internal-hazard" endpoint="/api/internal-hazards" />
}

export function CreateExternalHazardsButton() {
  return <CreateItemButton itemName="external-hazard" endpoint="/api/external-hazards" />
}

export function CreateFullScopeButton() {
  return <CreateItemButton itemName="full-scope" endpoint="/api/full-scope" />
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

export function CreateEventSequenceDiagramButton() {
  return <CreateItemButton itemName="event-sequence-diagram" endpoint="/api/event-sequence-diagram" />
}

export function CreateEventTreeButton() {
  return <CreateItemButton itemName="event tree" endpoint="/api/model/:id/event_tree" />
}

export function CreateInitiatingEventButton() {
  return <CreateItemButton itemName="initiating event" endpoint="/api/model/:id/initiating_event" />
}
