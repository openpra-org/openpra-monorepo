import { IIconProps } from "./iconProps";

/**
 * @public Represents enum of different types of Nodes of an Event Sequence Diagram
 */
export enum NodeTypes {
  Initiating = "Initiating Event",
  Functional = "Functional",
  Description = "Description",
  Intermediate = "Intermediate",
  Undeveloped = "Undeveloped",
  Transfer = "Transfer",
  End = "End State",
}

/**
 * Represents the node properties
 */
export interface INodeProps {
  /**
   * @param nodeType type of node (based on NodeTypes enum)
   */
  nodeType: NodeTypes;
  /**
   * @param iconProps properties of icon associated with the node
   */
  iconProps: IIconProps;
}
