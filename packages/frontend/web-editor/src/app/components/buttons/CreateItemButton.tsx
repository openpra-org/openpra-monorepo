import { logicalStyle } from "@elastic/eui";
import {
  PostBayesianEstimation,
  PostDataAnalysis,
  PostEventSequenceQuantificationDiagram,
  PostFunctionalEvent,
  PostHeatBalanceFaultTree,
  PostHumanReliabilityAnalysis,
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
import { NestedItemFormProps, NestedModelActionForm } from "../forms/nestedModelActionForm";
import { TypedModelActionForm } from "../forms/typedModelActionForm";
import { ToTitleCase } from "../../../utils/StringUtils";
import { UseGlobalStore } from "../../zustand/Store";
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
function CreateItemButton({ itemName, postEndpoint }: CreateItemButtonProps): JSX.Element {
  const popoverExtra = (child: JSX.Element): JSX.Element => <div style={logicalStyle("max-width", 240)}>{child}</div>;
  //this now checks what type of thing is being added, as adding a typed model has an extra field that isn't needed
  return (
    <ButtonWithClosablePopover
      popoverExtra={popoverExtra}
      closeProp="onCancel"
      buttonText={"Create " + ToTitleCase(itemName)}
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
  postNestedEndpoint,
  postEndpoint,
}: CreateNestedItemButtonProps): JSX.Element {
  const popoverExtra = (child: JSX.Element): JSX.Element => <div style={logicalStyle("max-width", 240)}>{child}</div>;
  //this now checks what type of thing is being added, as adding a typed model has an extra field that isn't needed
  return (
    <ButtonWithClosablePopover
      popoverExtra={popoverExtra}
      closeProp="onCancel"
      buttonText={"Create " + ToTitleCase(itemName)}
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
        postNestedEndpoint={postNestedEndpoint}
      />
    </ButtonWithClosablePopover>
  );
}

//TODO: Functions have placeholders for the creates that don't exist
export function CreateInternalEventsButton(): JSX.Element {
  const createInternalEvent = UseGlobalStore.use.AddInternalEvent();

  return (
    <CreateItemButton
      itemName="Internal Events"
      postEndpoint={createInternalEvent}
    />
  );
}

export function CreateInternalHazardsButton(): JSX.Element {
  const createInternalHazard = UseGlobalStore.use.AddInternalHazard();
  return (
    <CreateItemButton
      itemName="Internal Hazards"
      postEndpoint={createInternalHazard}
    />
  );
}

export function CreateExternalHazardsButton(): JSX.Element {
  const createExternalHazard = UseGlobalStore.use.AddExternalHazard();
  return (
    <CreateItemButton
      itemName="External Hazards"
      postEndpoint={createExternalHazard}
    />
  );
}

export function CreateFullScopeButton(): JSX.Element {
  const createFullScope = UseGlobalStore.use.AddFullScope();
  return (
    <CreateItemButton
      itemName="Full Scope"
      postEndpoint={createFullScope}
    />
  );
}

export function CreateFaultTreeButton(): JSX.Element {
  const AddFaultTree = UseGlobalStore.use.AddFaultTree();
  return (
    <CreateNestedItemButton
      itemName="fault-tree"
      postNestedEndpoint={AddFaultTree}
    />
  );
}

export function CreateHeatBalanceFaultTreeButton(): JSX.Element {
  return (
    <CreateNestedItemButton
      itemName="heat-balance-fault-tree"
      postEndpoint={PostHeatBalanceFaultTree}
    />
  );
}

export function CreateBayesianNetworkButton(): JSX.Element {
  const AddBayesianNetwork = UseGlobalStore.use.AddBayesianNetwork();
  return (
    <CreateNestedItemButton
      itemName="bayesian-network"
      postNestedEndpoint={AddBayesianNetwork}
    />
  );
}

export function CreateBayesianEstimationButton(): JSX.Element {
  return (
    <CreateNestedItemButton
      itemName="bayesian-estimation"
      postEndpoint={PostBayesianEstimation}
    />
  );
}

export function CreateEventSequenceDiagramButton(): JSX.Element {
  const AddEventSequenceDiagram = UseGlobalStore.use.AddEventSequenceDiagram();
  return (
    <CreateNestedItemButton
      itemName="event-sequence-diagram"
      postNestedEndpoint={AddEventSequenceDiagram}
    />
  );
}

export function CreateEventTreeButton(): JSX.Element {
  const AddEventTree = UseGlobalStore.use.AddEventTree();
  return (
    <CreateNestedItemButton
      itemName="event-tree"
      postNestedEndpoint={AddEventTree}
    />
  );
}

export function CreateInitiatingEventButton(): JSX.Element {
  const AddInitiatingEvent = UseGlobalStore.use.AddInitiatingEvent();
  return (
    <CreateNestedItemButton
      itemName="initiating-event"
      postNestedEndpoint={AddInitiatingEvent}
    />
  );
}

export function CreateFunctionalEventButton(): JSX.Element {
  return (
    <CreateNestedItemButton
      itemName="functional-event"
      postEndpoint={PostFunctionalEvent}
    />
  );
}

export function CreateMarkovChainButton(): JSX.Element {
  return (
    <CreateNestedItemButton
      itemName="markov-chain"
      postEndpoint={PostMarkovChain}
    />
  );
}

export function CreateRiskIntegrationButton(): JSX.Element {
  return (
    <CreateNestedItemButton
      itemName="risk-integration"
      postEndpoint={PostRiskIntegration}
    />
  );
}

export function CreateRadiologicalConsequenceAnalysisButton(): JSX.Element {
  return (
    <CreateNestedItemButton
      itemName="radiological-consequence-analysis"
      postEndpoint={PostRadiologicalConsequenceAnalysis}
    />
  );
}

export function CreateMechanisticSourceTermButton(): JSX.Element {
  return (
    <CreateNestedItemButton
      itemName="mechanistic-source-term"
      postEndpoint={PostMechanisticSourceTerm}
    />
  );
}

export function CreateEventSequenceQuantificationDiagramButton(): JSX.Element {
  return (
    <CreateNestedItemButton
      itemName="event-sequence-quantification-diagram"
      postEndpoint={PostEventSequenceQuantificationDiagram}
    />
  );
}

export function CreateDataAnalysisButton(): JSX.Element {
  return (
    <CreateNestedItemButton
      itemName="data-analysis"
      postEndpoint={PostDataAnalysis}
    />
  );
}

export function CreateHumanReliabilityAnalysisButton(): JSX.Element {
  return (
    <CreateNestedItemButton
      itemName="human-reliability-analysis"
      postEndpoint={PostHumanReliabilityAnalysis}
    />
  );
}

export function CreateSystemsAnalysisButton(): JSX.Element {
  return (
    <CreateNestedItemButton
      itemName="systems-analysis"
      postEndpoint={PostSystemsAnalysis}
    />
  );
}

export function CreateSuccessCriteriaButton(): JSX.Element {
  return (
    <CreateNestedItemButton
      itemName="success-criteria"
      postEndpoint={PostSuccessCriteria}
    />
  );
}

export function CreateEventSequenceAnalysisButton(): JSX.Element {
  const AddEventSequenceAnalysis = UseGlobalStore.use.AddEventSequenceAnalysis();
  return (
    <CreateNestedItemButton
      itemName="event-sequence-analysis"
      postNestedEndpoint={AddEventSequenceAnalysis}
    />
  );
}

export function CreateOperatingStateAnalysisButton(): JSX.Element {
  return (
    <CreateNestedItemButton
      itemName="operating-state-analysis"
      postEndpoint={PostOperatingStateAnalysis}
    />
  );
}

export function CreateWeibullAnalysisButton(): JSX.Element {
  return (
    <CreateNestedItemButton
      itemName="weibull-analysis"
      postEndpoint={PostWeibullAnalysis}
    />
  );
}
