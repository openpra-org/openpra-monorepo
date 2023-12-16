import { TrackableProps } from "./collab/TrackableProps";

export enum TreeTypes {
  EVENT_TREE = "e",
  FAULT_TREE = "f",
  BAYESIAN_NETWORK = "b",
}

type TreeProps = {
  assigned_users: never;
  valid: boolean;
  tree_type: TreeTypes;
} & TrackableProps;
export default TreeProps;
