import { Role, RoleJSON } from "../Role";
import Label from "../Label";
import { VertexPositionJSONDefaultsMap, VertexPositionJSONMap } from "./VertexPositionJSON";

import { DEFAULT_LABEL_JSON, LabelJSON } from "../Label";

export default interface HCLTreeVertexValueJSON {
  label: LabelJSON;
}

export const DEFAULT_HCLTREEVERTEXVALUE_JSON: HCLTreeVertexValueJSON = {
  label: DEFAULT_LABEL_JSON,
};

export const HCLTreeVertexValueChangeEvents = {
  EXPRESSION_CHANGED: "expression",
  CONSTANT_CHANGED: "constant",
  LABEL_CHANGED: "label",
};

export interface HCLTreeVertexJSON extends RoleJSON, HCLTreeVertexValueJSON {
  style?: VertexPositionJSONMap;
}

export interface HCLTreeVertexJSONMap {
  [index: string]: HCLTreeVertexJSON;
}

export const DEFAULT_HCLTREEVERTEXJSON: HCLTreeVertexJSON = {
  label: new Label().getDefaultJSON(),
  ...(new Role()).getDefaultJSON(),
  ...{
    style: VertexPositionJSONDefaultsMap,
  }
};
