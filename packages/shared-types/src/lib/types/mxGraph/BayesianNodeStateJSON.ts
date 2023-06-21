import { LabelJSON } from "../Label";
import { BayesianStateProbabilityJSON } from "../BayesianStateProbability";

export type BayesianNodeStateJSONMap = {[key: string]: BayesianNodeStateJSON};

export interface BayesianNodeStateJSON {
  probabilities: BayesianStateProbabilityJSON[];
  label: LabelJSON;
}
