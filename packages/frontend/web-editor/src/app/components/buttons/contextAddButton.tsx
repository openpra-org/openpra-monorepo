import { useLocation } from "react-router-dom";
import {
  CreateBayesianEstimationButton,
  CreateBayesianNetworkButton,
  CreateDataAnalysisButton,
  CreateEventSequenceAnalysisButton,
  CreateEventSequenceDiagramButton,
  CreateEventSequenceQuantificationDiagramButton,
  CreateEventTreeButton,
  CreateExternalHazardsButton,
  CreateFaultTreeButton,
  CreateFullScopeButton,
  CreateFunctionalEventButton,
  CreateHumanReliabilityAnalysisButton,
  CreateInitiatingEventButton,
  CreateInternalEventsButton,
  CreateInternalHazardsButton,
  CreateMarkovChainButton,
  CreateMechanisticSourceTermButton,
  CreateOperatingStateAnalysisButton,
  CreateRadiologicalConsequenceAnalysisButton,
  CreateRiskIntegrationButton,
  CreateSuccessCriteriaButton,
  CreateSystemsAnalysisButton,
  CreateWeibullAnalysisButton,
} from "./CreateItemButton";

const ContextAddButton = () => {
  const location = useLocation().pathname;

  //creates the correct object depending on the path, uses starts with and ends with and conditional logic to keep things in the root header
  //this is a lot of stuff to look at
  if (location.startsWith("/internal-events")) {
    if (location === "/internal-events") return <CreateInternalEventsButton />;
    if (location.endsWith("/initiating-events"))
      return <CreateInitiatingEventButton />;
    if (location.endsWith("/event-sequence-diagrams"))
      return <CreateEventSequenceDiagramButton />;
    if (location.endsWith("/event-trees")) return <CreateEventTreeButton />;
    if (location.endsWith("/bayesian-networks"))
      return <CreateBayesianNetworkButton />;
    if (location.endsWith("/functional-events"))
      return <CreateFunctionalEventButton />;
    if (location.endsWith("/fault-trees")) return <CreateFaultTreeButton />;
    if (location.endsWith("/markov-chains")) return <CreateMarkovChainButton />;
    if (location.endsWith("/bayesian-estimation"))
      return <CreateBayesianEstimationButton />;
    if (location.endsWith("/weibull-analysis"))
      return <CreateWeibullAnalysisButton />;
    if (location.endsWith("/operating-state-analysis"))
      return <CreateOperatingStateAnalysisButton />;
    if (location.endsWith("/risk-integration"))
      return <CreateRiskIntegrationButton />;
    if (location.endsWith("/radiological-consequence-analysis"))
      return <CreateRadiologicalConsequenceAnalysisButton />;
    if (location.endsWith("/mechanistic-source-terms"))
      return <CreateMechanisticSourceTermButton />;
    if (location.endsWith("/event-sequence-quantification-diagrams"))
      return <CreateEventSequenceQuantificationDiagramButton />;
    if (location.endsWith("/data-analysis"))
      return <CreateDataAnalysisButton />;
    if (location.endsWith("/human-reliability-analysis"))
      return <CreateHumanReliabilityAnalysisButton />;
    if (location.endsWith("/systems-analysis"))
      return <CreateSystemsAnalysisButton />;
    if (location.endsWith("/success-criteria"))
      return <CreateSuccessCriteriaButton />;
    if (location.endsWith("/event-sequence-analysis"))
      return <CreateEventSequenceAnalysisButton />;
    return <></>;
  } else if (location.startsWith("/internal-hazards")) {
    if (location === "/internal-hazards")
      return <CreateInternalHazardsButton />;
    if (location.endsWith("/initiating-events"))
      return <CreateInitiatingEventButton />;
    if (location.endsWith("/event-sequence-diagrams"))
      return <CreateEventSequenceDiagramButton />;
    if (location.endsWith("/event-trees")) return <CreateEventTreeButton />;
    if (location.endsWith("/bayesian-networks"))
      return <CreateBayesianNetworkButton />;
    if (location.endsWith("/functional-events"))
      return <CreateFunctionalEventButton />;
    if (location.endsWith("/fault-trees")) return <CreateFaultTreeButton />;
    if (location.endsWith("/markov-chains")) return <CreateMarkovChainButton />;
    if (location.endsWith("/bayesian-estimations"))
      return <CreateBayesianEstimationButton />;
    if (location.endsWith("/weibull-analysis"))
      return <CreateWeibullAnalysisButton />;
    return <></>;
  } else if (location.startsWith("/external-hazards")) {
    if (location === "/external-hazards")
      return <CreateExternalHazardsButton />;
    if (location.endsWith("/initiating-events"))
      return <CreateInitiatingEventButton />;
    if (location.endsWith("/event-sequence-diagrams"))
      return <CreateEventSequenceDiagramButton />;
    if (location.endsWith("/event-trees")) return <CreateEventTreeButton />;
    if (location.endsWith("/bayesian-networks"))
      return <CreateBayesianNetworkButton />;
    if (location.endsWith("/functional-events"))
      return <CreateFunctionalEventButton />;
    if (location.endsWith("/fault-trees")) return <CreateFaultTreeButton />;
    if (location.endsWith("/markov-chains")) return <CreateMarkovChainButton />;
    if (location.endsWith("/bayesian-estimations"))
      return <CreateBayesianEstimationButton />;
    if (location.endsWith("/weibull-analysis"))
      return <CreateWeibullAnalysisButton />;
    return <></>;
  } else if (location.startsWith("/full-scope")) {
    if (location === "/full-scope") return <CreateFullScopeButton />;
    if (location.endsWith("/initiating-events"))
      return <CreateInitiatingEventButton />;
    if (location.endsWith("/event-sequence-diagrams"))
      return <CreateEventSequenceDiagramButton />;
    if (location.endsWith("/event-trees")) return <CreateEventTreeButton />;
    if (location.endsWith("/bayesian-networks"))
      return <CreateBayesianNetworkButton />;
    if (location.endsWith("/functional-events"))
      return <CreateFunctionalEventButton />;
    if (location.endsWith("/fault-trees")) return <CreateFaultTreeButton />;
    if (location.endsWith("/markov-chains")) return <CreateMarkovChainButton />;
    if (location.endsWith("/bayesian-estimations"))
      return <CreateBayesianEstimationButton />;
    if (location.endsWith("/weibull-analysis"))
      return <CreateWeibullAnalysisButton />;
    return <></>;
  } else {
    return <></>;
  }
};

export { ContextAddButton };
