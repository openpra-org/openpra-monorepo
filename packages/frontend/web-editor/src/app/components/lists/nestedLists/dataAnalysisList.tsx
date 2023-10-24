import NestedModelApiManager from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function DataAnalysisList(){

    return (
        <NestedModelList 
          getNestedEndpoint={NestedModelApiManager.getDataAnalysis} 
          deleteNestedEndpoint={NestedModelApiManager.deleteDataAnalysis} 
          patchNestedEndpoint={NestedModelApiManager.patchDataAnalysisLabel} 
          name='data-analysis'
        />
    );
}
