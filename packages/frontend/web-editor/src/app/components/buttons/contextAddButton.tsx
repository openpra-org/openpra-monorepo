import { useLocation } from "react-router-dom";
import { CreateBayesianEstimationButton, CreateBayesianNetworkButton, CreateEventSequenceDiagramButton, CreateEventTreeButton, CreateExternalHazardsButton, CreateFaultTreeButton, CreateFullScopeButton, CreateFunctionalEventButton, CreateInitiatingEventButton, CreateInternalEventsButton, CreateInternalHazardsButton, CreateMarkovChainButton, CreateWeibullAnalysisButton } from "./CreateItemButton";

export default () => {
  const location = useLocation().pathname

  //creates the correct object depending on the path, uses starts with and ends with and conditional logic to keep things in the root header
  //this is a lot of stuff to look at
  if (location.startsWith('/internal-events')) {
    if(location === '/internal-events')
      return <CreateInternalEventsButton/>
    if(location.endsWith('/initiating-events'))
      return <CreateInitiatingEventButton/>
    if(location.endsWith('/event-sequence-diagrams'))
      return <CreateEventSequenceDiagramButton/>
    if(location.endsWith('/event-trees'))
      return <CreateEventTreeButton/>
    if(location.endsWith('/bayesian-networks'))
      return <CreateBayesianNetworkButton/>
    if(location.endsWith('/functional-events'))
      return <CreateFunctionalEventButton/>
    if(location.endsWith('/fault-trees'))
      return <CreateFaultTreeButton/>
    if(location.endsWith('/markov-chains'))
      return <CreateMarkovChainButton/>
    if(location.endsWith('/bayesian-estimations'))
      return <CreateBayesianEstimationButton/>
    if(location.endsWith('/weibull-analysis'))
      return <CreateWeibullAnalysisButton/>
    return <></>
  } else if (location.startsWith('/internal-hazards')){
    if(location === '/internal-hazards')
      return <CreateInternalHazardsButton/>
    if(location.endsWith('/initiating-events'))
      return <CreateInitiatingEventButton/>
    if(location.endsWith('/event-sequence-diagrams'))
      return <CreateEventSequenceDiagramButton/>
    if(location.endsWith('/event-trees'))
      return <CreateEventTreeButton/>
    if(location.endsWith('/bayesian-networks'))
      return <CreateBayesianNetworkButton/>
    if(location.endsWith('/functional-events'))
      return <CreateFunctionalEventButton/>
    if(location.endsWith('/fault-trees'))
      return <CreateFaultTreeButton/>
    if(location.endsWith('/markov-chains'))
      return <CreateMarkovChainButton/>
    if(location.endsWith('/bayesian-estimations'))
      return <CreateBayesianEstimationButton/>
    if(location.endsWith('/weibull-analysis'))
      return <CreateWeibullAnalysisButton/>
    return <></>
  } else if (location.startsWith('/external-hazards')){
    if(location === '/external-hazards')
      return <CreateExternalHazardsButton/>
    if(location.endsWith('/initiating-events'))
      return <CreateInitiatingEventButton/>
    if(location.endsWith('/event-sequence-diagrams'))
      return <CreateEventSequenceDiagramButton/>
    if(location.endsWith('/event-trees'))
      return <CreateEventTreeButton/>
    if(location.endsWith('/bayesian-networks'))
      return <CreateBayesianNetworkButton/>
    if(location.endsWith('/functional-events'))
      return <CreateFunctionalEventButton/>
    if(location.endsWith('/fault-trees'))
      return <CreateFaultTreeButton/>
    if(location.endsWith('/markov-chains'))
      return <CreateMarkovChainButton/>
    if(location.endsWith('/bayesian-estimations'))
      return <CreateBayesianEstimationButton/>
    if(location.endsWith('/weibull-analysis'))
      return <CreateWeibullAnalysisButton/>
    return <></>
  } else if (location.startsWith('/full-scope')){
    if(location === '/full-scope')
      return <CreateFullScopeButton/>
    if(location.endsWith('/initiating-events'))
      return <CreateInitiatingEventButton/>
    if(location.endsWith('/event-sequence-diagrams'))
      return <CreateEventSequenceDiagramButton/>
    if(location.endsWith('/event-trees'))
      return <CreateEventTreeButton/>
    if(location.endsWith('/bayesian-networks'))
      return <CreateBayesianNetworkButton/>
    if(location.endsWith('/functional-events'))
      return <CreateFunctionalEventButton/>
    if(location.endsWith('/fault-trees'))
      return <CreateFaultTreeButton/>
    if(location.endsWith('/markov-chains'))
      return <CreateMarkovChainButton/>
    if(location.endsWith('/bayesian-estimations'))
      return <CreateBayesianEstimationButton/>
    if(location.endsWith('/weibull-analysis'))
      return <CreateWeibullAnalysisButton/>
    return <></>
  }
  else{
    return <></>
  }
} 