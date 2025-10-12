import {
  DeleteBayesianEstimation,
  GetBayesianEstimations,
  PatchBayesianEstimationLabel,
} from "shared-sdk/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function BayesianEstimationList(): JSX.Element {
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
