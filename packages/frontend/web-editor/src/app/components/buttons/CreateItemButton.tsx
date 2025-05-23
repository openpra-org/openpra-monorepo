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

import { ToTitleCase } from "../../../utils/StringUtils";
import { UseGlobalStore } from "../../zustand/Store";
import { NestedItemFormProps, NestedModelActionForm } from "../forms/nestedModelActionForm";
import { ItemFormProps, TypedModelActionForm } from "../forms/typedModelActionForm";
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
const CreateItemButton = ({ itemName, postEndpoint }: CreateItemButtonProps): JSX.Element => {
  const popoverExtra = (child: JSX.Element): JSX.Element => <div style={logicalStyle("max-width", 240)}>{child}</div>;
  //this now checks what type of thing is being added, as adding a typed model has an extra field that isn't needed
  return (
    <ButtonWithClosablePopover
      popoverExtra={popoverExtra}
      closeProp="onCancel"
      buttonText={"Create " + ToTitleCase(itemName)}
      confirmDiscard
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
};
export { CreateItemButton };
/**
 * @remarks for nested models
 * @param itemName - the type of item that is being passed
 * @param endpoint - endpoint that will be used to add the item
 * @returns the create item button
 */
export const CreateNestedItemButton = ({
  itemName,
  postNestedEndpoint,
  postEndpoint,
}: CreateNestedItemButtonProps): JSX.Element => {
  const popoverExtra = (child: JSX.Element): JSX.Element => <div style={logicalStyle("max-width", 240)}>{child}</div>;
  //this now checks what type of thing is being added, as adding a typed model has an extra field that isn't needed
  return (
    <ButtonWithClosablePopover
      popoverExtra={popoverExtra}
      closeProp="onCancel"
      buttonText={"Create " + ToTitleCase(itemName)}
      confirmDiscard
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
};

//TODO: Functions have placeholders for the creates that don't exist
export const CreateInternalEventsButton = (): JSX.Element => {
  const createInternalEvent = UseGlobalStore.use.AddInternalEvent();

  return (
    <CreateItemButton
      itemName="Internal Events"
      postEndpoint={createInternalEvent}
    />
  );
};

export const CreateInternalHazardsButton = (): JSX.Element => {
  const createInternalHazard = UseGlobalStore.use.AddInternalHazard();
  return (
    <CreateItemButton
      itemName="Internal Hazards"
      postEndpoint={createInternalHazard}
    />
  );
};

export const CreateExternalHazardsButton = (): JSX.Element => {
  const createExternalHazard = UseGlobalStore.use.AddExternalHazard();
  return (
    <CreateItemButton
      itemName="External Hazards"
      postEndpoint={createExternalHazard}
    />
  );
};

export const CreateFullScopeButton = (): JSX.Element => {
  const createFullScope = UseGlobalStore.use.AddFullScope();
  return (
    <CreateItemButton
      itemName="Full Scope"
      postEndpoint={createFullScope}
    />
  );
};

export const CreateFaultTreeButton = (): JSX.Element => {
  const AddFaultTree = UseGlobalStore.use.AddFaultTree();
  return (
    <CreateNestedItemButton
      itemName="fault-tree"
      postNestedEndpoint={AddFaultTree}
    />
  );
};

export const CreateHeatBalanceFaultTreeButton = (): JSX.Element => {
  return (
    <CreateNestedItemButton
      itemName="heat-balance-fault-tree"
      postEndpoint={PostHeatBalanceFaultTree}
    />
  );
};

export const CreateBayesianNetworkButton = (): JSX.Element => {
  const AddBayesianNetwork = UseGlobalStore.use.AddBayesianNetwork();
  return (
    <CreateNestedItemButton
      itemName="bayesian-network"
      postNestedEndpoint={AddBayesianNetwork}
    />
  );
};

export const CreateBayesianEstimationButton = (): JSX.Element => {
  return (
    <CreateNestedItemButton
      itemName="bayesian-estimation"
      postEndpoint={PostBayesianEstimation}
    />
  );
};

export const CreateEventSequenceDiagramButton = (): JSX.Element => {
  const AddEventSequenceDiagram = UseGlobalStore.use.AddEventSequenceDiagram();
  return (
    <CreateNestedItemButton
      itemName="event-sequence-diagram"
      postNestedEndpoint={AddEventSequenceDiagram}
    />
  );
};

export const CreateEventTreeButton = (): JSX.Element => {
  const AddEventTree = UseGlobalStore.use.AddEventTree();
  return (
    <CreateNestedItemButton
      itemName="event-tree"
      postNestedEndpoint={AddEventTree}
    />
  );
};

export const CreateInitiatingEventButton = (): JSX.Element => {
  const AddInitiatingEvent = UseGlobalStore.use.AddInitiatingEvent();
  return (
    <CreateNestedItemButton
      itemName="initiating-event"
      postNestedEndpoint={AddInitiatingEvent}
    />
  );
};

export const CreateFunctionalEventButton = (): JSX.Element => {
  return (
    <CreateNestedItemButton
      itemName="functional-event"
      postEndpoint={PostFunctionalEvent}
    />
  );
};

export const CreateMarkovChainButton = (): JSX.Element => {
  return (
    <CreateNestedItemButton
      itemName="markov-chain"
      postEndpoint={PostMarkovChain}
    />
  );
};

export const CreateRiskIntegrationButton = (): JSX.Element => {
  return (
    <CreateNestedItemButton
      itemName="risk-integration"
      postEndpoint={PostRiskIntegration}
    />
  );
};

export const CreateRadiologicalConsequenceAnalysisButton = (): JSX.Element => {
  return (
    <CreateNestedItemButton
      itemName="radiological-consequence-analysis"
      postEndpoint={PostRadiologicalConsequenceAnalysis}
    />
  );
};

export const CreateMechanisticSourceTermButton = (): JSX.Element => {
  return (
    <CreateNestedItemButton
      itemName="mechanistic-source-term"
      postEndpoint={PostMechanisticSourceTerm}
    />
  );
};

export const CreateEventSequenceQuantificationDiagramButton = (): JSX.Element => {
  return (
    <CreateNestedItemButton
      itemName="event-sequence-quantification-diagram"
      postEndpoint={PostEventSequenceQuantificationDiagram}
    />
  );
};

export const CreateDataAnalysisButton = (): JSX.Element => {
  return (
    <CreateNestedItemButton
      itemName="data-analysis"
      postEndpoint={PostDataAnalysis}
    />
  );
};

export const CreateHumanReliabilityAnalysisButton = (): JSX.Element => {
  return (
    <CreateNestedItemButton
      itemName="human-reliability-analysis"
      postEndpoint={PostHumanReliabilityAnalysis}
    />
  );
};

export const CreateSystemsAnalysisButton = (): JSX.Element => {
  return (
    <CreateNestedItemButton
      itemName="systems-analysis"
      postEndpoint={PostSystemsAnalysis}
    />
  );
};

export const CreateSuccessCriteriaButton = (): JSX.Element => {
  return (
    <CreateNestedItemButton
      itemName="success-criteria"
      postEndpoint={PostSuccessCriteria}
    />
  );
};

export const CreateEventSequenceAnalysisButton = (): JSX.Element => {
  const AddEventSequenceAnalysis = UseGlobalStore.use.AddEventSequenceAnalysis();
  return (
    <CreateNestedItemButton
      itemName="event-sequence-analysis"
      postNestedEndpoint={AddEventSequenceAnalysis}
    />
  );
};

export const CreateOperatingStateAnalysisButton = (): JSX.Element => {
  return (
    <CreateNestedItemButton
      itemName="operating-state-analysis"
      postEndpoint={PostOperatingStateAnalysis}
    />
  );
};

export const CreateWeibullAnalysisButton = (): JSX.Element => {
  return (
    <CreateNestedItemButton
      itemName="weibull-analysis"
      postEndpoint={PostWeibullAnalysis}
    />
  );
};
