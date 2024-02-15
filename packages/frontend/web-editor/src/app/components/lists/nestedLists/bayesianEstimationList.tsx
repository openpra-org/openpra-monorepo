import {
  DeleteBayesianEstimation,
  GetBayesianEstimations,
  PatchBayesianEstimationLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function BayesianEstimationList() {
  return (
    <NestedModelList
      getNestedEndpoint={GetBayesianEstimations}
      deleteNestedEndpoint={DeleteBayesianEstimation}
      patchNestedEndpoint={PatchBayesianEstimationLabel}
      name="bayesian-estimation"
    />
  );
}
export { BayesianEstimationList };
