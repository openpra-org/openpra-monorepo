import type { Law, UncertainExpression } from "../core/uncertainty";
import type { FrequencyDataSource, FrequencyQuantificationBasis, InitiatingEventFrequencyQuantification, InitiatingEventsAnalysis } from "../ie/initiating-event-analysis";
import type { DaEvidenceKind, DaSource, DaSourceEntry, DaSourceOrigin } from "./data-analysis";

export interface DaCatalogSource {
  id: string;
  name: string;
  provides: string;
  kind: DaEvidenceKind;
  origin: DaSourceOrigin;
  estimates: number;
  dataset: string;
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
  {
    id: "ICDE",
    name: "OECD/NEA ICDE project reports on common-cause failures (ten component types)",
    provides: "Counts and shares of common-cause failure events by failure mode, severity, cause, coupling factor, detection, corrective action and population size, with event rates per observation year. No CCF parameters.",
    kind: "GENERIC_NUCLEAR",
    origin: "OTHER_NUCLEAR",
    estimates: 2717,
    dataset: "source-icde.json",
    yearsFrom: "1975",
    yearsTo: "2020",
    boundaryConvention: "An ICDE event is the complete, degraded or incipient impairment of two or more components of an observed population, within two inspection periods, from a shared cause. Severity runs from complete CCF, where all exposed components fail completely, through partial CCF and CCF impaired to incipient impairment. Each report sets its component boundary in its own coding guideline, for example a heat exchanger with its chambers, shell, tubes, adjacent piping and local valves.",
    failureCounting: "Members in Canada, Czechia, Finland, France, Germany, Japan, Korea, the Netherlands, Spain, Sweden, Switzerland, the United Kingdom and the United States code events from licensee event reports and maintenance records under the ICDE general coding guidelines. Each event is counted once with an impairment vector, root cause, coupling factor, detection method and corrective action. Tables count events, not failed components, and observation time is summed over component groups. Data are not complete for every country and period.",
    quality: "The public reports give descriptive event statistics and engineering insights. They give no CCF parameters, no demand or run time counts and no raw event records, which stay with the members. Shares here are counts over the printed or summed table total. Where a printed total or percentage disagrees with its parts, the row says so.",
    reference: "OECD Nuclear Energy Agency, Committee on the Safety of Nuclear Installations, ICDE project reports on heat exchangers NEA/CSNI/R(2015)11, switching devices and circuit breakers NEA/CSNI/R(2008)1, control rod drive assemblies NEA/CSNI/R(2013)4, level measurement components NEA/CSNI/R(2008)8, batteries NEA/CSNI/R(2023)8, check valves NEA/CSNI/R(2003)15, safety and relief valves NEA/CSNI/R(2020)17, motor-operated valves NEA/CSNI/R(2021)7, emergency diesel generators NEA/CSNI/R(2018)5 and centrifugal pumps NEA/CSNI/R(2013)2",
  },
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
  {
    id: "NUREG-CR-5750",
    name: "NUREG/CR-5750 (INEEL/EXT-98-00401), Rates of Initiating Events at U.S. Nuclear Power Plants: 1987 to 1995",
    provides: "Initiating event frequencies by category, plant type and plant, event counts, critical hours and criticality factors by plant and year, LOCA frequencies from Appendix J, and comparison values from the IPEs, NUREG-1150, WASH-1400 and others",
    kind: "GENERIC_NUCLEAR",
    origin: "OTHER_NUCLEAR",
    estimates: 5259,
    dataset: "source-nureg-cr-5750.json",
    yearsFrom: "1969",
    yearsTo: "1997",
    boundaryConvention: "An initiating event is an unplanned automatic or manual reactor trip that begins while the reactor is critical and at or above the point of adding heat. Each trip gets one initial plant fault, the first event in the sequence, from 48 mutually exclusive categories under 13 headings. Functional impact categories (26 categories under 12 headings) flag every risk-significant event that can affect decay heat removal anywhere in the trip sequence. General transients are trips with no direct impact on the systems that remove decay heat.",
    failureCounting: "Events come from Licensee Event Reports of unplanned reactor trips at U.S. commercial plants from 1987 through 1995, found through the Sequence Coding and Search System, which gave 1,985 reactor trips after screening. Each LER was coded by an experienced engineer and checked by a second analyst, and LERs that describe several trips were split. Exposure is critical years of 8,760 critical hours, 499 PWR and 230 BWR critical years for 1987-1995. Rare categories such as pipe break LOCAs, reactor coolant pump seal LOCA, two or more stuck open relief valves and total loss of service water use U.S. or world-wide experience from 1969 through 1997.",
    quality: "Counts are modeled as Poisson events with a constant rate, between-plant differences, an exponential time trend, or both, chosen by statistical tests. Constant categories use a Jeffreys noninformative prior, plant variation uses empirical Bayes gamma distributions, and trend categories report the 1995 end point. Medium and large LOCA frequencies combine crack data with a conservative conditional probability of break. The report is a scan, so every value was read from the page images. The p-values and model-choice statistics of Appendix F are not imported.",
    reference: "J. P. Poloski, D. G. Marksberry, C. L. Atwood and W. J. Galyean, NUREG/CR-5750 (INEEL/EXT-98-00401), Idaho National Engineering and Environmental Laboratory for the U.S. Nuclear Regulatory Commission, February 1999",
  },
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
  {
    id: "NUREG-CR-5496",
    name: "NUREG/CR-5496 (LOOP events 1980 to 1996) and NUREG/CR-5032 (LOOP recovery time models)",
    provides: "Loss of offsite power frequencies by category and plant mode, unit and site specific frequencies and counts, recovery time distributions and model weights, cause shares and comparisons with NUREG-1032",
    kind: "GENERIC_NUCLEAR",
    origin: "OTHER_NUCLEAR",
    estimates: 1569,
    dataset: "source-nureg-cr-5496.json",
    yearsTo: "1996",
    boundaryConvention: "A LOSP is the simultaneous loss of electrical power to all safety buses of a unit, which requires the emergency power generators to start and supply the safety buses. Unlike NUREG-1032, losses of non-vital buses alone are not counted. Events are classed as plant-centered, grid-related or severe weather, and as occurring at power or during shutdown. An event at power is an initiating event only if the LOSP caused the trip or both came from one root cause, and events recovered in under 2 minutes are called momentary.",
    failureCounting: "Events come from licensee event reports. NUREG/CR-5496 uses 157 events from 1980 to 1996, with plant-centered frequencies per unit critical or shutdown year and grid and weather frequencies and recovery times per site. NUREG/CR-5032 uses the 63 recovery times compiled in NUREG-1032 through 1985 plus four through June 1987. Recovery time is the time until offsite power could have been restored to at least one safety bus.",
    quality: "NUREG/CR-5496 gives Jeffreys, gamma and empirical Bayes frequency distributions and lognormal recovery times fitted after averaging multi-unit events. NUREG/CR-5032 fits exponential, lognormal, gamma and Weibull recovery models by maximum likelihood and weighs them by Bayesian posterior probabilities, with small grid and weather samples. Both reports are scans, so every value was read from the page images. Hypothesis test p-values and variance components are not imported.",
    reference: "C. L. Atwood, D. L. Kelly, F. M. Marshall, D. A. Prawdzik and J. W. Stetkar, NUREG/CR-5496 (INEEL/EXT-97-00887), INEEL for the U.S. NRC, November 1998. R. L. Iman and S. C. Hora, NUREG/CR-5032 (SAND87-2428), Sandia National Laboratories for the U.S. NRC, January 1988",
  },
  {
    id: "NUCLARR",
    name: "NUREG/CR-4639 Vol. 5 Part 3 Rev. 1, NUCLARR hardware component failure data (December 1988 additions)",
    provides: "Lognormal medians, 95th percentiles and error factors for 631 hardware component records with failure counts and exposure, plus five rates quoted from the source documents",
    kind: "GENERIC_NUCLEAR",
    origin: "OTHER_NUCLEAR",
    estimates: 636,
    dataset: "source-nuclarr.json",
    yearsFrom: "1972",
    yearsTo: "1982",
    boundaryConvention: "Each record is one cell of the NUCLARR hardware taxonomy, set by component type, design, normal state and failure mode. Instrument channel records also name the measured variable as the component application. Each record flags whether the circuit and the system are included, but the file does not define the component boundaries further.",
    failureCounting: "Most failure counts carry the record type LERS (licensee event reports), and some carry OTHR, plant operating experience. Exposure is printed as total component hours or demands, or as a number of components times hours or demands per component. For some relief valves the demand count is an average number of scrams. The records cite their source documents by NUCLARR document number only.",
    quality: "NUCLARR prints a lognormal median, a 95th percentile upper tolerance and their ratio as the error factor, computed from the failure count and exposure. The printed mean is failures over exposure, not the lognormal mean, so it is kept in the method. For zero failures on demands, 100 of 107 records print a median 6.6 to 6.8 times the Jeffreys median. This file holds only the Appendix E additions of December 1988, not the earlier Appendix D records.",
    reference: "D. I. Gertman, B. G. Gilbert, W. E. Gilmore and W. J. Galyean, NUCLARR Data Manual Part 3: Hardware Component Failure Data, NUREG/CR-4639 Vol. 5 Part 3 Rev. 1 (EGG-2458), EG&G Idaho for the U.S. NRC, January 1989",
  },
  {
    id: "EGG-SSRE-8875",
    name: "EGG-SSRE-8875, generic component failure data base for light water and liquid sodium reactor PRAs (1990)",
    provides: "Recommended failure rates for water, steam, sodium, air and electrical components, values quoted from ten other data bases, and NUCLARR and CREDO counts with exposure",
    kind: "GENERIC_NUCLEAR",
    origin: "OTHER_NUCLEAR",
    estimates: 913,
    dataset: "source-egg-ssre-8875.json",
    yearsTo: "1990",
    boundaryConvention: "Valves include the body, the operator and limit or torque switches mounted on the valve. Pumps include the body, the driver and local mechanical control. Instrumentation and control circuitry, support systems such as ac or dc power, air and hydraulics, and the solenoid valve that feeds air to a pneumatic valve are excluded. The NUCLARR and CREDO source data do not always follow these boundaries.",
    failureCounting: "NUCLARR data come from 19 plant-specific PRA and reliability study sources (category 1), LER surveys and IPRD reports with estimated demands (category 2), and IEEE Std-500, NPRD-3 and WASH-1400 (category 3), all as of February 1990. CREDO counts cover sodium and NaK components at United States and Japanese liquid metal reactors and test facilities as of February 1990. Each CREDO failure record was reviewed, some failure modes were reassigned, and events that were not failures in the PRA sense were dropped.",
    quality: "NUCLARR aggregation routines give a mean and error factor per category. CREDO means come from a Bayesian update of a noninformative prior, (2n+1)/(2T) per hour and (2n+1)/(2D+2) per demand. Recommended means are rounded to 1, 3 or 5 times a power of ten with judgemental error factors (95th percentile over median) of 3, 5, 10 or 30 under an assumed lognormal, and values based on no failures are likely conservative. The report is a scan, so every value was read from the page images.",
    reference: "S. A. Eide, S. V. Chmielewski and T. D. Swantz, EGG-SSRE-8875, EG&G Idaho, Inc. for the U.S. Department of Energy, February 1990",
  },
  {
    id: "NUREG-CR-4550",
    name: "NUREG/CR-4550 Vol. 1 Rev. 1 (SAND86-2084), NUREG-1150 internal events methodology and generic data",
    provides: "The NUREG-1150 generic data base: initiating event frequencies, component failure rates, test and maintenance unavailabilities, non-recovery and human error probabilities, beta factors and RCP seal LOCA probabilities, with ranges from other sources",
    kind: "GENERIC_NUCLEAR",
    origin: "OTHER_NUCLEAR",
    estimates: 801,
    dataset: "source-nureg-cr-4550.json",
    yearsTo: "1990",
    boundaryConvention: "Components are listed by type and failure mode, for example motor operated valve failure to operate or diesel generator failure to run. Valve and pump demand failures include both hardware faults and control circuit or circuit breaker command faults, and the comments give the split. Test and maintenance unavailability is a separate basic event. Initiating events are grouped by their effect on offsite power and the power conversion system, and LOCAs by break size.",
    failureCounting: "The ASEP values are generic values taken or adapted from earlier compilations and PRAs, mainly the NRC LER data summaries, the IREP Procedures Guide, WASH-1400, the Station Blackout Study and IEEE Std 500. The ranges from other sources were compiled from the cited references. Test and maintenance values come from a multiple regression analysis of plant answers to NUREG-0737 questions. Failure counts are printed only for a few values.",
    quality: "ASEP values are generic means with lognormal error factors, chosen by judgment from published values rather than by a formal Bayesian update. Non-recovery probabilities have maximum entropy distributions on a printed range, and human error probabilities are medians with error factors from the ASEP HRA procedure. The data years are not printed, so 1990, the report date, bounds them. The report is a scan, so every value was read from the page images.",
    reference: "D. M. Ericson Jr. (editor), T. A. Wheeler, T. T. Sype, M. T. Drouin, W. R. Cramond, A. L. Camp, K. J. Maloney and F. T. Harper, NUREG/CR-4550 Vol. 1 Rev. 1 (SAND86-2084), Sandia National Laboratories for the U.S. Nuclear Regulatory Commission, January 1990",
  },
  {
    id: "IAEA-TECDOC-478",
    name: "IAEA-TECDOC-478 (IAEA generic component reliability data base, 1988) and IAEA-TECDOC-508 (survey of ranges, 1989)",
    provides: "Generic failure rates, demand probabilities and repair times quoted record by record from 21 sources, plus TECDOC-508 per-demand conversions and WWER data base records",
    kind: "GENERIC_NUCLEAR",
    origin: "OTHER_NUCLEAR",
    estimates: 2184,
    dataset: "source-iaea-tecdoc-478.json",
    yearsFrom: "1968",
    yearsTo: "1989",
    boundaryConvention: "Each record is one component type and generic failure mode from one source, under a 5 character code for component category, group and type, generic failure mode and source. Component boundaries are those of the original source and are printed only where the source defines them, otherwise the record says detail n/a. The Swedish Reliability Data Book and the NUREG LER and IPRD studies define boundaries best, while expert and PSA sources treat components as off-the-shelf items. Operating mode defaults to all and environment to normal unless the source says otherwise.",
    failureCounting: "The IAEA did not count failures but copied each source value, with any counts and exposures the source gave placed in the record comments. The sources range from U.S. licensee event reports, plant maintenance and operating records (IPRD, Surry, Oconee, Zion, Old PWR, HWR) and Swedish failure reports, to expert opinion and mixed data (WASH-1400, IEEE Std 500, NUREG/CR-2815, IREP, German Risk Study, Sizewell B). TECDOC-508 reprints these records with hourly rates of demand failure modes converted to per demand values for an assumed monthly, quarterly or daily interval, and adds records of the WWER data base.",
    quality: "Values are reproduced without reinterpretation, so the meaning of each central value and bound follows its source: medians with 5th and 95th percentiles, Bayesian means, LER rates with confidence limits, IEEE recommended values with high and low points, or means of truncated log-uniform distributions. Range ends are separate entries and never percentiles. TECDOC-508 rows that repeat a TECDOC-478 record and value are not imported twice. Both documents are scans, so every value was read from the page images.",
    reference: "B. Tomic, Component Reliability Data for Use in Probabilistic Safety Assessment, IAEA-TECDOC-478, International Atomic Energy Agency, Vienna, October 1988. B. Tomic, Survey of Ranges of Component Reliability Data for Use in Probabilistic Safety Assessment, IAEA-TECDOC-508, International Atomic Energy Agency, Vienna, June 1989",
  },
  {
    id: "IAEA-TECDOC-719",
    name: "IAEA-TECDOC-719, Defining Initiating Events for Purposes of Probabilistic Safety Assessment (1993)",
    provides: "Initiating event frequencies from about 30 PWR, BWR and WWER PSAs, a generic data base of 272 initiator records, LOCA and rare initiator estimates, transient counts, hazard and flood frequencies",
    kind: "GENERIC_NUCLEAR",
    origin: "OTHER_NUCLEAR",
    estimates: 844,
    dataset: "source-iaea-tecdoc-719.json",
    yearsTo: "1992",
    boundaryConvention: "An initiating event is an incident that needs an automatic or operator action to bring the plant to a safe state, usually one that causes a scram above 5 to 25 percent power. Internal events are split into LOCAs by break size, transients grouped by plant response, and special common cause initiators that also degrade mitigating systems. Break size limits and transient groups differ between PSAs, so each value keeps the definition of its source study.",
    failureCounting: "Transient counts come from EPRI NP-801, EPRI NP-2230, the EG&G study NUREG/CR-3862, licensee event reports and plant records, counted per reactor-year from commercial operation. For ATWS, events at 25 to 110 percent power are also counted on their own. The database records copy the frequencies of published PSAs and name the source table and the ultimate data source.",
    quality: "Values are quoted from the source PSAs, which used one and two stage Bayesian updating, operating experience, expert opinion, fault tree analysis and pipe and valve failure rates. The document is a scan, so every imported value was read from the page images, and the two printouts of the appendix data base were checked against each other record by record. Core damage results quoted from the PSAs are not imported.",
    reference: "D. Ilberg, assisted by B. Linquist and J. Pereq, with the WWER section by A. Bareith, IAEA-TECDOC-719, International Atomic Energy Agency, Vienna, September 1993",
  },
  {
    id: "CREDO",
    name: "CREDO papers on liquid metal reactor component reliability (six ORNL conference papers, 1985 to 1992)",
    provides: "Liquid metal and water valve failure and maintenance rates, sodium valve event counts and rates, and EBR-II, FFTF and JOYO critical item shares of failure rate, unavailability and restoration time",
    kind: "TECHNOLOGY",
    origin: "SAME_TECHNOLOGY",
    estimates: 452,
    dataset: "source-credo.json",
    yearsFrom: "1978",
    yearsTo: "1992",
    boundaryConvention: "CREDO tracks only components that are liquid metal specific, exposed to liquid metal, in systems that interface with it such as cover gas or purification, or important to safety, sorted into 45 generic categories. A valve is the body, internals, operator and other mechanical parts, and the 1992 paper adds limit and torque switches and local controls. Power, air and hydraulic supplies are outside the component, and malfunctions caused from outside are secondary events. In the critical item lists the system is the set of all CREDO-tracked components at one reactor.",
    failureCounting: "Site staff at EBR-II, FFTF, the Energy Technology Engineering Center and Westinghouse test loops, JOYO and four O-arai Engineering Center test loops send engineering, operating and event records to CREDO at Oak Ridge National Laboratory. Each event record is one abnormal occurrence, failures are events that end satisfactory function, and unscheduled maintenance counts every anomaly that caused a work request. Component hours combine facility hours in each operating mode with the duty factors on the engineering record. The papers use the files as they stood from 1985 to 1992, with yearly failure rates plotted for 1978 to 1986.",
    quality: "Rates are classical point estimates, events over component hours with an exponential or Poisson model, and only the 1992 valve paper gives chi-square confidence limits. Critical item lists print only event counts and percent shares, so shares here are counts over the site event totals printed in each paper, and these totals differ between papers. Failures on demand are not separated from failures in operation, and the maintenance data mix restoration times at EBR-II and FFTF with repair times at JOYO. All six papers are scans, so every value was read from the page images.",
    reference: "S. L. Painter, H. E. Knee and B. Humphrys, CONF-850713-4, July 1985. M. J. Haire, H. E. Knee, J. J. Manning, J. F. Manneschmidt and K. Setoguchi, CONF-870468-1, April 1987. B. L. Humphrys, M. J. Haire, K. H. Koger, J. F. Manneschmidt, K. Setoguchi, R. Nakai and Y. Okubo, CONF-870917-2, September 1987. K. H. Koger, M. J. Haire, B. L. Humphrys, J. F. Manneschmidt, K. Setoguchi and R. Nakai, CONF-880601-34, June 1988. D. H. Wood, M. S. Smith and J. D. Drischler, CONF-920818-2, August 1992. M. S. Smith and J. D. Drischler, CONF-930116-8, 1992. Oak Ridge National Laboratory, with the Power Reactor and Nuclear Fuel Development Corporation of Japan for the 1987 and 1988 papers.",
  },
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
  {
    id: "EBR-II-PRA",
    name: "ANL-NSE-2, EBR-II Level 1 Probabilistic Risk Assessment (Argonne, 1991 final draft, published 2018)",
    provides: "EBR-II initiating event frequencies and counts, basic event failure rates and demand probabilities with CRBRP-4, IREP and generic comparison values, beta and MGL factors, human error probabilities, external event frequencies and refueling data for a sodium cooled pool reactor",
    kind: "TECHNOLOGY",
    origin: "SAME_TECHNOLOGY",
    estimates: 6150,
    dataset: "source-ebr-ii-pra.json",
    yearsFrom: "1964",
    yearsTo: "1989",
    boundaryConvention: "Each basic event is one component and one failure mode in a system fault tree, named by an eight character code, and wiring, fuses, relay coils and contacts are separate basic events. Initiating events are grouped by plant response, such as single and double primary pump loss of flow, reactivity insertions, loss of heat sink and local faults. Each human failure event is one task quantified with a human event tree. Models reflect the plant as of October 1989 with three 100 day runs per year.",
    failureCounting: "Initiating event counts come from EBR-II Unusual Occurrence Reports for 1975 to 1989, and rare events use fault trees or engineering judgment. Component values start from IEEE Std 500, IREP and the Clinch River Breeder Reactor PRA (CRBRP-4) and are refined with CREDO data checked against EBR-II records. For the reactor shutdown system a plant record survey counted unsafe failures against 1.80E+5 hours per component. Human error probabilities come from the NUREG/CR-1278 and NUREG/CR-4772 tables.",
    quality: "Basic event values are lognormal means with the listed error factors, and plant specific rates use the mean (2N+1)/(2T) of a noninformative prior update. Common cause uses generic beta factors because EBR-II had almost no common cause events, and many values rest on engineering judgment. The seismic section is a placeholder and two pages of Section 10 are missing from the scan. All values were read from the page images, and physics tables and sequence results are not imported.",
    reference: "D. J. Hill, W. A. Ragland and J. Roglans-Ribas, Experimental Breeder Reactor II (EBR-II) Level 1 Probabilistic Risk Assessment, ANL-NSE-2, Argonne National Laboratory, final draft June 30, 1991, published August 1, 2018",
  },
  {
    id: "MIL-HDBK-217F",
    name: "MIL-HDBK-217F Notice 2, Reliability Prediction of Electronic Equipment",
    provides: "Part stress base failure rates and pi factors for electronic parts, plus parts count generic failure rates by environment and quality factors",
    kind: "ENGINEERING_MODEL",
    origin: "NONNUCLEAR",
    estimates: 6724,
    dataset: "source-mil-hdbk-217f.json",
    boundaryConvention: "Most part types have a model in which a base failure rate is multiplied by pi factors for environment, quality, temperature, electrical stress, application and construction, and microcircuit models add die and package terms. The part models include catastrophic and permanent drift failures, while failures from connecting parts into assemblies are counted in the interconnection assembly and connection sections. Fourteen use environments run from ground benign to cannon launch, and no model covers ionizing radiation.",
    failureCounting: "The handbook prints model parameters and tables of calculated values, not failure counts or exposure. The models rest on the best data available when each section was issued, and Notice 2 revised the resistor, capacitor, inductive, rotating, relay, switch, connector, circuit board and connection models from a newer study. Rates are printed in failures per 10^6 hours and stored per hour.",
    quality: "Base rates and factors are point estimates with no uncertainty bounds, and all parts except motors are taken to have a constant failure rate. The handbook warns that a prediction is not the field reliability users will measure. The copy is a scan, so every imported table page was read as an image and checked against its printed equation. The superseded MIL-HDBK-217E pages bundled in the same file are not imported.",
    reference: "U.S. Department of Defense, MIL-HDBK-217F, Reliability Prediction of Electronic Equipment, 2 December 1991, with Notice 1 (10 July 1992) and Notice 2 (28 February 1995), preparing activity Rome Laboratory",
  },
  {
    id: "NSWC-11",
    name: "NSWC-11 Handbook of Reliability Prediction Procedures for Mechanical Equipment (May 2011)",
    provides: "Base failure rates and tabulated correction factors of mechanical part models, plus sensing element and miscellaneous part rates",
    kind: "ENGINEERING_MODEL",
    origin: "NONNUCLEAR",
    estimates: 740,
    dataset: "source-nswc-11.json",
    boundaryConvention: "Each component is modeled as the sum of its parts, such as seals, springs, bearings, housings and fluid drivers, and each part has its own model. A base failure rate covers the part at reference conditions and multiplying factors adjust it to the actual design and operating environment. Part failure is defined by function, for example leakage above an allowable rate for seals and valves or wear-out of friction material.",
    failureCounting: "Base rates are normalized to field data such as the Navy Maintenance and Material Management (3-M) system, published data bases such as NPRD-95 and OREDA, maker life data and laboratory tests. The handbook prints no failure counts or exposure for these rates. Only the valve validation test table gives cycles to failure for single test valves.",
    quality: "Values are point estimates from engineering models that combine physics of failure equations with normalization to field data, without uncertainty bounds. The handbook calls itself a research product with limited validation testing. Factors given only as equations or curves sit in the method of the related base rate row.",
    reference: "Naval Surface Warfare Center Carderock Division, Handbook of Reliability Prediction Procedures for Mechanical Equipment, CARDEROCKDIV NSWC-11, West Bethesda, Maryland, May 2011",
  },
  {
    id: "WSRC-TR-93-262",
    name: "WSRC-TR-93-262 Rev. 1, Savannah River Site generic data base (1998)",
    provides: "Recommended lognormal failure rates for about 500 water, chemical process, compressed gas, HVAC, electrical and instrument component modes, with the category 1, 2 and 3 source data and aggregated results behind them",
    kind: "GENERIC_NUCLEAR",
    origin: "OTHER_NUCLEAR",
    estimates: 1946,
    dataset: "source-wsrc-tr-93-262.json",
    yearsTo: "1998",
    boundaryConvention: "Components and failure modes follow a Savannah River Site list in six system types: water, chemical process, compressed gas, HVAC/exhaust, electrical distribution, and instrumentation and control. Each row has an identifier made of a component code, a failure mode code and a system code (Tables 7 to 9), such as PIP-LE-W for external leakage of water piping. Pipe, hose, tube and duct rates are per hour per foot and the cable rate is per 1000 ft. Leak and rupture values taken from EGG-SSRE-9639 define rupture as a leak of more than 50 gpm.",
    failureCounting: "Category 1 sources give failure counts with reviewed populations and exposures, from nuclear power plant PRAs and Swedish plant data gathered in NUCLARR, plus Savannah River Site reactor data. Category 2 sources give actual failure data with added uncertainty, such as LER and in-plant reliability surveys of nuclear plant components, NPRD-3, OREDA, the Idaho Chemical Processing Plant (WIN-330), a tritium handling facility and an LNG plant. Category 3 sources list only failure rate estimates, from WASH-1400, the CCPS guidelines, IEEE Std 500-1984, a natural gas facility study, two EPRI power plant reports and EGG-SSRE-8875. Counts are failures over component hours or demands, and judgment was used to split failures among failure modes.",
    quality: "Within a category, data sets were pooled by matching the moments of a lognormal distribution, and sparse data used a Bayesian update of a noninformative prior with an error factor of 10. Category 3 estimates were combined by averaging lognormal parameters. The recommended value takes category 1 first, then category 2, then category 3, rounded to 1, 3 or 5 times a power of 10, and Rev. 1 limits error factors to 10. The data years are not printed, so 1998, the Rev. 1 date, bounds them. The report is a scan, so every value was read from the page images.",
    reference: "A. Blanchard and B. N. Roy, Savannah River Site Generic Data Base Development, WSRC-TR-93-262 Rev. 1 (WSMSC-98-0162), Westinghouse Savannah River Company and Westinghouse Safety Management Solutions, May 1998 (original issue 1993)",
  },
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

function valueLaw(expression: UncertainExpression | undefined): Law | undefined {
  return expression?.node === "VALUE" ? expression.value.law : undefined;
}

function countsLaw(source: FrequencyDataSource): Law | undefined {
  const failures = source.eventCount;
  const exposure = source.exposureModuleYears;
  if (source.priorMean !== undefined || failures === undefined || exposure === undefined || !(failures >= 0 && exposure > 0)) return undefined;
  return { family: "POSTERIOR", prior: null, evidence: [{ likelihood: "POISSON", failures, exposure }] };
}

function sourceLaw(source: FrequencyDataSource): Law | undefined {
  return valueLaw(source.estimate) ?? valueLaw(source.faultTreeTop) ?? countsLaw(source);
}

function quantificationLaw(quantification: InitiatingEventFrequencyQuantification): Law | undefined {
  const own = valueLaw(quantification.frequency?.expression);
  if (own !== undefined) return own;
  const primary = (quantification.dataSources ?? []).find((source) => source.uuid === quantification.primaryDataSourceId);
  return primary === undefined ? undefined : sourceLaw(primary);
}

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
  const law = sourceLaw(source);
  if (law !== undefined) entry.law = law;
  return entry;
}

export function daIeQuantificationEntries(analysis: InitiatingEventsAnalysis, bases?: readonly FrequencyQuantificationBasis[]): DaSourceEntry[] {
  const entries: DaSourceEntry[] = [];
  const taken = new Set<string>();
  const wanted = (basis: FrequencyQuantificationBasis): boolean => bases === undefined || bases.includes(basis);
  for (const quantification of analysis.quantifications) {
    const group = analysis.initiatingEventGroups.find((candidate) => candidate.uuid === quantification.initiatorOrGroupId);
    const entry: DaSourceEntry = {
      id: quantification.initiatorOrGroupId,
      component: group?.name ?? quantification.initiatorOrGroupId,
      failureMode: group === undefined ? "Initiator frequency" : "Group frequency",
      quantity: "PER_YEAR",
      table: "Frequency quantification",
      method: `${IE_BASIS_LABELS[quantification.basis]}.`,
    };
    const law = quantificationLaw(quantification);
    if (law !== undefined) entry.law = law;
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
