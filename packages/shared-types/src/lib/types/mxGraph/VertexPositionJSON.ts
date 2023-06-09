import { Defaults } from "../ObjectTypes";
import { DEFAULT_SHAPE } from "./VertexShape";

export default interface VertexPositionJSON {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}
export const VertexPositionJSONDefaults: VertexPositionJSON = {
  x: 0,
  y: 0,
  width: DEFAULT_SHAPE.WIDTH,
  height: DEFAULT_SHAPE.HEIGHT,
};

export interface VertexPositionJSONMap {
  position?: VertexPositionJSON;
}

export const VertexPositionJSONDefaultsMap: Defaults<VertexPositionJSONMap> = {
  position: VertexPositionJSONDefaults,
};
