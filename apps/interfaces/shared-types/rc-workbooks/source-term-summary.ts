import type { ReleaseCategoryInputs } from "interfaces-mef-types/rc/radiological-consequence-analysis";

/** Keep the workbook's existing summary fields consistent with its detailed source table. */
export function withSourceTermSummary(category: ReleaseCategoryInputs): ReleaseCategoryInputs {
  const source = category.sourceTerm?.values;
  if (!source) return category;
  const heights = source.releases.map((r) => r.heightMetres);
  const completeHeight = heights.every((h) => h !== undefined);
  const sameHeight = completeHeight && heights.every((h) => h === heights[0]);
  const timings = source.releases.filter((r) => r.startSeconds !== undefined && r.durationSeconds !== undefined)
    .map((r) => ({ startTime: r.startSeconds!, duration: r.durationSeconds!, timeUnit: "s" }));
  return {
    ...category,
    releaseCharacteristics: {
      ...category.releaseCharacteristics,
      numberOfPlumes: source.releases.length,
      radionuclideGroupFractions: source.groups.map((g, i) => ({
        group: g.name, fraction: source.releases.reduce((sum, r) => sum + r.fractions[i], 0),
      })),
      releasePhaseTimings: timings,
      releaseHeight: sameHeight ? heights[0] : undefined,
      releaseHeightDescription: !completeHeight ? "Missing height in release segments"
        : sameHeight ? `${heights[0]} m` : `${Math.min(...heights as number[])} to ${Math.max(...heights as number[])} m; see segments`,
    },
  };
}
