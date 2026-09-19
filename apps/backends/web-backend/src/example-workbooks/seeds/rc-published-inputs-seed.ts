import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { RadiologicalConsequenceAnalysisSchema } from "interfaces-mef-types/zod/rc/radiological-consequence-analysis";
import type { RcSourceTerm } from "interfaces-mef-types/rc/source-term";
import { decodeRcText, parseRcSource } from "interfaces-shared-types/rc-workbooks/source-term-parser";
import { withSourceTermSummary } from "interfaces-shared-types/rc-workbooks/source-term-summary";
import { parseRcReceptorGeometry, parseRcSiteCoordinates } from "interfaces-shared-types/rc-workbooks/site-receptor-parser";
import { parseRcWeather, parseRcWeatherConfiguration } from "interfaces-shared-types/rc-workbooks/weather-parser";
import { parseRcDecay, parseRcDispersionReference } from "interfaces-shared-types/rc-workbooks/transport-parser";
import { effectiveTransportSettings } from "interfaces-shared-types/rc-workbooks/transport";
import { parseRcDoseCoefficients, parseRcExposure } from "interfaces-shared-types/rc-workbooks/dose-input-parser";
import { createBlankRc } from "../../rc-workbooks/blank-rc";

export const RC_PUBLISHED_ID = "published-rc-inputs";
export const RC_PUBLISHED_SLUG = "rc-published-inputs";
export const RC_PUBLISHED_LABEL = "Published RC inputs expert review";
export const RC_PUBLISHED_CATEGORY = "MELMACCS-APP-C";
export const RC_PUBLISHED_DATE = "2026-09-12T00:00:00.000Z";
export const RC_PUBLISHED_SOURCES = {
  melmaccs: "https://maccs.sandia.gov/docs/MelMACCS%20Documents/MELMACCS_Users_Guide_4.0.0_SAND2022-13278_Update.pdf",
  site: "https://www.nrc.gov/docs/ML2520/ML25203A330.pdf",
  thesis: "https://repository.lib.ncsu.edu/bitstreams/2af41279-fd84-46ec-a243-c4f99c1abe9a/download",
  dispersion: "https://www.energy.gov/sites/default/files/2018/07/f54/Final_MACCS2_Guidance_Report_June_1_2004_508C.pdf",
  decay: "https://www.nndc.bnl.gov/ensdfarchivals/distributions/dist23/ensdf_230403.zip",
  dose: "https://www.epa.gov/system/files/other-files/2023-04/fgr13pak.zip",
};
export const RC_PUBLISHED_FILES = [
  { filename: "MelMACCS-published-source-term.inp", kind: "source", source: RC_PUBLISHED_SOURCES.melmaccs, location: "Appendix C, printed pp. 75–85", method: "Published source-term and deposition cards; PDF wrapping joined. All numeric values retained." },
  { filename: "SecPop-Noah-published-site-excerpt.txt", kind: "site", source: RC_PUBLISHED_SOURCES.site, location: "Appendix B.6, printed p. 76", method: "Published abridged site file; ellipses retained. Full geometry, incomplete population and economic arrays." },
  { filename: "MACCS-Noah-site-coordinates-excerpt.txt", kind: "site", source: RC_PUBLISHED_SOURCES.site, location: "Appendix B.7, printed pp. 76–77", method: "Published latitude and longitude cards." },
  { filename: "MacMetGen-Noah-published-day.MET", kind: "weather", source: RC_PUBLISHED_SOURCES.site, location: "Appendix B.4, printed p. 73", method: "Published 24-hour excerpt; original fixed-column values retained. Not a full annual series." },
  { filename: "MacMetGen-Noah-published-config.inp", kind: "weather", source: RC_PUBLISHED_SOURCES.site, location: "Appendix B.3, printed p. 72", method: "Published 2020 generation configuration; original path placeholders retained." },
  { filename: "MACCS2-DOE-published-dispersion.inp", kind: "transport", source: RC_PUBLISHED_SOURCES.dispersion, location: "Printed p. 7-4 (PDF p. 101)", method: "Published power-law dispersion coefficient cards; a MACCS reference." },
  { filename: "NNDC-ENSDF-2023-04-03-mass-137.txt", kind: "transport", source: RC_PUBLISHED_SOURCES.decay, location: "ensdf.137, archival release 2023-04-03", method: "Unmodified mass-137 archive member; parent, level and decay records." },
  { filename: "MACCS-Noah-dose-settings-excerpt.inp", kind: "dose", source: RC_PUBLISHED_SOURCES.thesis, location: "Printed pp. 101 and 110 (PDF pp. 114 and 123)", method: "Published ENDEMP duration and 90th-percentile evacuation-cohort exposure records; selected blocks combined." },
  { filename: "FGR13INH.HDB", kind: "dose", source: RC_PUBLISHED_SOURCES.dose, location: "fgr13pak/FGR13INH.HDB", method: "Unmodified EPA archive member; original coefficient units and record alternatives." },
  { filename: "F12TIII1.EXT", kind: "dose", source: RC_PUBLISHED_SOURCES.dose, location: "fgr13pak/F12TIII1.EXT", method: "Unmodified EPA archive member; air-submersion dose-rate coefficients." },
  { filename: "F12TIII3.EXT", kind: "dose", source: RC_PUBLISHED_SOURCES.dose, location: "fgr13pak/F12TIII3.EXT", method: "Unmodified EPA archive member; ground-surface dose-rate coefficients." },
  { filename: "MACCS-Noah-health-settings-excerpt.inp", kind: "reference", source: RC_PUBLISHED_SOURCES.thesis, location: "Printed pp. 99–100 (PDF pp. 112–113)", method: "Published early-fatality, injury and latent-cancer parameter cards, not calculated outcomes." },
] as const;

