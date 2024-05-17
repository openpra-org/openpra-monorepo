/**
 * Basic shape parameters, used and optionally overridden by child classes
 * {{RADIUS: number, WIDTH: number, HEIGHT: number, GATE: number}}
 */
interface VertexShape {
  HEIGHT: number;
  WIDTH: number;
  RADIUS?: number;
  GATE?: number;
  SUB_LABEL_HEIGHT: number;
  SUB_LABEL_OFFSET: number;
}
export default VertexShape;

export const DEFAULT_SHAPE = {
  HEIGHT: 124,
  WIDTH: 196,
  RADIUS: 16,
  GATE: 32,
  SUB_LABEL_HEIGHT: 32,
  SUB_LABEL_OFFSET: 32,
};
