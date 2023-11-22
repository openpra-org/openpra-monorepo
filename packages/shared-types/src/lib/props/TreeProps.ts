import { TrackableProps } from "./collab/TrackableProps";

export enum TreeTypes {
  EVENT_TREE = "e",
  FAULT_TREE = "f",
  BAYESIAN_NETWORK = "b",
}

export default interface TreeProps extends TrackableProps {
  assigned_users: never;
  valid: boolean;
  tree_type: TreeTypes;
}
