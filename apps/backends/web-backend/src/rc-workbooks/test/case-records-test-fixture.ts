import { readFileSync } from "fs";
import { resolve } from "path";
import { createHash } from "crypto";
import { parseRcSource } from "interfaces-shared-types/rc-workbooks/source-term-parser";
import { parseRcWeather } from "interfaces-shared-types/rc-workbooks/weather-parser";
import { parseRcReceptorGeometry } from "interfaces-shared-types/rc-workbooks/site-receptor-parser";
import type { createSourceTermTestApp } from "./source-term-test-app";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";

/** Seed only: Step 08 tests do not exercise the earlier input workflows or run a solver. */
export async function seedRcCase(t: Awaited<ReturnType<typeof createSourceTermTestApp>>) {
  const fixture = (name: string) => readFileSync(resolve(__dirname, "../../../../../interfaces/shared-types/rc-workbooks/test/fixtures", name));
  const store = async (name: string, kind: "source" | "site" | "weather") => {
    const bytes = fixture(name), entry = await t.documents.upload("rc-test", { buffer: bytes, originalName: name, mimeType: "text/plain", size: bytes.length }, { username: "preparer" }, kind === "source", kind === "site", kind === "weather");
    return { documentId: entry.documentId, filename: name, size: bytes.length, uploadedAt: entry.uploadedAt, sha256: createHash("sha256").update(bytes).digest("hex") };
  };
  const source = parseRcSource(fixture("MelMACCS-published-source-term.inp").toString("utf8"));
  const geometry = parseRcReceptorGeometry(fixture("SecPop-Noah-published-site-excerpt.txt").toString("utf8"));
  const weather = parseRcWeather(fixture("MacMetGen-Noah-published-day.MET").toString("utf8"));
  const center = geometry.kind === "cells" ? geometry.center : undefined;
  const doc = await t.workbooks.findOne({ workbookId: "rc-test" }).exec(), mef = doc!.mef as RadiologicalConsequenceAnalysis;
  mef.releaseCategoryToConsequence.releaseCategoryInputs[0].sourceTerm = { revision: 1, values: source, originalFile: await store("MelMACCS-published-source-term.inp", "source") };
  mef.protectiveActionParameters.siteAndReceptors = { revision: 1, settings: { latitude: center?.latitude ?? 35, longitude: center?.longitude ?? -80, receptorHeightMetres: 1.5, cellPoint: "mid" }, geometry, geometryFile: await store("SecPop-Noah-published-site-excerpt.txt", "site") };
  mef.meteorologicalData.weatherInputs = { revision: 1, settings: { latitude: center?.latitude ?? 35, longitude: center?.longitude ?? -80, year: 2019, windSectors: 64 }, data: weather.data, weatherFile: await store("MacMetGen-Noah-published-day.MET", "weather") };
  mef.dosimetry.doseInputs = { revision: 1, categories: [{ categoryId: "RC-1", settings: { integrationSeconds: 2592000, basis: "analyst" }, savedForSourceRevision: 1 }], libraries: [] };
  await t.workbooks.updateOne({ workbookId: "rc-test" }, { $set: { mef: JSON.parse(JSON.stringify(mef)), __v: 1 } }).exec();
  return mef;
}
