import NestedModelApiManager from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function HumanReliabilityAnalysisList(){

    return (
        <NestedModelList 
          getNestedEndpoint={NestedModelApiManager.getHumanReliabilityAnalysis} 
          deleteNestedEndpoint={NestedModelApiManager.deleteHumanReliabilityAnalysis} 
          patchNestedEndpoint={NestedModelApiManager.patchHumanReliabilityLabel} 
          name='human-reliability-analysis'
        />
    );
}
