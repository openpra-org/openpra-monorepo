import type { RcDecayDetail, RcDecayLevel, RcDecayParent, RcDepositionData, RcDispersionReference } from "interfaces-mef-types/rc/transport";
import { RcDepositionDataSchema, RcDispersionReferenceSchema } from "interfaces-mef-types/zod/rc/transport";
import { rcCards, rcNumber } from "./source-term-parser";

export function parseRcDeposition(raw: string): RcDepositionData {
  const cards = rcCards(raw), list = (prefix: string) => [...cards].filter(([k]) => new RegExp(`^${prefix}\\d{3}$`).test(k)).sort(([a], [b]) => a.localeCompare(b));
  const values = (text: string | undefined, label: string) => (text?.trim().split(/\s+/) ?? []).map(n => rcNumber(n, label));
  const count = rcNumber(cards.get("DDNPSGRP001"), "DDNPSGRP001");
  const bins = list("DDVDEPOS");
  const velocities = bins.flatMap(([key, value]) => values(value, key));
  if (count !== velocities.length || !Number.isInteger(count) || count < 1 || count > 20) throw new Error("Check the particle-size bin count and deposition velocities");
  // Vectors may occupy one card or sequential cards. Gaps cannot identify the intended bin order.
  if (bins.some(([key], i) => Number(key.slice(-3)) !== i + 1)) throw new Error("Deposition velocity cards must have consecutive indices");
  const groupCards = list("ISGRPNAM");
  const declared = cards.get("ISMAXGRP001");
  if (declared !== undefined && rcNumber(declared, "ISMAXGRP001") !== groupCards.length) throw new Error("Deposition chemical-group count does not match the file");
  const groups = groupCards.map(([key, text]) => {
    const suffix = key.slice(-3), bits = cards.get(`ISDEPFLA${suffix}`)?.trim().split(/\s+/);
    if (bits && (bits.length !== 2 || bits.some(b => !/^\.(TRUE|FALSE)\.$/i.test(b)))) throw new Error("Check the wet/dry deposition flags");
    return { id: Number(suffix), name: text.trim().split(/\s+/)[0], fractions: values(cards.get(`RDPSDIST${suffix}`), `RDPSDIST${suffix}`),
      wet: bits ? /TRUE/i.test(bits[0]) : undefined, dry: bits ? /TRUE/i.test(bits[1]) : undefined };
  });
  if (list("RDPSDIST").some(([key]) => !groups.some(g => g.id === Number(key.slice(-3)))) || list("ISDEPFLA").some(([key]) => !groups.some(g => g.id === Number(key.slice(-3))))) throw new Error("Particle-size records refer to unknown chemical groups");
  return RcDepositionDataSchema.parse({ velocities, groups });
}
export function parseRcDispersionReference(raw: string): RcDispersionReference {
  const cards = rcCards(raw);
  if (rcNumber(cards.get("NUM_DIST001")?.split(/\s+/)[0], "NUM_DIST001") !== 0) throw new Error("Choose a MACCS power-law dispersion reference (NUM_DIST = 0)");
  const row = (name: string) => (cards.get(name)?.split(/\s+/) ?? []).map(n => rcNumber(n, name));
  return RcDispersionReferenceSchema.parse({ sigmaYA: row("DPCYSIGA001"), sigmaYB: row("DPCYSIGB001"), sigmaZA: row("DPCZSIGA001"), sigmaZB: row("DPCZSIGB001"),
    sidewaysScale: rcNumber(cards.get("DPYSCALE001"), "DPYSCALE001"), verticalScale: rcNumber(cards.get("DPZSCALE001"), "DPZSCALE001") });
}

const isotope = (text: string) => {
  const m = text.trim().match(/^(\d{1,3})([A-Z]{1,3})$/i);
  if (!m) throw new Error("Check the ENSDF nuclide identification columns");
  return `${m[2][0].toUpperCase()}${m[2].slice(1).toLowerCase()}-${Number(m[1])}`;
};
/** ENSDF P/L/B fields are inspected as published; this does not construct a decay-chain solver library. */
export function parseRcDecay(raw: string): RcDecayDetail[] {
  const result: RcDecayDetail[] = [];
  let dataset = "", daughter = "", parents: { parent: Omit<RcDecayParent, "index" | "levelCount">; original: string }[] = [], levels: RcDecayLevel[] = [], normalization: string[] = [];
  const finish = () => {
    for (const p of parents) result.push({ ...p, parent: { ...p.parent, index: result.length, levelCount: levels.length }, normalization: [...normalization], levels: levels.map(l => ({ ...l })), offset: 0 });
    if (result.length > 2000) throw new Error("Choose ENSDF files with at most 2,000 parent records each");
    parents = []; levels = []; normalization = [];
  };
  for (const line of raw.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n")) {
    if (!line.trim()) { finish(); dataset = ""; daughter = ""; continue; }
    if (line.slice(5, 9) === "    ") {
      finish(); dataset = line.slice(9, 39).trim();
      // Mass-chain downloads include non-nuclide COMMENTS and REFERENCES datasets.
      daughter = /^\d{1,3}\s*$/.test(line.slice(0, 5)) && /^(COMMENTS|REFERENCES)$/.test(dataset) ? "" : isotope(line.slice(0, 5)); continue;
    }
    const kind = line.slice(5, 8);
    if (!["  P", "  L", "  B", "  N", " PN"].includes(kind)) continue;
    if (!dataset || !daughter) throw new Error("ENSDF data records need a dataset identification record");
    if (kind === "  P") {
      const halfLife = line.slice(39, 49).trim(), energy = line.slice(9, 19).trim();
      if (!halfLife) continue;
      parents.push({ parent: { nuclide: isotope(line.slice(0, 5)), energy, halfLife, ground: /^0+(?:\.0*)?$/.test(energy), dataset, daughter }, original: line });
    } else if (kind === "  N" || kind === " PN") normalization.push(line);
    else if (kind === "  L") {
      levels.push({ nuclide: isotope(line.slice(0, 5)), energy: line.slice(9, 19).trim(), halfLife: line.slice(39, 49).trim(), metastable: line.slice(77, 78) === "M", betaFeeding: "" });
      if (levels.length > 10000) throw new Error("ENSDF dataset contains too many level records");
    } else if (kind === "  B" && levels.length) {
      const level = levels[levels.length - 1], feeding = line.slice(21, 29).trim();
      level.betaFeeding = level.betaFeeding ? `${level.betaFeeding}; ${feeding}` : feeding;
    }
  }
  finish();
  if (!result.length) throw new Error("Choose ENSDF text with parent (P) half-life records");
  return result;
}
