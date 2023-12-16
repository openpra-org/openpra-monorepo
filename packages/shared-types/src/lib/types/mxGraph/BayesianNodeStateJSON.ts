import { LabelJSON } from "../Label";
import { BayesianStateProbabilityJSON } from "../BayesianStateProbability";

export type BayesianNodeStateJSONMap = Record<string, BayesianNodeStateJSON>;

export type BayesianNodeStateJSON = {
  probabilities: BayesianStateProbabilityJSON[];
  label: LabelJSON;
};
