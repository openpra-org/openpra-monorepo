import ButtonWithPopover from "./ButtonWithPopover";
import CreateItemForm, { CreateItemFormProps } from "../forms/CreateItemForm";
import { EuiFlexGroup, EuiFlexItem, EuiPopoverTitle, logicalStyle } from "@elastic/eui";
import { toTitleCase } from "../../../utils/StringUtils";

export type CreateItemButtonProps = {

} & CreateItemFormProps;

export default function CreateItemButton({ itemName, endpoint }: CreateItemButtonProps) {

  const label = toTitleCase(itemName);

  const popoverContent = (
    <div style={logicalStyle('width', 260)}>
      <EuiFlexGroup gutterSize="xl">
      <EuiFlexItem>
        <CreateItemForm itemName={label} endpoint="/api/model" />
      </EuiFlexItem>
      </EuiFlexGroup>
    </div>
  );
  return (
    <ButtonWithPopover
      popoverContent={popoverContent}
      confirmDiscard={true}
      popoverProps={{
        initialFocus: "#name"
      }}
      iconType="plusInCircleFilled"
      iconSize="m"
      size="s"
    >
      Create
    </ButtonWithPopover>
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
