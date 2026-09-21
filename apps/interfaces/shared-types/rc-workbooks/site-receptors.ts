import type { RcCoordinateAnchor, RcEvaluatedReceptor, RcReceptorGeometry, RcSiteSettings } from "interfaces-mef-types/rc/site-receptors";
import { RcSiteSettingsSchema } from "interfaces-mef-types/zod/rc/site-receptors";

export const receptorCount = (g: RcReceptorGeometry | undefined): number => !g ? 0 : g.kind === "cells" ? g.radiiKm.length * g.sectors : g.points.length;
export const sitePopulation = (g: RcReceptorGeometry | undefined): number | undefined =>
  g?.kind === "cells" && g.populationByCell ? g.populationByCell.reduce((sum, count) => sum + count, 0) : undefined;
export function coordinateReference(a: RcCoordinateAnchor): string {
  const datum = ["", "NAD27", "WGS72", "WGS84", "NAD83", "Old Hawaii", "Puerto Rico / Virgin Islands"][a.datum];
  return `${datum} · UTM zone ${Math.abs(a.zone)}${a.zone < 0 ? "S" : "N"} · local X/Y in metres`;
}
export function siteReceptorIssues(settings: RcSiteSettings, geometry?: RcReceptorGeometry): string[] {
  const errors: string[] = [];
  if (!RcSiteSettingsSchema.safeParse(settings).success) errors.push("Check coordinate ranges and the nonnegative receptor height.");
  if (settings.latitude === undefined || settings.longitude === undefined) errors.push("Enter the release latitude and longitude in Site location.");
  if (!geometry) return [...errors, "Import the receptor geometry."];
  if (geometry.kind === "cells") {
    if (!settings.cellPoint) errors.push("Choose the dose-evaluation point within each cell.");
    if (geometry.center && settings.latitude !== undefined && settings.longitude !== undefined &&
      (Math.abs(geometry.center.latitude - settings.latitude) > 0.0001 || Math.abs(geometry.center.longitude - settings.longitude) > 0.0001))
      errors.push("The release location differs from the SecPop grid center. Use matching site data.");
  } else if (settings.releaseX === undefined || settings.releaseY === undefined) errors.push("Enter the release X/Y position in the imported coordinate system.");
  if ((geometry.kind === "cells" || geometry.points.some(p => p.heightMetres === undefined)) && settings.receptorHeightMetres === undefined)
    errors.push("Enter the receptor height above local ground.");
  return errors;
}
export function cellDoseDistance(g: Extract<RcReceptorGeometry, { kind: "cells" }>, s: RcSiteSettings, band: number): number | undefined {
  if (!s.cellPoint) return undefined;
  return (s.cellPoint === "outer" ? g.radiiKm[band] : ((band ? g.radiiKm[band - 1] : 0) + g.radiiKm[band]) / 2) * 1000;
}
/** Builds points from saved geometry/settings; terrain elevation is never used as breathing height. */
export function evaluatedReceptor(g: RcReceptorGeometry, s: RcSiteSettings, index: number): RcEvaluatedReceptor {
  if (siteReceptorIssues(s, g).length) throw new Error("Complete the site and receptor settings before evaluating points");
  if (!Number.isInteger(index) || index < 0 || index >= receptorCount(g)) throw new Error("Receptor index is outside the geometry");
  if (g.kind === "cells") {
    const band = index % g.radiiKm.length, sector = Math.floor(index / g.radiiKm.length);
    return { id: `S${String(sector + 1).padStart(2, "0")}R${String(band + 1).padStart(2, "0")}`, distanceMetres: cellDoseDistance(g, s, band)!,
      bearingDegrees: sector * 360 / g.sectors, bearingReference: "compass_north", heightMetres: s.receptorHeightMetres!, sector: sector + 1, band: band + 1 };
  }
  const p = g.points[index], dx = p.x - s.releaseX!, dy = p.y - s.releaseY!;
  return { id: p.id, x: p.x, y: p.y, distanceMetres: Math.hypot(dx, dy), bearingDegrees: (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360,
    bearingReference: "grid_north", heightMetres: p.heightMetres ?? s.receptorHeightMetres!, elevationMetres: p.elevationMetres, hillHeightMetres: p.hillHeightMetres };
}
