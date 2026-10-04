import { DistributionType } from "../core/events";
import type { FrequencyDataSource, FrequencyQuantificationBasis, InitiatingEventsAnalysis } from "../ie/initiating-event-analysis";
import type { DaEvidenceKind, DaSource, DaSourceEntry, DaSourceOrigin } from "./data-analysis";

export interface DaCatalogSource {
  id: string;
  name: string;
  provides: string;
  kind: DaEvidenceKind;
  origin: DaSourceOrigin;
  estimates?: number;
  dataset?: string;
  yearsFrom?: string;
  yearsTo?: string;
  boundaryConvention?: string;
  failureCounting?: string;
  quality?: string;
  reference?: string;
}

export const DA_INL_2020_ID = "INL-2020";

export const DA_NASCORD_ID = "NASCORD";

export const DA_SOURCE_CATALOG: DaCatalogSource[] = [
  {
    id: DA_INL_2020_ID,
    name: "NUREG/CR-6928 2020 update (INL/EXT-21-65055)",
    provides: "Industry-average failure probabilities, failure rates, unavailability and initiator frequencies",
    kind: "GENERIC_NUCLEAR",
    origin: "OTHER_NUCLEAR",
    estimates: 432,
    dataset: "source-inl-2020.json",
    yearsFrom: "2006",
    yearsTo: "2020",
    boundaryConvention: "Every component type has a written boundary in Appendix A. A valve includes its operator, local breaker and local controls. A pump includes its driver, local breaker, local lubrication or cooling and local controls. Each row carries its own boundary statement.",
    failureCounting: "Failures, demands and run hours come from IRIS records obtained through RADS for 2006 to 2020. Reactor protection rows come from the system studies. A few rows come from the WSRC database or carry over from NUREG/CR-6928.",
    quality: "Plant-level empirical Bayes with the Kass-Steffey adjustment (EB/PL/KS). The Jeffreys distribution at industry level (JNID/IL) replaces it when empirical Bayes returns no result or its 5th percentile is more than four orders of magnitude below the mean. All data are from U.S. light water reactors.",
    reference: "Z. Ma, T. E. Wierman and K. J. Kvarfordt, INL/EXT-21-65055, Idaho National Laboratory, November 2021",
  },
  { id: "NRC-ROE", name: "NRC Reactor Operational Experience Results and Databases", provides: "Current component, initiator, loss of offsite power and common cause estimates", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR" },
  {
    id: "CCF-2020",
    name: "CCF Parameter Estimations, 2020 Update, Revision 1 (INL/EXT-21-62940)",
    provides: "Alpha factor distributions, MLEs and MGL parameters for CCCG sizes 2 to 8 by component, system and failure mode, plus generic and prior distributions",
    kind: "GENERIC_NUCLEAR",
    origin: "OTHER_NUCLEAR",
    estimates: 15440,
    dataset: "source-ccf-2020.json",
    yearsFrom: "2006",
    yearsTo: "2020",
    boundaryConvention: "Each CCF template is a query rule over the NRC CCF database by component type, failure mode and, where named, system or plant group. Pooled templates cover all systems. A CCF event needs two or more failed or degraded components at one plant and in one system, from a single shared cause. Failures caused by equipment outside the component boundary are excluded.",
    failureCounting: "CCF events and independent failure counts come from the NRC CCF database for 1/1/2006 to 12/31/2020, queried in RADS with the SPAR Rules 2020 folder. Each event is coded as an impact vector with degradation, timing and shared cause factors and mapped to CCCG sizes 2 to 8. Only CCF events are counted and unavailability events are excluded.",
    quality: "Each template is a Bayesian update of the 2015 generic Dirichlet prior (1997-2015 data) with the mapped impact vectors. The report prints the 5th, mean, median and 95th values, the MLE and the Beta marginal a and b, and converts mean alpha factors to MGL parameters. Many system-specific templates have zero CCF events and stay close to the prior. Two templates (ALL-PDP-FR and CCF-DEM) print summary tables that do not match their distribution tables.",
    reference: "Z. Ma and K. J. Kvarfordt, CCF Parameter Estimations, 2020 Update, INL/EXT-21-62940 Revision 1, Idaho National Laboratory, August 2022",
  },
  { id: "NUREG-CR-6268", name: "NUREG/CR-6268", provides: "Common cause failure event database", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR" },
  { id: "ICDE", name: "OECD/NEA ICDE", provides: "International common cause failure events", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR" },
  {
    id: "NUREG-1715",
    name: "NUREG-1715 Component Performance Study, Vols. 1-4 (turbine-driven pumps, motor-driven pumps, air-operated valves, motor-operated valves)",
    provides: "Probability of failure on demand, standby failure rates, failures per component-year and failure cause shares for safety-related pumps and valves in U.S. light water reactors",
    kind: "GENERIC_NUCLEAR",
    origin: "OTHER_NUCLEAR",
    estimates: 1252,
    dataset: "source-nureg-1715.json",
    yearsFrom: "1987",
    yearsTo: "1998",
    boundaryConvention: "A turbine-driven pump assembly is the pump, turbine driver and governor with their piece parts. Steam inlet, suction and discharge valves, flow instruments and remote controls are outside. A motor-driven pump assembly is the pump, motor and circuit breaker. Valve assemblies are the valve body plus the air or motor operator, without MSIVs, PORVs, non-integral instrument air parts or the MOV circuit breaker.",
    failureCounting: "Only complete failures of Application Coded components in risk-important systems count. NPRDS gives surveillance test failures and test frequencies for 1987-1995, and LERs in SCSS give ESF actuation failures and demands for 1987-1998. Pump start and run failures and valve open, close and operate failures are pooled as failure on demand. Surveillance demands are estimated from test frequency, component count and years.",
    quality: "Failure on demand uses a Bayes method with a beta plant-to-plant distribution fit by maximum likelihood, or a noninformative prior for sparse data, with 90% intervals. Classical 90% chi-square intervals are given for information. Standby rates divide failures by calendar component-hours, so they are not run-time rates. The volumes are scanned and some printed values disagree between tables, which the affected entries note.",
    reference: "J. R. Houghton and H. G. Hamzehee (Vols. 1-2) and J. R. Houghton (Vols. 3-4), NUREG-1715 Vols. 1-4, U.S. Nuclear Regulatory Commission, Office of Nuclear Regulatory Research, April 2000, June 2000, July 2001 and September 2001",
  },
  { id: "NUREG-CR-5750", name: "NUREG/CR-5750", provides: "Historical initiator rates", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR" },
  {
    id: "NUREG-1829",
    name: "NUREG-1829, Estimating Loss-of-Coolant Accident (LOCA) Frequencies Through the Elicitation Process, Vols. 1 and 2",
    provides: "Expert elicitation LOCA frequencies for BWRs and PWRs by flow rate category and plant age, with sensitivity cases, plus base case pipe failure rates, LOCA frequencies and PFM probabilities.",
    kind: "GENERIC_NUCLEAR",
    origin: "OTHER_NUCLEAR",
    estimates: 2585,
    dataset: "source-nureg-1829.json",
    yearsFrom: "1970",
    yearsTo: "2006",
    boundaryConvention: "LOCA categories are cumulative flow rate thresholds from more than 100 gpm to more than 500,000 gpm, each with a BWR and a PWR effective break size. Only passive primary pressure boundary failures count, both piping and non-piping such as the vessel, nozzles, valve bodies, pump casings and steam generator tubes. Active failures such as stuck-open valves and pump seal LOCAs are excluded. Panelists used ASME rules to split piping from non-piping.",
    failureCounting: "No LOCA of Category 2 or larger has occurred, so the estimates rest on expert judgment anchored to base cases. The base cases use pipe failure records from about 1970 to 2003 (PIPExp, SLAP and LERs) and PFM codes. Category 1 checks use U.S. operating experience to December 2006. Frequencies are per calendar year unless a table states reactor years.",
    quality: "Twelve panelists gave median and 5th and 95th percentile ratios relative to the base cases. Responses were combined as split lognormals and aggregated with the geometric mean, with arithmetic-mean and mixture aggregation as sensitivity cases. Uncertainty is very large and the group results depend most on the aggregation method. The report does not recommend one set of estimates for all uses.",
    reference: "R. Tregoning, L. Abramson, P. Scott, NUREG-1829 Vols. 1 and 2, U.S. Nuclear Regulatory Commission, April 2008",
  },
  {
    id: "NUREG-CR-6890",
    name: "NUREG/CR-6890 Vols. 1 and 2 (INL/EXT-05-00501) with the LOOP 2023 update (INL/RPT-24-79969)",
    provides: "Loss of offsite power frequencies by category and plant mode, recovery time distributions and non-recovery probabilities, emergency diesel generator reliability and CCF factors, and station blackout core damage results",
    kind: "GENERIC_NUCLEAR",
    origin: "OTHER_NUCLEAR",
    estimates: 5486,
    dataset: "source-nureg-cr-6890.json",
    yearsFrom: "1986",
    yearsTo: "2023",
    boundaryConvention: "A LOOP is the simultaneous loss of offsite power to all safety buses of a unit that requires all emergency generators to start. Events are split into plant-centered, switchyard-centered, grid-related and weather-related LOOPs, with the main and station transformer high-voltage terminals and the point where lines leave the switchyard as the borders. Critical operation counts LOOPs with a reactor trip, and shutdown operation counts LOOPs while the unit is shut down. EDG failure modes follow the SPAR models: fail to start, fail to load and run for 1 h, fail to run after 1 h, and test or maintenance unavailability.",
    failureCounting: "LOOP events come from licensee event reports and are counted per unit for frequencies. Durations use the potential bus recovery time, counted once per site when several units are hit by one event. LOOPs without a reactor trip and partial LOOPs are not counted. EDG counts come from EPIX for 1998-2002 and from unplanned undervoltage demands in LERs for 1997-2003.",
    quality: "Frequencies are Jeffreys or constrained noninformative Bayesian updates, or empirical Bayes gamma distributions where plant or site variation was found. Recovery times are lognormal fits by matching moments. SBO core damage values are SPAR model point estimates and Monte Carlo uncertainty results. Volumes 1 and 2 are scanned pages, so values were read from the OCR text and checked against page images and internal identities.",
    reference: "S. A. Eide, C. D. Gentillon, T. E. Wierman and D. M. Rasmuson, NUREG/CR-6890 Vols. 1 and 2 (INL/EXT-05-00501), U.S. NRC and Idaho National Laboratory, December 2005. N. Johnson and Z. Ma, Analysis of Loss-of-Offsite-Power Events 2023 Update, INL/RPT-24-79969, Idaho National Laboratory, July 2024.",
  },
  { id: "NUREG-CR-5496", name: "NUREG/CR-5496 and NUREG/CR-5032", provides: "Loss of offsite power events and recovery times", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR" },
  { id: "EPRI-LOOP", name: "EPRI loss of offsite power reports", provides: "Loss of offsite power events and durations", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR" },
  { id: "EPRI-3002000079", name: "EPRI 3002000079", provides: "Pipe rupture frequencies", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR" },
  { id: "CODAP", name: "OECD/NEA CODAP (formerly OPDE)", provides: "Piping and passive component failures", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR" },
  { id: "NUCLARR", name: "NUREG/CR-4639 (NUCLARR)", provides: "Legacy component reliability compendium", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR" },
  { id: "NUREG-CR-4550", name: "NUREG/CR-4550", provides: "NUREG-1150 generic data", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR" },
  { id: "IAEA-TECDOC-478", name: "IAEA-TECDOC-478 and IAEA-TECDOC-508", provides: "Component reliability data and ranges", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR" },
  { id: "IAEA-TECDOC-719", name: "IAEA-TECDOC-719", provides: "Initiator data, including rare initiators", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR" },
  { id: "IEEE-500", name: "IEEE Std 500", provides: "Nuclear electrical, sensing and mechanical component data", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR" },
  { id: "IEEE-493", name: "IEEE Std 493 (Gold Book)", provides: "Electrical failure rates and repair downtime", kind: "ANALOGOUS_INDUSTRY", origin: "NONNUCLEAR" },
  { id: "T-BOOK", name: "T-Book", provides: "Nordic component reliability data", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR" },
  { id: "ZEDB", name: "ZEDB", provides: "German component reliability data", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR" },
  { id: "EIREDA", name: "EIReDA", provides: "European component reliability data", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR" },
  { id: "CREDO", name: "CREDO", provides: "Sodium component reliability", kind: "TECHNOLOGY", origin: "SAME_TECHNOLOGY" },
  {
    id: DA_NASCORD_ID,
    name: "NaSCoRD sodium component reliability database",
    provides: "Sodium pump, valve and filter failure rates with their priors",
    kind: "TECHNOLOGY",
    origin: "SAME_TECHNOLOGY",
    estimates: 110,
    dataset: "source-nascord.json",
    yearsTo: "1990",
    boundaryConvention: "Components as recorded in the CREDO engineering data. Valves are grouped by actuator type, pumps as mechanical or electromagnetic, and filters by unit. Failure modes follow the EG&G Idaho categories.",
    failureCounting: "Failures come from CREDO event records and unusual occurrence reports, cleaned by the SNL and EG&G Idaho recommendations. Operating hours come from reactor state records. Demand counts are not reliable yet, so the source advises against per-demand rates.",
    quality: "Thousands of components and millions of operating hours from EBR-II, FFTF and U.S. sodium test loops. Pump and valve rates are Bayesian posteriors on the EG&G Idaho prior. Filter rates are failures over hours. Japanese data held in CREDO are not in NaSCoRD.",
    reference: "Denman, Stuart and Jankovsky, SAND2017-9517, Sandia National Laboratories, 2017, with the sodium valve paper (PSAM 14, 2018), the sodium pump paper (2019) and the sodium filter paper (2021)",
  },
  { id: "OREDA", name: "OREDA", provides: "Offshore oil and gas equipment", kind: "ANALOGOUS_INDUSTRY", origin: "NONNUCLEAR" },
  { id: "NPRD-EPRD", name: "NPRD and EPRD", provides: "Nonelectronic and electronic parts", kind: "ANALOGOUS_INDUSTRY", origin: "NONNUCLEAR" },
  { id: "MIL-HDBK-217F", name: "MIL-HDBK-217F", provides: "Electronic part failure rates", kind: "ENGINEERING_MODEL", origin: "NONNUCLEAR" },
  { id: "NSWC-11", name: "NSWC-11", provides: "Mechanical equipment base failure rates and correction factors", kind: "ENGINEERING_MODEL", origin: "NONNUCLEAR" },
  { id: "CCPS", name: "AIChE CCPS Guidelines for Process Equipment Reliability Data", provides: "Process equipment reliability data", kind: "ANALOGOUS_INDUSTRY", origin: "NONNUCLEAR" },
  { id: "WSRC-TR-93-262", name: "WSRC-TR-93-262", provides: "Savannah River Site generic database", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR" },
  {
    id: "SAND2022-14164",
    name: "SAND2022-14164 Compressed Natural Gas Component Leak Frequency Estimation",
    provides: "Annual leak frequency distributions for 11 CNG component types in five leak area bins, plus the literature leak frequencies behind them",
    kind: "ANALOGOUS_INDUSTRY",
    origin: "NONNUCLEAR",
    estimates: 470,
    dataset: "source-sand2022-14164.json",
    yearsFrom: "1981",
    yearsTo: "2021",
    boundaryConvention: "Components are binned by type only: compressor, filter, flange or gasket, heat exchanger, hose, instrument, joint, jumper, pipe, valve and vessel. Sizes and subtypes are pooled, so one valve estimate covers every valve. Leak size is the leak area as a fraction of the flow area of the connected piping, in bins of 0.01%, 0.1%, 1%, 10% and 100%.",
    failureCounting: "No events are counted. The inputs are published leak frequencies from a literature review, listed in Appendix A and mapped to leak area bins by qualitative labels or by area ratios. Only compressed gas data feed the model when they exist, and instruments and joints use generic data. The years shown are the publication years of the data sources.",
    quality: "A Bayesian log-linear model of log frequency against log leak area is fit by Markov chain Monte Carlo for each component. The compressed gas data are sparse and old, and none fall in the 0.01% and 0.1% bins, so those bins are extrapolated. The authors warn that the uncertainty may be underestimated and recommend the medians for QRA.",
    reference: "D. Brooks, A. Glover, B. D. Ehrhart, SAND2022-14164, Sandia National Laboratories, October 2022",
  },
  {
    id: "SAND2020-10828",
    name: "SAND2020-10828 Hydrogen Plant Hazards and Risk Analysis for Siting near Nuclear Power Plants",
    provides: "Generic and hydrogen component leak frequencies by leak size, facility leak frequency for a steam electrolysis hydrogen plant, and wind fragilities of nuclear plant structures and switchyard parts",
    kind: "ANALOGOUS_INDUSTRY",
    origin: "NONNUCLEAR",
    estimates: 357,
    dataset: "source-sand2020-10828.json",
    yearsFrom: "1975",
    yearsTo: "2007",
    boundaryConvention: "Leak frequencies are per component type with subtypes and sizes pooled. Leak size is the leak area as a fraction of the total flow area: very small 0.01%, minor 0.1%, medium 1%, major 10% and rupture 100%. Pipe frequencies are per meter of pipe. Fragilities are conditional failure probabilities of plant structures and switchyard parts at a given wind speed.",
    failureCounting: "Generic leak frequencies are published values from chemical process, compressed gas, nuclear and offshore sources (Table B-1), published from 1975 to 2007. Hydrogen leak counts over component-years come from Compressed Gas Association members through NFPA 2 TG6, cited from LaChance et al. (SAND2009-0874), and are not shown. Wind fragilities are taken from the Duane Arnold IPEEE and a Vogtle high wind study.",
    quality: "A Bayesian log-linear model of leak frequency against leak area is fit by Markov chain Monte Carlo to the generic data and then updated with the hydrogen counts. Generic data exist only for the 1%, 10% and 100% bins, so smaller bins are extrapolated. The facility frequency multiplies assumed component counts and pipe lengths for a postulated design.",
    reference: "A. Glover, A. Baird, D. Brooks, SAND2020-10828, Sandia National Laboratories, October 2020",
  },
  { id: "MOSS", name: "T. R. Moss, The Reliability Data Handbook", provides: "Component data tables", kind: "ANALOGOUS_INDUSTRY", origin: "NONNUCLEAR" },
];

export function daCatalogSource(catalogId: string, id: string, entries: DaSourceEntry[] = []): DaSource | undefined {
  const entry = DA_SOURCE_CATALOG.find((candidate) => candidate.id === catalogId);
  if (entry === undefined) return undefined;
  const source: DaSource = {
    id,
    name: entry.name,
    catalogId: entry.id,
    kind: entry.kind,
    origin: entry.origin,
    covers: entry.provides,
    boundaryConvention: entry.boundaryConvention ?? "",
    failureCounting: entry.failureCounting ?? "",
    quality: entry.quality ?? "",
    reference: entry.reference ?? "",
    entries,
  };
  if (entry.yearsFrom !== undefined) source.yearsFrom = entry.yearsFrom;
  if (entry.yearsTo !== undefined) source.yearsTo = entry.yearsTo;
  return source;
}

const IE_BASIS_LABELS: Record<FrequencyQuantificationBasis, string> = {
  OPERATING_DATA: "Plant operating data",
  GENERIC_DATA: "Generic industry data",
  SIMILAR_PLANT_DATA: "Similar-plant and fleet data",
  DESIGN_BASED: "Design-based estimate",
  FAULT_TREE: "Initiator fault tree",
};

const Z95 = 1.6448536269514722;

function ieMemberEntry(source: FrequencyDataSource): DaSourceEntry {
  const split = source.label.indexOf(" - ");
  const id = split === -1 ? source.label : source.label.slice(0, split);
  const named = split === -1 ? source.label : source.label.slice(split + 3);
  const bounding = " (bounding member)";
  const component = named.endsWith(bounding) ? named.slice(0, named.length - bounding.length) : named;
  const entry: DaSourceEntry = { id, component, failureMode: "Member initiator frequency", quantity: "PER_YEAR", table: "Frequency quantification, member data sources", method: `${IE_BASIS_LABELS[source.basis]}. ${source.sourceReference}` };
  if (source.eventCount !== undefined && source.exposureModuleYears !== undefined) {
    entry.failures = source.eventCount;
    entry.exposure = source.exposureModuleYears;
  }
  if (source.faultTreeTopMean !== undefined) entry.mean = source.faultTreeTopMean;
  const median = source.distributionParameters?.[0];
  const errorFactor = source.distributionParameters?.[1];
  if (source.distributionFamily === "LOGNORMAL" && median !== undefined && errorFactor !== undefined) entry.distribution = { type: DistributionType.LOGNORMAL, median, errorFactor };
  return entry;
}

export function daIeQuantificationEntries(analysis: InitiatingEventsAnalysis, bases?: readonly FrequencyQuantificationBasis[]): DaSourceEntry[] {
  const entries: DaSourceEntry[] = [];
  const taken = new Set<string>();
  const wanted = (basis: FrequencyQuantificationBasis): boolean => bases === undefined || bases.includes(basis);
  for (const quantification of analysis.quantifications) {
    const group = analysis.initiatingEventGroups.find((candidate) => candidate.uuid === quantification.initiatorOrGroupId);
    const frequency = quantification.meanFrequency;
    const entry: DaSourceEntry = {
      id: quantification.initiatorOrGroupId,
      component: group?.name ?? quantification.initiatorOrGroupId,
      failureMode: group === undefined ? "Initiator frequency" : "Group frequency",
      quantity: "PER_YEAR",
      table: "Frequency quantification",
      mean: typeof frequency === "number" ? frequency : frequency.value,
      method: `${IE_BASIS_LABELS[quantification.basis]}.`,
    };
    if (typeof frequency !== "number") {
      const errorFactor = frequency.distribution?.parameters[1];
      if (frequency.distribution?.type === DistributionType.LOGNORMAL && errorFactor !== undefined && errorFactor > 1) {
        const sigma = Math.log(errorFactor) / Z95;
        entry.distribution = { type: DistributionType.LOGNORMAL, median: Number((frequency.value / Math.exp((sigma * sigma) / 2)).toPrecision(4)), errorFactor };
      }
    }
    if (wanted(quantification.basis) && !taken.has(entry.id)) {
      entries.push(entry);
      taken.add(entry.id);
    }
    for (const source of quantification.dataSources ?? []) {
      if (source.uuid === quantification.primaryDataSourceId) continue;
      const member = ieMemberEntry(source);
      if (!wanted(source.basis) || taken.has(member.id)) continue;
      entries.push(member);
      taken.add(member.id);
    }
  }
  return entries;
}
