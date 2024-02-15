import { logicalStyle } from "@elastic/eui";
import {
  PostExternalHazard,
  PostFullScope,
  PostInternalEvent,
  PostInternalHazard,
} from "shared-types/src/lib/api/TypedModelApiManager";
import {
  PostBayesianEstimation,
  PostBayesianNetwork,
  PostDataAnalysis,
  PostEventSequenceAnalysis,
  PostEventSequenceDiagram,
  PostEventSequenceQuantificationDiagram,
  PostEventTree,
  PostFaultTree,
  PostFunctionalEvent,
  PostHumanReliabilityAnalysis,
  PostInitiatingEvent,
  PostMarkovChain,
  PostMechanisticSourceTerm,
  PostOperatingStateAnalysis,
  PostRadiologicalConsequenceAnalysis,
  PostRiskIntegration,
  PostSuccessCriteria,
  PostSystemsAnalysis,
  PostWeibullAnalysis,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { ItemFormProps } from "../forms/typedModelActionForm";
import {
  NestedItemFormProps,
  NestedModelActionForm,
} from "../forms/nestedModelActionForm";
import { TypedModelActionForm } from "../forms/typedModelActionForm";
import { toTitleCase } from "../../../utils/StringUtils";
import { ButtonWithClosablePopover } from "./ButtonWithPopover";

//different props depending on different type of objects we are using for the add button
export type CreateItemButtonProps = Omit<ItemFormProps, "action">;

export type CreateNestedItemButtonProps = Omit<NestedItemFormProps, "action">;

/**
 * for typed models
 * @param itemName - the type of item that is being passed
 * @param endpoint - endpoint that will be used to add the item
 * @returns the create item button
 */
function CreateItemButton({ itemName, postEndpoint }: CreateItemButtonProps) {
  const popoverExtra = (child: JSX.Element) => (
    <div style={logicalStyle("max-width", 240)}>{child}</div>
  );
  //this now checks what type of thing is being added, as adding a typed model has a extra field that isnt needed
  return (
    <ButtonWithClosablePopover
      popoverExtra={popoverExtra}
      closeProp="onCancel"
      buttonText={"Create " + toTitleCase(itemName)}
      confirmDiscard={true}
      popoverProps={{
        initialFocus: "#name",
      }}
      //iconType="plusInCircleFilled"
      iconSize="m"
      size="s"
    >
      {/*TODO:: replace endpoint string with TypedModelApiManager method */}
      <TypedModelActionForm
        compressed
        action="create"
        itemName={itemName}
        postEndpoint={postEndpoint}
      />
    </ButtonWithClosablePopover>
  );
}
export { CreateItemButton };
/**
 * @remarks for nested models
 * @param itemName - the type of item that is being passed
 * @param endpoint - endpoint that will be used to add the item
 * @returns the create item button
 */
export function CreateNestedItemButton({
  itemName,
  postEndpoint,
}: CreateNestedItemButtonProps) {
  const popoverExtra = (child: JSX.Element) => (
    <div style={logicalStyle("max-width", 240)}>{child}</div>
  );
  //this now checks what type of thing is being added, as adding a typed model has a extra field that isnt needed
  return (
    <ButtonWithClosablePopover
      popoverExtra={popoverExtra}
      closeProp="onCancel"
      buttonText={"Create " + toTitleCase(itemName)}
      confirmDiscard={true}
      popoverProps={{
        initialFocus: "#name",
      }}
      //iconType="plusInCircleFilled"
      iconSize="m"
      size="s"
    >
      <NestedModelActionForm
        compressed
        action="create"
        itemName={itemName}
        postEndpoint={postEndpoint}
      />
    </ButtonWithClosablePopover>
  );
}

//TODO: Functions are dummied out for the creates that don't exist
export function CreateInternalEventsButton() {
  return (
    <CreateItemButton
      itemName="internal-events"
      postEndpoint={PostInternalEvent}
    />
  );
}

export function CreateInternalHazardsButton() {
  return (
    <CreateItemButton
      itemName="internal-hazards"
      postEndpoint={PostInternalHazard}
    />
  );
}

export function CreateExternalHazardsButton() {
  return (
    <CreateItemButton
      itemName="external-hazards"
      postEndpoint={PostExternalHazard}
    />
  );
}

export function CreateFullScopeButton() {
  return (
    <CreateItemButton itemName="full-scope" postEndpoint={PostFullScope} />
  );
}

export function CreateFaultTreeButton() {
  return (
    <CreateNestedItemButton
      itemName="fault-tree"
      postEndpoint={PostFaultTree}
    />
  );
}

export function CreateBayesianNetworkButton() {
  return (
    <CreateNestedItemButton
      itemName="bayesian-network"
      postEndpoint={PostBayesianNetwork}
    />
  );
}

export function CreateBayesianEstimationButton() {
  return (
    <CreateNestedItemButton
      itemName="bayesian-estimation"
      postEndpoint={PostBayesianEstimation}
    />
  );
}

export function CreateEventSequenceDiagramButton() {
  return (
    <CreateNestedItemButton
      itemName="event-sequence-diagram"
      postEndpoint={PostEventSequenceDiagram}
    />
  );
}

export function CreateEventTreeButton() {
  return (
    <CreateNestedItemButton
      itemName="event-tree"
      postEndpoint={PostEventTree}
    />
  );
}

export function CreateInitiatingEventButton() {
  return (
    <CreateNestedItemButton
      itemName="initiating-event"
      postEndpoint={PostInitiatingEvent}
    />
  );
}

export function CreateFunctionalEventButton() {
  return (
    <CreateNestedItemButton
      itemName="functional-event"
      postEndpoint={PostFunctionalEvent}
    />
  );
}

export function CreateMarkovChainButton() {
  return (
    <CreateNestedItemButton
      itemName="markov-chain"
      postEndpoint={PostMarkovChain}
    />
  );
}

export function CreateRiskIntegrationButton() {
  return (
    <CreateNestedItemButton
      itemName="risk-integration"
      postEndpoint={PostRiskIntegration}
    />
  );
}

export function CreateRadiologicalConsequenceAnalysisButton() {
  return (
    <CreateNestedItemButton
      itemName="radiological-consequence-analysis"
      postEndpoint={PostRadiologicalConsequenceAnalysis}
    />
  );
}

export function CreateMechanisticSourceTermButton() {
  return (
    <CreateNestedItemButton
      itemName="mechanistic-source-term"
      postEndpoint={PostMechanisticSourceTerm}
    />
  );
}

export function CreateEventSequenceQuantificationDiagramButton() {
  return (
    <CreateNestedItemButton
      itemName="event-sequence-quantification-diagram"
      postEndpoint={PostEventSequenceQuantificationDiagram}
    />
  );
}

export function CreateDataAnalysisButton() {
  return (
    <CreateNestedItemButton
      itemName="data-analysis"
      postEndpoint={PostDataAnalysis}
    />
  );
}

export function CreateHumanReliabilityAnalysisButton() {
  return (
    <CreateNestedItemButton
      itemName="human-reliability-analysis"
      postEndpoint={PostHumanReliabilityAnalysis}
    />
  );
}

export function CreateSystemsAnalysisButton() {
  return (
    <CreateNestedItemButton
      itemName="systems-analysis"
      postEndpoint={PostSystemsAnalysis}
    />
  );
}

export function CreateSuccessCriteriaButton() {
  return (
    <CreateNestedItemButton
      itemName="success-criteria"
      postEndpoint={PostSuccessCriteria}
    />
  );
}

export function CreateEventSequenceAnalysisButton() {
  return (
    <CreateNestedItemButton
      itemName="event-sequence-analysis"
      postEndpoint={PostEventSequenceAnalysis}
    />
  );
}

export function CreateOperatingStateAnalysisButton() {
  return (
    <CreateNestedItemButton
      itemName="operating-state-analysis"
      postEndpoint={PostOperatingStateAnalysis}
    />
  );
}

export function CreateWeibullAnalysisButton() {
  return (
    <CreateNestedItemButton
      itemName="weibull-analysis"
      postEndpoint={PostWeibullAnalysis}
    />
  );
}