/** Only bundled, allowlisted published files can be loaded. Production copies this directory. */
export function readRcPublishedFile(filename: string): Buffer {
  if (!RC_PUBLISHED_FILES.some(f => f.filename === filename) && filename !== "sources.txt") throw new Error("Unknown published RC input");
  const candidates = [join(__dirname, "example-documents", "RC-Published-Inputs", filename), join(__dirname, "../../../example-documents/RC-Published-Inputs", filename), join(process.cwd(), "apps/backends/web-backend/example-documents/RC-Published-Inputs", filename), join(process.cwd(), "dist/apps/backends/web-backend/example-documents/RC-Published-Inputs", filename)];
  const path = candidates.find(existsSync);
  if (!path) throw new Error(`Published RC input asset is missing: ${filename}`);
  return readFileSync(path);
}
export function publishedRcFileMetadata(filename: string): NonNullable<RcSourceTerm["originalFile"]> {
  const bytes = readRcPublishedFile(filename), hex = createHash("sha256").update(`rc-published:${filename}`).digest("hex");
  return { documentId: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`, filename,
    sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.length, uploadedAt: RC_PUBLISHED_DATE };
}
export function createPublishedRcSeed() {
  const text = (name: string) => decodeRcText(readRcPublishedFile(name)), file = publishedRcFileMetadata;
  const rc = createBlankRc(RC_PUBLISHED_LABEL, "Published-source review example");
  rc.uuid = RC_PUBLISHED_SLUG; rc.created = RC_PUBLISHED_DATE; rc.modified = RC_PUBLISHED_DATE;
  rc.metadata.analysisDate = RC_PUBLISHED_DATE; rc.metadata.lastModifiedDate = RC_PUBLISHED_DATE; rc.metadata.versionInfo.lastUpdated = RC_PUBLISHED_DATE;
  rc.workflowHistory = [{ state: "DRAFT", enteredAt: RC_PUBLISHED_DATE, actor: "Published-source review example" }];
  rc.modelUncertainty.uuid = "rc-published-input-uncertainty";
  const scope = "RC interface review using published input examples. The source term, site/weather examples and reference libraries have separate origins; together they are not a validated accident calculation for one plant. Numeric inputs are traced to the files and sources below. No solver has been run for this example.";
  rc.metadata.scope = scope; rc.praScope = scope;
  rc.scope = { ...rc.scope, consequenceMetrics: ["30-day TEDE input preparation; no calculated dose"], protectiveActionsModellingDegree: "Published MACCS shielding records for reference", meteorologyModellingDegree: "24 published hourly records plus their 2020 generation configuration", atmosphericDispersionModellingDegree: "Published source segments, MACCS coefficient references and documented OpenRC deposition defaults", dosimetryModellingDegree: "30-day integration and original EPA inhalation, cloudshine and groundshine coefficient files", healthEffectsModellingDegree: "Published MACCS model parameters for reference", economicFactorsModellingDegree: "Published SecPop excerpt; no reconstructed cost or population arrays" };
  const source = { revision: 1, values: parseRcSource(text("MelMACCS-published-source-term.inp")), originalFile: file("MelMACCS-published-source-term.inp") };
  rc.releaseCategoryToConsequence.releaseCategoryInputs = [withSourceTermSummary({ releaseCategory: RC_PUBLISHED_CATEGORY, sourceTermDefinitionRef: "MelMACCS 4.0.0 User Guide · Appendix C", releaseCharacteristics: { releaseUncertainties: "Published sample output, not a reactor-specific mechanistic source-term claim. Release heights are explicitly zero in the original cards." }, sourceTerm: source })];
  rc.releaseCategoryToConsequence.reviewBasis = "Imported numeric values are published; expert review is pending.";
  rc.releaseCategoryToConsequence.siteInformation = { isBounding: false, siteReference: "Noah Etter NRC methodology example · Appendix B.6–B.7" };
  const location = parseRcSiteCoordinates(text("MACCS-Noah-site-coordinates-excerpt.txt")), geometry = parseRcReceptorGeometry(text("SecPop-Noah-published-site-excerpt.txt"));
  rc.protectiveActionParameters.siteAndReceptors = { revision: 1, settings: { latitude: location.latitude, longitude: location.longitude }, geometry, locationOrigin: location.origin, locationFile: file("MACCS-Noah-site-coordinates-excerpt.txt"), geometryFile: file("SecPop-Noah-published-site-excerpt.txt") };
  rc.protectiveActionParameters.releaseSourceGeographicLocation = "Published MACCS site: 35.31028°, −93.23194°. SecPop grid: 14 distance bands × 64 sectors = 896 cells.";
  rc.protectiveActionParameters.populationDistribution = { basis: "DEMOGRAPHIC_SOURCES", description: "Published SecPop header: Census2010.bin, population multiplier 1.03; Appendix B.6 shows only selected population rows. The 896-cell geometry is complete; omitted population cells remain unspecified.", projectionAdjustments: "Original population multiplier 1.03 retained; it is not applied again." };
  rc.protectiveActionParameters.landUseData = { basis: "REGIONAL_SPECIFIC", description: "Published excerpt: 7 crop categories, 4 water-pathway isotopes, 1 watershed, 83 economic regions. Partial land/region arrays remain in the original file." };
  rc.protectiveActionParameters.plantPhysicalCharacteristics.description = "Plant structures and receptor height are not specified in these selected files.";
  rc.protectiveActionParameters.parameterUncertaintyCharacterization = "Select the receptor height and dose-evaluation point in Step 02. These are not stated in the published SecPop geometry and were not invented for the seed.";
  rc.protectiveActionParameters.sourceDocuments = [{ document: RC_PUBLISHED_SOURCES.site, usage: "Site coordinates, SecPop geometry and demographic/economic excerpt" }, { document: RC_PUBLISHED_SOURCES.thesis, usage: "Published MACCS exposure and shielding parameters" }];
  const exposure = parseRcExposure(text("MACCS-Noah-dose-settings-excerpt.inp"));
  rc.protectiveActionParameters.protectionParameters = Object.entries(exposure.blocks[0].records).map(([parameter, value]) => ({ parameter, value: `${value}${parameter.startsWith("SEBRRATE") ? " m³/s" : " (dimensionless)"}`, source: "Etter thesis, printed p. 110; MACCS reference record, not an OpenRC setting" }));
  const weather = parseRcWeather(text("MacMetGen-Noah-published-day.MET")), config = parseRcWeatherConfiguration(text("MacMetGen-Noah-published-config.inp"));
  rc.meteorologicalData.weatherInputs = { revision: 1, settings: { latitude: config.latitude, longitude: config.longitude, year: 2020, windSectors: config.windSectors }, data: weather.data, configuration: config, weatherFile: file("MacMetGen-Noah-published-day.MET"), configurationFile: file("MacMetGen-Noah-published-config.inp") };
  rc.meteorologicalData.dataSource = "Noah Etter NRC report, Appendix B.3–B.4: MacMetGen configuration and published single-day output; NAM12_2020.";
  rc.meteorologicalData.periodSelection.periodDescription = "2020-01-01: 24 hourly records. The companion request covers 2020-01-01 to 2020-12-31; the other days are not included in the publication excerpt.";
  rc.meteorologicalData.spatialRepresentativenessJustification = "Published weather coordinates 35.29890°, −93.24220° differ from the site coordinates 35.31028°, −93.23194°. Nearby-source acceptance remains for the analyst; neither location has been moved.";
  rc.meteorologicalData.timeResolution = "60 minutes; 64 wind-direction sectors; original /UTCTIM −5 retained.";
  rc.meteorologicalData.stabilityClassificationMethod = { approach: "RECOGNIZED_SOURCE", description: "SRDT: solar radiation/delta-T, selected in the published MacMetGen configuration." };
  rc.meteorologicalData.accuracyReview = { performed: false, findings: "Source excerpts are available for expert review. Annual completeness and nearby-site suitability have not been asserted." };
  const decay = parseRcDecay(text("NNDC-ENSDF-2023-04-03-mass-137.txt"));
  rc.atmosphericTransportAndDispersion.transportInputs = { revision: 1, categories: [{ categoryId: RC_PUBLISHED_CATEGORY, settings: effectiveTransportSettings(source.values) }], decayFiles: [{ file: file("NNDC-ENSDF-2023-04-03-mass-137.txt"), parents: decay.map(d => d.parent) }], dispersionReference: { file: file("MACCS2-DOE-published-dispersion.inp"), data: parseRcDispersionReference(text("MACCS2-DOE-published-dispersion.inp")) } };
  rc.atmosphericTransportAndDispersion.dispersionModel = { modelClass: "STRAIGHT_LINE_GAUSSIAN", name: "OpenRC model described in Etter thesis", justification: "Published model description, printed pp. 81–82; no transport calculation is executed by this seed." };
  rc.atmosphericTransportAndDispersion.temporalResolution.description = "The documented OpenRC model holds weather constant within a trial.";
  rc.atmosphericTransportAndDispersion.plumeSegmentation = { approach: "MULTIPLE_PLUMES", description: "Eight release segments from MelMACCS Appendix C." };
  rc.atmosphericTransportAndDispersion.windFieldData = "The 24 published MacMetGen weather rows are retained in Step 03.";
  rc.atmosphericTransportAndDispersion.deposition.dryDeposition = { included: true, approach: "SINGLE_VELOCITY", velocities: [{ particleSize: "Noble-gas chemical group (not a particle-size bin)", velocity: 0 }, { particleSize: "Other chemical groups: documented OpenRC default", velocity: .003 }] };
  rc.atmosphericTransportAndDispersion.parameterUncertaintyCharacterization = "0 and 0.003 m/s are documented defaults in Etter thesis p. 82. Parent-only mode is the workbook's initial review selection; both parent-only and ingrowth modes are documented. Mass-137 ENSDF is a real reference file; other missing parent records remain visible.";
  rc.dosimetry.doseInputs = { revision: 1, categories: [{ categoryId: RC_PUBLISHED_CATEGORY, settings: { integrationSeconds: exposure.integrationSeconds, basis: "imported" }, exposure: { file: file("MACCS-Noah-dose-settings-excerpt.inp"), data: exposure } }], libraries: ([ ["inhalation", "FGR13INH.HDB"], ["cloudshine", "F12TIII1.EXT"], ["groundshine", "F12TIII3.EXT"] ] as const).map(([kind, filename]) => { const records = parseRcDoseCoefficients(text(filename), kind); return { kind, file: file(filename), nuclides: [...new Set(records.map(r => r.name))], recordCount: records.length }; }) };
  rc.dosimetry.exposurePathways = ["INHALATION", "CLOUDSHINE", "GROUNDSHINE"].map(pathway => ({ pathway: pathway as "INHALATION" | "CLOUDSHINE" | "GROUNDSHINE", included: true }));
  rc.dosimetry.exposurePeriods = [{ period: "2,592,000 s = 30 days", justification: "SRENDEMP001 in the published thesis input, printed p. 101." }];
  rc.dosimetry.breathingRates.description = "MACCS reference SEBRRATE001/002/003 = 2.66×10⁻⁴ m³/s in the published exposure block.";
  rc.dosimetry.dcf = { source: `Original EPA FGR13PAK files: ${RC_PUBLISHED_SOURCES.dose}`, type: "EFFECTIVE" };
  rc.dosimetry.doseAggregationMethod = "No dose has been computed for this composite input-review example.";
  rc.healthEffects.earlyHealthEffects = ["Published parameter reference: bone-marrow fatality", "Published parameter reference: pulmonary fatality", "Published parameter reference: gastrointestinal fatality"];
  rc.healthEffects.earlyEffectParameters = { approach: "ORGAN_SPECIFIC_DOSE_RESPONSE", description: "Etter thesis p. 99, EFATAGRP: marrow α=5.6 Sv, β=6.1, threshold=2.3 Sv; lungs α=24 Sv, β=9.6, threshold=14 Sv; stomach α=12 Sv, β=9.3, threshold=6.5 Sv. Parameters only; no health consequences calculated." };
  rc.healthEffects.latentHealthEffects = ["Leukemia", "Bone", "Breast", "Lung", "Thyroid", "Liver", "Colon", "Residual"];
  rc.healthEffects.latentEffectParameters = { approach: "ORGAN_SPECIFIC_FACTORS", description: "Published MACCS input reference, thesis p. 100: leukemia fatality/incidence 0.0111/0.0113 per Sv; lung 0.0198/0.0208 per Sv. All 8 LCANCERS records are retained in the health-settings excerpt. These are coefficient parameters, not disease counts." };
  rc.healthEffects.riskFactorSources = [{ source: RC_PUBLISHED_SOURCES.thesis, recognizedBody: "Published MACCS input reproduced by Noah A. Etter; model-reference values", version: "2026 thesis, pp. 99–100" }];
  rc.economicFactors.costCategories = [{ category: "Published SecPop economic inputs", parameterDefinitions: ["Economic multiplier = 1.35 in the original header", "83 economic regions in the original header", "Partial regional values are retained as file references"] }];
  rc.economicFactors.costParameterEstimates = [{ parameter: "Economic multiplier: 1.35 (dimensionless)", dataBasis: "REGIONAL_SITE_APPLICABLE", source: `${RC_PUBLISHED_SOURCES.site} — Appendix B.6`, justification: "Published header value; not applied again and not a calculated cost." }];
  rc.consequenceQuantification.resultsConfirmation.description = "Input-review example only. No invented OpenRC output, dose, release frequency, injury count or cost is included.";
  rc.documentation = { ...rc.documentation, processDescription: scope, inputsDescription: RC_PUBLISHED_FILES.map(f => `${f.filename} — ${f.location}\n${f.source}\n${f.method}`).join("\n\n"), appliedMethods: "Existing file parsers preserve published quantities and original files. Activity: Bq; release timing: s; height: m; native coefficient units remain in EPA headers.", resultsSummary: "Published numerical inputs and an input snapshot are supplied for interface review. Calculated-result records remain empty.",
    rcreProcess: "69 nuclides, 10 chemical groups, 8 release segments from MelMACCS Appendix C; all original numeric cards retained.", rcpaProcess: "896 cells from 14 published radial bands and 64 sectors. Receptor height and within-cell evaluation choice remain unset because the file does not specify them.", rcmeProcess: rc.meteorologicalData.periodSelection.periodDescription,
    rcadProcess: rc.atmosphericTransportAndDispersion.parameterUncertaintyCharacterization!, rcdoProcess: "Published 30-day duration and complete EPA coefficient files. Coverage is checked against the actual source inventory.", rcheProcess: "Published MACCS health-effect input parameters are shown for reference; no health-effects solver is connected.", rcecProcess: "Only published SecPop header and excerpt information is supplied; no missing populations or regional costs were reconstructed.", rcqProcess: "Inspect inputs and original files, review unresolved choices, and inspect the immutable input snapshot. No synthetic returned output is seeded.", praTaskInterfaces: "This example is registered only for the Radiological Consequences workbook. No linked ES, MS, RI or other workbook is created." };
  rc.exampleDocuments = [{ id: "rc-published-input-sources", name: "Published RC inputs sources and expert review guide", kind: "doc", sizeLabel: "Source guide", uploadedLabel: "Bundled published example", extracted: scope, linked: 12, url: "/api/example-documents/rc/rc-published-input-sources" }, { id: "rc-published-health-records", name: "Published MACCS health-effect parameter records", kind: "doc", sizeLabel: "18 input records", uploadedLabel: "Etter thesis, pp. 99–100", extracted: "Published parameter values for inspecting the existing Health Effects section. Not calculated outcomes.", linked: 1, url: "/api/example-documents/rc/rc-published-health-records" }];
  return RadiologicalConsequenceAnalysisSchema.parse(JSON.parse(JSON.stringify(rc)));
}
