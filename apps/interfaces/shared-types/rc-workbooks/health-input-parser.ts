import type { RcHealthInput, RcHealthParameterRecord } from "interfaces-mef-types/rc/health-inputs";

const cards = {
  EFATAGRP: { kind: "early_fatality", values: 3 },
  EINJUGRP: { kind: "early_injury", values: 4 },
  LCANCERS: { kind: "latent_cancer", values: 6 },
} as const;

/** Reads the three MACCS health card families shown in the published health input excerpt. */
export function parseRcHealthInput(original: string, filename: string): RcHealthInput {
  if (!original.trim() || original.length > 128_000) throw new Error("Choose a nonempty health input up to 128 KB.");
  const records: RcHealthParameterRecord[] = [], ids = new Set<string>();
  for (const line of original.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("*") || trimmed.startsWith("#")) continue;
    const prefix = /^(EFATAGRP|EINJUGRP|LCANCERS)/i.exec(trimmed)?.[1]?.toUpperCase() as keyof typeof cards | undefined;
    if (!prefix) continue;
    const tokens = trimmed.match(/'[^']*'|"[^"]*"|\S+/g) ?? [];
    const cardId = tokens[0]?.toUpperCase() ?? "";
    const spec = cards[prefix], labels = prefix === "EFATAGRP" ? 1 : 2;
    if (!new RegExp(`^${prefix}\\d{3}$`).test(cardId) || tokens.length !== 1 + labels + spec.values)
      throw new Error(`Incomplete ${prefix} health record: ${trimmed.slice(0, 80)}`);
    if (ids.has(cardId)) throw new Error(`Duplicate health record ${cardId}`);
    ids.add(cardId);
    const unquote = (value: string) => value.replace(/^['"]|['"]$/g, "");
    const values = tokens.slice(1 + labels).map(value => Number(value.replace(/[dD]/, "E")));
    if (values.some(value => !Number.isFinite(value) || value < 0)) throw new Error(`Invalid numerical value in ${cardId}`);
    records.push({ cardId, kind: spec.kind, effect: unquote(tokens[1]), organ: unquote(tokens[labels]), values, original: line });
    if (records.length > 500) throw new Error("Health input has more than 500 records.");
  }
  if (!records.length) throw new Error("No EFATAGRP, EINJUGRP or LCANCERS records found.");
  return { filename, original, records };
}

export function rcHealthEffectLabel(record: RcHealthParameterRecord): string {
  return record.kind === "early_fatality" ? `${record.effect} fatality` : record.effect;
}
