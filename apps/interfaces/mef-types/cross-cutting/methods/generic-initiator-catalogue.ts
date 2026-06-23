import { MethodBase } from "./master-logic-diagram";

export interface GenericInitiatorEntry {
  id: string;
  name: string;
  source: string;
  applicable: boolean;
  derivedInitiatorIds: string[];
  rationale: string;
}

export interface GenericInitiatorCatalogue extends MethodBase {
  methodKind: "GENERIC_INITIATOR_CATALOGUE";
  entries: GenericInitiatorEntry[];
}
