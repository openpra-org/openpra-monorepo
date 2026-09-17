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
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = stripNulls(v, preserveNull, [...path, k]);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return value;
}

export { stripNulls };
export type { PreserveNull };
