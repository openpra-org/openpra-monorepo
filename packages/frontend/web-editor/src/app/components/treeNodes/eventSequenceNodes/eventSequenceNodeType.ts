import { NodeTypes } from "reactflow";
import { EventSequenceNode } from "./eventSequenceNode";

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

export type EventSequenceNodeProps = {
  tentative?: boolean;
  isUpdated?: boolean;
  isDeleted?: boolean;
  label?: string;
};

export { ESNodeTypes };
