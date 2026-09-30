import type { RcSiteEconomyInput, RcEconomicRegion, RcEconomicCrop } from "interfaces-mef-types/rc/economic-inputs";

const number = "([+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[EeDd][+-]?\\d+)?)";
const regionLine = new RegExp(`^\\s*(\\d+)\\s+(.+?)\\s+${number}\\s+${number}\\s+${number}\\s+${number}\\s+${number}\\s*$`);
const cropLine = new RegExp(`^\\s*(\\d+)\\s+(.+?)\\s+${number}\\s+${number}\\s+${number}\\s*$`);
const value = (raw: string) => Number(raw.replace(/[dD]/, "E"));

/** Extracts only the site-file fields used for a MACCS-style regional economy review. */
export function parseRcSiteEconomy(original: string, filename: string): RcSiteEconomyInput {
  if (!original.trim() || original.length > 2_000_000) throw new Error("Choose a nonempty site file up to 2 MB.");
  const multiplierText = /\bEconomic_multiplier:\s*([\d.EeDd+-]+)/i.exec(original)?.[1];
  const expectedText = /^\s*(\d+)\s+ECONOMIC REGIONS\s*$/im.exec(original)?.[1];
  if (!multiplierText || !expectedText) throw new Error("Site file needs the economic multiplier and economic-region count.");
  const economicMultiplier = value(multiplierText), expectedRegions = Number(expectedText);
  if (!Number.isFinite(economicMultiplier) || economicMultiplier < 0 || !Number.isInteger(expectedRegions) || expectedRegions < 1 || expectedRegions > 99)
    throw new Error("Invalid economic multiplier or economic-region count.");
  const lines = original.split(/\r?\n/);
  const regionStart = lines.findIndex(line => /^\s*REGIONAL ECONOMIC DATA\s*$/i.test(line));
  if (regionStart < 0) throw new Error("No regional economic data block found.");
  const regions: RcEconomicRegion[] = [], regionIds = new Set<number>();
  for (const line of lines.slice(regionStart + 1)) {
    const text = line.trim();
    if (!text || text === "…" || text === "..." || text.startsWith("*")) continue;
    const fields = regionLine.exec(line);
    if (!fields) {
      if (/^\d+\s+/.test(text)) throw new Error(`Invalid regional economic row: ${text.slice(0, 80)}`);
      continue;
    }
    const index = Number(fields[1]), name = fields[2].trim();
    const amounts = fields.slice(3).map(value);
    if (index < 1 || index > expectedRegions || regionIds.has(index) || amounts.some(amount => !Number.isFinite(amount) || amount < 0) || amounts[0] > 1 || amounts[1] > 1)
      throw new Error(`Invalid or repeated economic region ${index}.`);
    regionIds.add(index);
    regions.push({ index, name, farmFraction: amounts[0], dairySalesFraction: amounts[1], annualFarmSalesPerHectare: amounts[2],
      farmlandValuePerHectare: amounts[3], nonFarmlandValuePerPerson: amounts[4], original: line });
  }
  if (!regions.length) throw new Error("No regional economic rows found.");
  const cropStart = lines.findIndex(line => /^\s*CROP SEASON AND SHARE\s*$/i.test(line));
  const cropEnd = cropStart < 0 ? -1 : lines.findIndex((line, i) => i > cropStart && /^\s*WATERSHED DEFINITION\b/i.test(line));
  const cropLines = cropStart < 0 ? [] : lines.slice(cropStart + 1, cropEnd < 0 ? regionStart : cropEnd);
  const crops: RcEconomicCrop[] = [], cropIds = new Set<number>();
  for (const line of cropLines) {
    const text = line.trim();
    if (!text || text === "…" || text === "...") continue;
    const fields = cropLine.exec(line);
    if (!fields) {
      if (/^\d+\s+/.test(text)) throw new Error(`Invalid crop row: ${text.slice(0, 80)}`);
      continue;
    }
    const index = Number(fields[1]), name = fields[2].trim(), [growingStartDay, growingEndDay, farmlandFraction] = fields.slice(3).map(value);
    if (cropIds.has(index) || index < 1 || index > 10 || !Number.isInteger(growingStartDay) || !Number.isInteger(growingEndDay) ||
      growingStartDay < 1 || growingEndDay > 365 || growingStartDay > growingEndDay || farmlandFraction < 0 || farmlandFraction > 1)
      throw new Error(`Invalid or repeated crop ${index}.`);
    cropIds.add(index);
    crops.push({ index, name, growingStartDay, growingEndDay, farmlandFraction, original: line });
  }
  if (crops.reduce((sum, crop) => sum + crop.farmlandFraction, 0) > 1 + 1e-9) throw new Error("Crop farmland fractions exceed 1.");
  return { filename, original, economicMultiplier, expectedRegions, regions, crops };
}
