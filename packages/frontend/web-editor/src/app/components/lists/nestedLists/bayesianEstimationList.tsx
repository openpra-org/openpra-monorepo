import NestedModelApiManager from "packages/shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function BayesianEstimationList(){

    return (
        <NestedModelList 
          getNestedEndpoint={NestedModelApiManager.getBayesianEstimations} 
          deleteNestedEndpoint={NestedModelApiManager.deleteBayesianEstimation} 
          name='bayesian-estimation'
        />
    );
}
