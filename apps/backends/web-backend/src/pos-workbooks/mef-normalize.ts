import { LAW_FAMILIES } from "interfaces-mef-types/core/uncertainty";

type PreserveNull = (path: readonly (string | number)[]) => boolean;

function stripNulls(
  value: unknown,
  preserveNull: PreserveNull = () => false,
  path: readonly (string | number)[] = [],
): unknown {
  // Uncertainty is opaque saved draft data. Preserve even malformed/null
  // entries for later review; execution validates only the selected settings.
  const savedUncertainty = path.length === 4
    && (path[0] === "hclConfigurations" || path[0] === "dependencyHclConfigurations")
    && typeof path[1] === "number" && path[2] === "solverSettings" && path[3] === "uncertainty";
  if (savedUncertainty) return value;
  if (value === null) return preserveNull(path) ? null : undefined;
  if (Array.isArray(value)) {
    return value.map((entry, index) => stripNulls(entry, preserveNull, [...path, index]));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    const law = holdsLaw(value);
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (law && v === null) {
        out[k] = null;
        continue;
      }
      const cleaned = stripNulls(v, preserveNull, [...path, k]);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return value;
}

function holdsLaw(value: object): boolean {
  const family = Object.entries(value).find(([key]) => key === "family")?.[1];
  return typeof family === "string" && LAW_FAMILIES.includes(family);
}

export { holdsLaw, stripNulls };
export type { PreserveNull };
