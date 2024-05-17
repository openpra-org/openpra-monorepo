import Label from "../Label";
import { DEFAULT_LABEL_JSON, LabelJSON } from "../Label";
import { VertexPositionJSONDefaultsMap, VertexPositionJSONMap } from "./VertexPositionJSON";

interface HCLTreeVertexValueJSON {
  label: LabelJSON;
}
export default HCLTreeVertexValueJSON;

export const DEFAULT_HCLTREEVERTEXVALUE_JSON: HCLTreeVertexValueJSON = {
  label: DEFAULT_LABEL_JSON,
};

export const HCLTreeVertexValueChangeEvents = {
  EXPRESSION_CHANGED: "expression",
  CONSTANT_CHANGED: "constant",
  LABEL_CHANGED: "label",
};

export type HCLTreeVertexJSON = {
  style?: VertexPositionJSONMap;
} & HCLTreeVertexValueJSON;

export type HCLTreeVertexJSONMap = Record<string, HCLTreeVertexJSON>;

export const DEFAULT_HCLTREEVERTEXJSON: HCLTreeVertexJSON = {
  label: new Label().getDefaultJSON(),
  ...{
    style: VertexPositionJSONDefaultsMap,
  },
};
