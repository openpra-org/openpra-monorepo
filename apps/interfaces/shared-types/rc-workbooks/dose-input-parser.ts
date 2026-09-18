import type { RcDosePathway, RcDoseRecord, RcExposureData } from "interfaces-mef-types/rc/dose-inputs";
import { RcExposureDataSchema } from "interfaces-mef-types/zod/rc/dose-inputs";
import { decodeRcText, rcNumber } from "./source-term-parser";
// EPA's legacy text has 0xFF header padding and a DOS end-of-file marker.
// Keep original bytes in storage; the shared decoder supports UTF-8 and legacy ANSI text.
export const decodeRcDoseText = decodeRcText;
export const doseLines = (raw: string) => raw.replace(/\r/g, "").split("\n").filter(l => l.trim() && l.trim() !== "\x1a");
export function parseRcExposure(raw: string): RcExposureData {
  let duration: number | undefined, block = 0;
  const blocks = new Map<number, Record<string, number>>();
  for (const line of doseLines(raw)) {
    if (line.trim() === ".") { block++; continue; }
    if (/^\s*\*/.test(line)) continue;
    const m = line.match(/^\s*(SRENDEMP001|SE(?:BRRATE|CSFACT|GSHFAC|PROTIN)\d{3})\s+(.*)$/);
    if (!m) { if (/^\s*(SRENDEMP|SE(?:BRRATE|CSFACT|GSHFAC|PROTIN))/.test(line)) throw new Error("Incomplete MACCS exposure record"); continue; }
    const key = m[1], value = rcNumber(m[2].trim(), key);
    if (key === "SRENDEMP001") {
      if (value <= 0) throw new Error("ENDEMP must be greater than zero");
      if (duration !== undefined && duration !== value) throw new Error("Import one emergency-phase duration at a time");
      duration = value; continue;
    }
    if (!/00[123]$/.test(key)) throw new Error("Exposure activity indices must be 001, 002 or 003");
    if (value < 0 || !key.startsWith("SEBRRATE") && value > 1) throw new Error("Breathing rates must be nonnegative; protection multipliers must be between zero and one");
    const records = blocks.get(block) ?? {};
    if (key in records) throw new Error(`Duplicate ${key}; separate MACCS exposure blocks with a period line`);
    records[key] = value; blocks.set(block, records);
  }
  if (duration === undefined) throw new Error("Choose MACCS text containing SRENDEMP001");
  return RcExposureDataSchema.parse({ integrationSeconds: duration, blocks: [...blocks].map(([index, records]) => ({ index, records })) });
}
const number = (v: string, label: string) => { const n = rcNumber(v, label); if (n < 0) throw new Error(`Negative ${label}`); return n; };
export function parseRcDoseCoefficients(raw: string, kind: RcDosePathway): RcDoseRecord[] {
  const lines = doseLines(raw), inhalation = kind === "inhalation", headerCount = inhalation ? 2 : 3;
  const header = lines.slice(0, headerCount).join(" ");
  if (inhalation ? !/Inhalation Dose Coefficients/i.test(header) || !/e_50/.test(header) : !(kind === "cloudshine" ? /Unit Volume Source.*Air Submersion/i : /Unit Surface Source/i).test(header) || !/H sub E/.test(header))
    throw new Error(`Choose the EPA ${inhalation ? "FGR13INH.HDB" : kind === "cloudshine" ? "F12TIII1.EXT" : "F12TIII3.EXT"} format for this pathway`);
  const result: RcDoseRecord[] = [], identities = new Set<string>();
  for (const rawLine of lines.slice(headerCount)) {
    const name = rawLine.slice(0, 7).trim(), width = inhalation ? 363 : 250;
    if (rawLine.length < width || rawLine.slice(width).trim()) throw new Error("Incomplete or overlong fixed-column coefficient record");
    if (inhalation && !name && rawLine.slice(0, 32).trim() === "" && rawLine[32] === "H") {
      const previous = result[result.length - 1];
      if (!previous?.inhalation || previous.inhalation.components !== 2 || previous.inhalation.let !== "L" || previous.inhalation.highLet) throw new Error("Unmatched high-LET companion record");
      const values = Array.from({ length: 31 }, (_, i) => rawLine.slice(33 + i * 10, 43 + i * 10).trim());
      values.forEach(v => number(v, "high-LET coefficient"));
      if (rawLine.slice(343).replace(/[\s|]/g, "")) throw new Error("Unexpected high-LET companion fields");
      previous.inhalation.highLet = { raw: rawLine, values }; continue;
    }
    if (!/^[A-Z][a-z]?-[0-9]+[mgnab]?$/.test(name)) throw new Error("Check the coefficient nuclide columns");
    const values = Array.from({ length: inhalation ? 33 : 27 }, (_, i) => rawLine.slice((inhalation ? 33 : 7) + i * (inhalation ? 10 : 9), (inhalation ? 43 : 16) + i * (inhalation ? 10 : 9)).trim());
    values.forEach(v => number(v, `${name} coefficient`));
    const record: RcDoseRecord = { index: result.length, name, raw: rawLine, values, value: values[values.length - 1] };
    if (inhalation) {
      const ageDays = number(rawLine.slice(7, 12), "age"), amadMicrometres = number(rawLine.slice(12, 17), "AMAD"), absorption = rawLine[18].trim(), form = rawLine[20].trim(), f1 = rawLine.slice(21, 29).trim(), components = number(rawLine.slice(29, 31), "LET component count"), letValue = rawLine[32];
      if (!Number.isInteger(ageDays) || ![1, 2].includes(components) || !["L", "H"].includes(letValue) || number(f1, "f1") > 1 || !/^[FMSGV]$/.test(absorption) || !form) throw new Error(`Check inhalation metadata for ${name}`);
      record.inhalation = { ageDays, amadMicrometres, absorption, form, f1, components, let: letValue as "L" | "H" };
    }
    // Distinct chemical forms can share the displayed metadata (for example H-3 gases).
    // Keep their published order; only identical inhalation records are duplicates.
    const identity = inhalation ? rawLine : name;
    if (identities.has(identity)) throw new Error(`Duplicate coefficient record for ${name}`);
    identities.add(identity); result.push(record);
    if (result.length > 50000) throw new Error("Choose a library with at most 50,000 coefficient records");
  }
  if (!result.length) throw new Error("No radionuclide coefficient records found");
  return result;
}
