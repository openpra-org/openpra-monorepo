import type { RcCoordinateAnchor, RcReceptorGeometry, RcSiteCoordinates } from "interfaces-mef-types/rc/site-receptors";
import { RcReceptorGeometrySchema, RcSiteSettingsSchema } from "interfaces-mef-types/zod/rc/site-receptors";
import { rcNumber } from "./source-term-parser";

const numbers = (text: string | undefined, label: string) => (text?.trim().split(/\s+/).filter(Boolean) ?? []).map(s => rcNumber(s, label));
export function parseRcSiteCoordinates(raw: string): RcSiteCoordinates {
  const record = (name: string) => {
    const hits = [...raw.matchAll(new RegExp(`^\\s*${name}\\s+([^\\r\\n]+)`, "gm"))];
    if (hits.length > 1) throw new Error(`Duplicate ${name} coordinate record`);
    return hits[0]?.[1].trim().split(/\s+/)[0];
  };
  const lat = record("M1LATITUD01"), lon = record("M1LONGITU01");
  let result: RcSiteCoordinates;
  if (lat !== undefined || lon !== undefined) result = { latitude: rcNumber(lat, "latitude"), longitude: rcNumber(lon, "longitude"), origin: "MACCS parameter records" };
  else if (/SECPOP Version:/i.test(raw)) {
    const latitude = raw.match(/\bLatitude:\s*([^\s]+)/i)?.[1], longitude = raw.match(/\bLongitude:\s*([^\s]+)/i)?.[1];
    // SecPop headers use west-positive longitude; workbook coordinates use east-positive longitude.
    result = { latitude: rcNumber(latitude, "SecPop latitude"), longitude: -rcNumber(longitude, "SecPop longitude"), origin: "SecPop header · west longitude converted to east-positive" };
  } else throw new Error("Import MACCS latitude/longitude records or a SecPop site header");
  RcSiteSettingsSchema.parse({ latitude: result.latitude, longitude: result.longitude });
  return result;
}

