import { ButtonWithClosablePopover } from "./ButtonWithPopover";
import { logicalStyle } from "@elastic/eui";
import TypedModelApiManager from "packages/shared-types/src/lib/api/TypedModelApiManager";
import { ItemFormProps } from "../forms/typedModelActionForm";
import NestedModelActionForm, { NestedItemFormProps } from "../forms/nestedModelActionForm";
import TypedModelActionForm from "../forms/typedModelActionForm";
import NestedModelApiManager from "packages/shared-types/src/lib/api/NestedModelApiManager";

//different props depending on different type of objects we are using for the add button
export type CreateItemButtonProps = {
} & Omit<ItemFormProps, "action">;

export type CreateNestedItemButtonProps = {
} & Omit<NestedItemFormProps, "action">;

/**
 * for typed models
 * @param itemName the type of item that is being passed
 * @param endpoint endpoint that will be used to add the item
 * @returns the create item button
 */
export default function CreateItemButton({ itemName, postEndpoint }: CreateItemButtonProps) {

  const popoverExtra = (child: JSX.Element) => (
    <div style={logicalStyle('max-width', 240)}>
      {child}
    </div>
  );
  //this now checks what type of thing is being added, as adding a typed model has a extra field that isnt needed
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
      {/*TODO:: replace endpoint string with TypedModelApiManager method */}
      <TypedModelActionForm compressed action="create" itemName={itemName} postEndpoint={postEndpoint} />
    </ButtonWithClosablePopover>
  );
}

/**
 * for nested models
 * @param itemName the type of item that is being passed
 * @param endpoint endpoint that will be used to add the item
 * @returns the create item button
 */
export function CreateNestedItemButton({ itemName, postEndpoint }: CreateNestedItemButtonProps) {

  const popoverExtra = (child: JSX.Element) => (
    <div style={logicalStyle('max-width', 240)}>
      {child}
    </div>
  );
  //this now checks what type of thing is being added, as adding a typed model has a extra field that isnt needed
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
      <NestedModelActionForm compressed action="create" itemName={itemName} postEndpoint={postEndpoint} />
    </ButtonWithClosablePopover>
  );
}

//TODO: Fucntions are dummied out for the creates that don't exist
export function CreateInternalEventsButton() {
  return <CreateItemButton itemName="internal-events" postEndpoint={TypedModelApiManager.postInternalEvent} />
}

export function CreateInternalHazardsButton() {
  return <CreateItemButton itemName="internal-hazards" postEndpoint={TypedModelApiManager.postInternalHazard} />
}

export function CreateExternalHazardsButton() {
  return <CreateItemButton itemName="external-hazards" postEndpoint={TypedModelApiManager.postExternalHazard} />
}

export function CreateFullScopeButton() {
  return <CreateItemButton itemName="full-scope" postEndpoint={TypedModelApiManager.postFullScope} />
}

export function CreateFaultTreeButton() {
  return <CreateNestedItemButton itemName="fault-tree" postEndpoint={NestedModelApiManager.postFaultTree} />
}

export function CreateBayesianNetworkButton() {
  return <CreateNestedItemButton itemName="bayesian-network" postEndpoint={NestedModelApiManager.postBayesianNetwork} />
}

export function CreateBayesianEstimationButton() {
  return <CreateNestedItemButton itemName="bayesian-estimation" postEndpoint={NestedModelApiManager.postBayesianEstimation} />
}

export function CreateEventSequenceDiagramButton() {
  return <CreateNestedItemButton itemName="event-sequence-diagram" postEndpoint={NestedModelApiManager.postEventSequenceDiagram} />
}

export function CreateEventTreeButton() {
  return <CreateNestedItemButton itemName="event-tree" postEndpoint={NestedModelApiManager.postEventTree} />
}

export function CreateInitiatingEventButton() {
  return <CreateNestedItemButton itemName="initiating-event" postEndpoint={NestedModelApiManager.postInitiatingEvent} />
}

export function CreateFunctionalEventButton() {
  return <CreateNestedItemButton itemName="functional-event" postEndpoint={NestedModelApiManager.postFunctionalEvent} />
}

export function CreateMarkovChainButton() {
  return <CreateNestedItemButton itemName="markov-chain" postEndpoint={NestedModelApiManager.postMarkovChain} />
}

export function CreateWeibullAnalysisButton() {
  return <CreateNestedItemButton itemName="weibull-analysis" postEndpoint={NestedModelApiManager.postWeibullAnalysis} />
}
