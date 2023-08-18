import NestedModelApiManager from "packages/shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function WeibullAnalysisList(){

    return (
        <NestedModelList 
          getNestedEndpoint={NestedModelApiManager.getWeibullAnalysis} 
          deleteNestedEndpoint={NestedModelApiManager.deleteWeibullAnalysis} 
          patchNestedEndpoint={NestedModelApiManager.patchWeibullAnalysisLabel} 
          name='weibull-analysis'
        />
    );
}
