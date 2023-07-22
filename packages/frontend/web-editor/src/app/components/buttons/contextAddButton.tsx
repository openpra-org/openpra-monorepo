import { useLocation } from "react-router-dom";
import { CreateBayesianNetworkButton, CreateEventSequenceDiagramButton, CreateEventTreeButton, CreateExternalHazardsButton, CreateFullScopeButton, CreateInternalEventsButton, CreateInternalHazardsButton } from "./CreateItemButton";

export default () => {
  const location = useLocation().pathname

  //creates the correct object depending on the path, uses starts with and ends with and conditional logic to keep things in the root header
  if (location.startsWith('/internal-events')) {
    if(location === '/internal-events')
      return <CreateInternalEventsButton/>
    if(location.endsWith('/event-sequence-diagrams'))
      return <CreateEventSequenceDiagramButton/>
    if(location.endsWith('/event-trees'))
      return <CreateEventTreeButton/>
    if(location.endsWith('/bayesian-networks'))
      return <CreateBayesianNetworkButton/>
    return <></>
  } else if (location.startsWith('/internal-hazards')){
    if(location === '/internal-hazards')
      return <CreateInternalHazardsButton/>
    if(location.endsWith('/event-sequence-diagrams'))
      return <CreateEventSequenceDiagramButton/>
    if(location.endsWith('/event-trees'))
      return <CreateEventTreeButton/>
    if(location.endsWith('/bayesian-networks'))
      return <CreateBayesianNetworkButton/>
    return <></>
  } else if (location.startsWith('/external-hazards')){
    if(location === '/external-hazards')
      return <CreateExternalHazardsButton/>
    if(location.endsWith('/event-sequence-diagrams'))
      return <CreateEventSequenceDiagramButton/>
    if(location.endsWith('/event-trees'))
      return <CreateEventTreeButton/>
    if(location.endsWith('/bayesian-networks'))
      return <CreateBayesianNetworkButton/>
    return <></>
  } else if (location.startsWith('/full-scope')){
    if(location === '/full-scope')
      return <CreateFullScopeButton/>
    if(location.endsWith('/event-sequence-diagrams'))
      return <CreateEventSequenceDiagramButton/>
    if(location.endsWith('/event-trees'))
      return <CreateEventTreeButton/>
    if(location.endsWith('/bayesian-networks'))
      return <CreateBayesianNetworkButton/>
    return <></>
  }
  else{
    return <></>
  }
} 