export function parseRcReceptorGeometry(raw: string): RcReceptorGeometry {
  if (/SPATIAL INTERVALS/i.test(raw)) {
    const n = Number(raw.match(/(\d+)\s+SPATIAL INTERVALS/i)?.[1]);
    const sectors = Number(raw.match(/(\d+)\s+WIND DIRECTIONS/i)?.[1]);
    const radiiKm = numbers(raw.match(/SPATIAL DISTANCES\s+KILOMETERS\s+([\s\S]*?)\bPOPULATION/i)?.[1], "SecPop distances");
    if (radiiKm.length !== n) throw new Error("The SecPop file needs all spatial interval boundaries");
    const populationBlock = raw.match(/^\s*POPULATION\s*\r?\n([\s\S]*?)(?=^\s*LAND FRACTION\b)/im)?.[1];
    const populationByCell = populationBlock && !/\.\.\.|…/.test(populationBlock) ? numbers(populationBlock, "SecPop population") : undefined;
    if (populationByCell && (populationByCell.length !== n * sectors || populationByCell.some(value => !Number.isInteger(value) || value < 0)))
      throw new Error("SecPop population must contain one nonnegative whole-person count per cell");
    const hasCenter = /\bLatitude:|\bLongitude:/i.test(raw);
    return RcReceptorGeometrySchema.parse({ kind: "cells", radiiKm, sectors, center: hasCenter ? parseRcSiteCoordinates(raw) : undefined,
      abridged: /ABRIDGED|…/i.test(raw), populationByCell });
  }
  if (/^\s*(?:RE\s+)?(?:GRIDCART|DISCPOLR|EVALCART)\b/im.test(raw)) throw new Error("Import an AERMAP DISCCART list or one GRIDPOLR grid");
  if (/ELEVUNIT\s+FEET/i.test(raw)) throw new Error("Import AERMAP elevation records in metres");
  const anchors = [...raw.matchAll(/^\s*(?:\*\*\s*)?(?:CO\s+)?ANCHORXY\s+([^\r\n]+)/gmi)];
  if (anchors.length !== 1) throw new Error("An AERMAP file needs one ANCHORXY coordinate reference");
  const a = numbers(anchors[0][1], "ANCHORXY");
  if (a.length !== 6) throw new Error("ANCHORXY needs six coordinate-reference values");
  const anchor: RcCoordinateAnchor = { localX: a[0], localY: a[1], utmEasting: a[2], utmNorthing: a[3], zone: a[4], datum: a[5] };
  const discrete = [...raw.matchAll(/^\s*(?:RE\s+)?DISCCART\s+([^\r\n]+)/gmi)];
  const starts = [...raw.matchAll(/\bGRIDPOLR\s+(\S+)\s+STA\b/gi)];
  if (discrete.length && starts.length) throw new Error("Choose a file containing one receptor geometry, not a mixed list and grid");
  if (discrete.length) {
    const output = /AERMAP\s*-\s*VERSION/i.test(raw);
    const points = discrete.map((m, i) => {
      const row = numbers(m[1], `point ${i + 1}`);
      if (row.length < 2 || row.length > (output ? 5 : 4)) throw new Error(`Check the fields in point ${i + 1}`);
      return { id: `P${String(i + 1).padStart(2, "0")}`, x: row[0], y: row[1], elevationMetres: row[2], hillHeightMetres: output ? row[3] : undefined, heightMetres: output ? row[4] : row[3] };
    });
    return RcReceptorGeometrySchema.parse({ kind: "points", points, anchor });
  }
  if (starts.length !== 1) throw new Error("Import a SecPop area grid, AERMAP point list, or one AERMAP polar grid");
  const name = starts[0][1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const line = (key: string) => {
    const matches = [...raw.matchAll(new RegExp(`^\\s*(?:RE\\s+)?(?:GRIDPOLR\\s+)?${name}\\s+${key}\\s+([^\\r\\n]+)`, "gmi"))];
    if (matches.length !== 1) throw new Error(`The polar grid needs one ${key} record`);
    return numbers(matches[0][1], key);
  };
  const origin = line("ORIG"), radiiMetres = line("DIST"), directions = line("GDIR");
  if (origin.length !== 2 || directions.length !== 3 || !Number.isInteger(directions[0]) || directions[0] < 1 || directions[0] > 360 || directions[2] <= 0 || directions[0] * radiiMetres.length > 100000)
    throw new Error("Check the polar origin, radii and direction settings (at most 100,000 points)");
  const bearingsDegrees = Array.from({ length: directions[0] }, (_, i) => ((directions[1] + directions[2] * i) % 360 + 360) % 360);
  const extras = new Map<string, number[]>();
  for (const key of ["ELEV", "HILL", "FLAG"]) {
    const rows = [...raw.matchAll(new RegExp(`^\\s*(?:RE\\s+)?GRIDPOLR\\s+${name}\\s+${key}\\s+(\\d+)\\s+([^\\r\\n]+)`, "gmi"))];
    for (const row of rows) {
      const index = Number(row[1]) - 1, values = numbers(row[2], key), id = `${key}_${index}`;
      if (index < 0 || index >= bearingsDegrees.length || values.length !== radiiMetres.length || extras.has(id)) throw new Error(`Check ${key} values and direction indices`);
      extras.set(id, values);
    }
    if (rows.length && rows.length !== bearingsDegrees.length) throw new Error(`Supply ${key} values for every grid direction`);
  }
  const points = bearingsDegrees.flatMap((bearing, j) => radiiMetres.map((radius, i) => ({
    id: `D${j + 1}R${i + 1}`, x: origin[0] + radius * Math.sin(bearing * Math.PI / 180), y: origin[1] + radius * Math.cos(bearing * Math.PI / 180),
    radiusMetres: radius, bearingDegrees: bearing, elevationMetres: extras.get(`ELEV_${j}`)?.[i], hillHeightMetres: extras.get(`HILL_${j}`)?.[i], heightMetres: extras.get(`FLAG_${j}`)?.[i],
  })));
  return RcReceptorGeometrySchema.parse({ kind: "grid", points, anchor, radiiMetres, bearingsDegrees, originX: origin[0], originY: origin[1] });
}
