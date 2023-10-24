import NestedModelApiManager from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function OperatingStateAnalysisList(){

    return (
        <NestedModelList 
          getNestedEndpoint={NestedModelApiManager.getOperatingStateAnalysis} 
          deleteNestedEndpoint={NestedModelApiManager.deleteOperatingStateAnalysis} 
          patchNestedEndpoint={NestedModelApiManager.patchOperatingStateLabel} 
          name='operating-state-analysis'
        />
    );
}
