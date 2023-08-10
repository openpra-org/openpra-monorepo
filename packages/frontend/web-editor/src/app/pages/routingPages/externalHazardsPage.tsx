import { Route, Routes } from "react-router-dom";
import { LabelJSON } from "shared-types/src/lib/types/Label";
import ExternalHazardsList from '../../components/lists/workspaceLists/externalHazardsList';
import ExternalHazardsContainer from "../../components/pageContainers/externalHazardsContainer";
import PlantOperationState from "../fullScopePages/plantOperationState";
import HRA from "../fullScopePages/humanReliabilityAnalysis";
import BayesianEstimation from "../fullScopePages/bayesianEstimation";
import BayesianNetworks from "../fullScopePages/bayesianNetworks";
import EventSequenceDiagrams from "../fullScopePages/eventSequenceDiagrams";
import EventTrees from "../fullScopePages/eventTrees";
import ExternalFlooding from "../fullScopePages/externalFlooding";
import FunctionalEvents from "../fullScopePages/functionalEvents";
import HazardsScreeningAnalysis from "../fullScopePages/hazardsScreeningAnalysis";
import HighWinds from "../fullScopePages/highWinds";
import InitiatingEvents from "../fullScopePages/initiatingEvents";
import InternalFire from "../fullScopePages/internalFire";
import InternalFlood from "../fullScopePages/internalFlood";
import LogicalModels from "../fullScopePages/logicalModels";
import MarkovChains from "../fullScopePages/markovChains";
import MechanisticAnalysis from "../fullScopePages/mechanisticAnalysis";
import ModelSettings from "../fullScopePages/modelSettings";
import OtherHazards from "../fullScopePages/otherHazards";
import QuantificationHistory from "../fullScopePages/quantificationHistory";
import RadiologicalAnalysis from "../fullScopePages/radiologicalAnalysis";
import RiskIntegration from "../fullScopePages/riskIntegration";
import Seismic from "../fullScopePages/seismic";
import WeibullAnalysis from "../fullScopePages/weibullAnalysis";
import FaultTrees from "../fullScopePages/faultTrees";


const getModelFixture = (): ModelProps => {
    return ({
        label: {
            name: "Model ABC",
            description: "I am model ABC",
        },
        id: 402,
        faultTrees: [
            {
                label: {
                    name: "Fault Tree 123",
                    description: "I am ft 123",
                },
                id: 123
            },
            {
                label: {
                    name: "Fault Tree 456",
                    description: "I am ft 456",
                },
                id: 456
            }
        ]
    });
}

export type FaultTreeProps = {
    id: string | number;
    label: LabelJSON;
}

export type ModelProps = {
    id: string | number;
    label: LabelJSON;
    faultTrees: FaultTreeProps[];
}
export async function loadModel() {
    return getModelFixture();
}

export default function ExternalHazardsPage() {
    return (
        <Routes>
            <Route path="" element=<ExternalHazardsList/> />
            <Route
                path=":modelId"
                element=<ExternalHazardsContainer/>
                // loader={loadModel}
            >
                <Route
                  path="plant-operating-state-analysis/*"
                  element= {<PlantOperationState />}
                />
                <Route
                  path= "initiating-events/*"
                  element= {<InitiatingEvents />}
                />
                <Route
                  path= "event-sequence-diagrams/*"
                  element= {<EventSequenceDiagrams />}
                />
                <Route
                  path= "event-trees/*"
                  element= {<EventTrees />}
                />
                <Route
                  path= "functional-events/*"
                  element= {<FunctionalEvents/>}
                />
                <Route
                  path= "fault-trees/*"
                  element= {<FaultTrees />}
                />
                <Route
                  path= "bayesian-networks/*"
                  element= {<BayesianNetworks />}
                />
                <Route
                  path= "markov-chains/*"
                  element= {<MarkovChains />}
                />
                <Route
                  path= "human-reliability-analysis/*"
                  element= {<HRA />}
                />
                <Route
                  path= "bayesian-estimation/*"
                  element= {<BayesianEstimation />}
                />
                <Route
                  path= "weibull-analysis/*"
                  element= {<WeibullAnalysis />}
                />
                <Route
                  path= "seismic-pra/*"
                  element= {<Seismic />}
                />
                <Route
                  path= "hazards-screening-analysis/*"
                  element= {<HazardsScreeningAnalysis />}
                />
                <Route
                  path= "high-winds-pra/*"
                  element= {<HighWinds />}
                />
                <Route
                  path= "external-flooding-pra/*"
                  element= {<ExternalFlooding />}
                /> 
                <Route
                  path= "other-hazards-pra/*"
                  element= {<OtherHazards />}
                />  
                <Route
                  path= "event-sequence-quantification/*"
                  element= {<QuantificationHistory />}
                />
                <Route
                  path= "mechanistic-source-term-analysis/*"
                  element= {<MechanisticAnalysis />}
                />  
                <Route
                  path= "radiological-consequence-analysis/*"
                  element= {<RadiologicalAnalysis />}
                />  
                <Route
                  path= "risk-integration/*"
                  element= {<RiskIntegration />}
                />   
                <Route
                  path= "settings/*"
                  element= {<ModelSettings />}
                />
            </Route>
            {/** everything below here is off of modelID, but in order to keep the desired page structure the routes need to not be nested
             * else a problem happens where the parent takes presedence and loads its content over everything else
             */}

        </Routes>
    );
}
