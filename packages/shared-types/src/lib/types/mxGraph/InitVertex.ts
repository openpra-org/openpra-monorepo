import { OutcomeJSON } from "../Outcome";
import HCLTreeVertexValueJSON, { HCLTreeVertexJSON } from "./HCLTreeVertexJSON";

export type InitVertexValueJSON = {
  outcome?: OutcomeJSON;
} & HCLTreeVertexValueJSON;

export type InitVertexJSON = {} & InitVertexValueJSON & HCLTreeVertexJSON;
