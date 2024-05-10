import { NestedModelJSON } from "../modelTypes/innerModels/nestedModel";
import { Column } from "./Column";
import { Row } from "./Row";

export interface FailureModesAndEffectsAnalyses extends NestedModelJSON {
  columns: Column[];
  rows: Row[];
}
