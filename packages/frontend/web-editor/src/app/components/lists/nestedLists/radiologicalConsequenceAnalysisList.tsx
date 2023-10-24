import NestedModelApiManager from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function RadiologicalConsequenceAnalysisList(){

    return (
        <NestedModelList 
          getNestedEndpoint={NestedModelApiManager.getRadiologicalConsequenceAnalysis} 
          deleteNestedEndpoint={NestedModelApiManager.deleteRadiologicalConsequenceAnalysis} 
          patchNestedEndpoint={NestedModelApiManager.patchRadiologicalConsequenceLabel} 
          name='radiological-consequence-analysis'
        />
    );
}
