import { RcSourceTermValuesSchema } from "interfaces-mef-types/zod/rc/source-term";
import type { RcSourceTermValues } from "interfaces-mef-types/rc/source-term";
/** Legacy EPA headers contain single-byte symbols; fixed columns are decoded before parsing. */
export function decodeRcText(bytes: Uint8Array): string {
  if (bytes.some((b) => b === 0 || (b < 32 && ![9, 10, 12, 13, 26].includes(b))))
    throw new Error("Import a readable scientific text file.");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252", { fatal: true }).decode(bytes);
  }
}

export function rcNumber(value: string | undefined, label: string): number {
  const text = value?.trim();
  if (!text || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eEdD][+-]?\d+)?$/.test(text))
    throw new Error(`Invalid number in ${label}.`);
  const result = Number(text.replace(/[dD]/g, "E"));
  if (!Number.isFinite(result)) throw new Error(`Non-finite number in ${label}.`);
  return result;
}
const tokens = (value: string | undefined): string[] => value?.trim().split(/\s+/).filter(Boolean) ?? [];
const values = (value: string | undefined, label: string): number[] => tokens(value).map((v) => rcNumber(v, label));
const first = (value: string | undefined, label: string): number => rcNumber(tokens(value)[0], label);
const unique = (items: string[], label: string): void => {
  if (new Set(items).size !== items.length) throw new Error(`Duplicate ${label}.`);
};
export function rcCards(raw: string): Map<string, string> {
  const result = new Map<string, string>();
  let previous: string | undefined;
  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim();
    if (!text || /^[*!]/.test(text)) {
      previous = undefined;
      continue;
    }
    const match = text.match(/^([A-Z_0-9]+\d{3})\s+(.*)$/);
    if (match) {
      if (result.has(match[1])) throw new Error(`Duplicate input record: ${match[1]}.`);
      result.set(match[1], match[2].trim());
      previous = match[1];
    } else if (previous && /^[+\-\d.]/.test(text)) {
      const before = result.get(previous) ?? "";
      result.set(previous, before + (/[EeDd][+-]$/.test(before) ? "" : " ") + text);
    } else previous = undefined;
  }
  return result;
}

export function parseRcSource(raw: string): RcSourceTermValues {
  const cards = rcCards(raw);
  const list = (prefix: string): [string, string][] =>
    [...cards].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b));
  const groups = list("ISGRPNAM").map(([key, name]) => ({ id: Number(key.slice(-3)), name: tokens(name)[0] }));
  const mappings = list("ISOTPGRP").map(([, value]) => tokens(value));
  unique(
    mappings.map((row) => row[0]),
    "nuclide-to-group assignments",
  );
  const groupByName = new Map(mappings.map((row) => [row[0], rcNumber(row[1], "ISOTPGRP")]));
  const inventory = list("RDCORINV").map(([, value]) => {
    const row = tokens(value);
    return { name: row[0], activityBq: rcNumber(row[1], "RDCORINV"), group: groupByName.get(row[0]) };
  });
  const count = first(cards.get("RDNUMREL001"), "RDNUMREL001");
  if (!inventory.length || !groups.length || !Number.isInteger(count) || count < 1 || count > 999)
    throw new Error("Import a MelMACCS file containing inventory, chemical groups and release segments.");
  if (first(cards.get("RDCORSCA001") ?? "1", "RDCORSCA001") !== 1)
    throw new Error("RDCORSCA must be 1 for this inventory import; supply the inventory already scaled to Bq.");
  if (cards.has("ISNUMISO001") && first(cards.get("ISNUMISO001"), "ISNUMISO001") !== inventory.length)
    throw new Error("Inventory count differs from ISNUMISO.");
  if (cards.has("ISMAXGRP001") && first(cards.get("ISMAXGRP001"), "ISMAXGRP001") !== groups.length)
    throw new Error("Group count differs from ISMAXGRP.");
  unique(
    inventory.map((row) => row.name),
    "inventory nuclides",
  );
  if (groups.some((g, i) => g.id !== i + 1)) throw new Error("Chemical group numbers must be consecutive from 1.");
  if (inventory.some((row) => !groups.some((g) => g.id === row.group)))
    throw new Error("Every inventory nuclide needs a listed chemical group.");
  if (mappings.length !== inventory.length || mappings.some((row) => !inventory.some((n) => n.name === row[0])))
    throw new Error("Nuclide-to-group assignments must match the inventory.");
  for (const prefix of ["RDRELFRC", "RDPDELAY", "RDPLUDUR", "RDPLHITE"]) {
    if (list(prefix).some(([key]) => Number(key.slice(-3)) < 1 || Number(key.slice(-3)) > count))
      throw new Error(`${prefix} includes a segment outside RDNUMREL.`);
  }
  const releases = Array.from({ length: count }, (_, i) => {
    const suffix = String(i + 1).padStart(3, "0");
    const read = (key: string): number | undefined =>
      cards.has(key + suffix) ? first(cards.get(key + suffix), key + suffix) : undefined;
    const fractions = values(cards.get("RDRELFRC" + suffix), "RDRELFRC" + suffix);
    if (fractions.length !== groups.length) throw new Error(`Release ${i + 1} needs one fraction per chemical group.`);
    return {
      id: i + 1,
      startSeconds: read("RDPDELAY"),
      durationSeconds: read("RDPLUDUR"),
      heightMetres: read("RDPLHITE"),
      fractions,
    };
  });
  groups.forEach((g, i) => {
    if (releases.reduce((sum, r) => sum + r.fractions[i], 0) > 1.0000001)
      throw new Error(`${g.name}: release fractions total more than 1.`);
  });
  return RcSourceTermValuesSchema.parse({ groups, inventory, releases });
}
