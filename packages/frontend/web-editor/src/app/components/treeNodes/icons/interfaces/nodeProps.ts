import { IIconProps } from "./iconProps";
export enum NodeTypes {
  Initiating = "Initiating Event",
  Functional = "Functional",
  Description = "Description",
  Intermediate = "Intermediate",
  Undeveloped = "Undeveloped",
  Transfer = "Transfer",
  End = "End State",
  AndGate = "And Gate",
  OrGate = "Or Gate",
  AtLeastGate = "At Least Gate",
  NotGate = "Not Gate",
  TransferGate = "Transfer Gate",
  BasicEvent = "Basic Event",
  HouseEvent = "House Event",
}
export interface INodeProps {
  nodeType: NodeTypes;
  iconProps: IIconProps;
  selected: boolean | undefined;
  isGrayed: boolean;
}
