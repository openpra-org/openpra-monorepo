import { NodeTypes } from "reactflow";
import { EventSequenceNode } from "./eventSequenceNode";

/**
 * Enumerates supported Event Sequence node categories.
 */
export type EventSequenceNodeTypes =
  | "initiating"
  | "functional"
  | "description"
  | "undeveloped"
  | "intermediate"
  | "transfer"
  | "end";

/**
 * Represents the types of nodes of event sequence diagram
 */
const ESNodeTypes: NodeTypes = {
  initiating: EventSequenceNode("initiating"),
  functional: EventSequenceNode("functional"),
  description: EventSequenceNode("description"),
  undeveloped: EventSequenceNode("undeveloped"),
  intermediate: EventSequenceNode("intermediate"),
  transfer: EventSequenceNode("transfer"),
  end: EventSequenceNode("end"),
};

/**
 * Optional editing flags and labels for Event Sequence nodes.
 */
export interface EventSequenceNodeProps {
  tentative?: boolean;
  isUpdated?: boolean;
  isDeleted?: boolean;
  label?: string;
  branchId?: string;
}

export { ESNodeTypes };
