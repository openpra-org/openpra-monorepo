import { stripNulls } from "../pos-workbooks/mef-normalize";

function isHclVariableOrder(path: readonly (string | number)[]): boolean {
  return (
    path.length === 4 &&
    path[0] === "hclConfigurations" &&
    typeof path[1] === "number" &&
    path[2] === "solverSettings" &&
    path[3] === "variableOrder"
  );
}

function normalizeEsqMef(value: unknown): unknown {
  return stripNulls(value, isHclVariableOrder);
}

export { normalizeEsqMef };
