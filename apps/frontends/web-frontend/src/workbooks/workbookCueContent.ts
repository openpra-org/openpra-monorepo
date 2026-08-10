import { createElement, Fragment, type ReactNode } from "react";

type WorkbookCueCode =
  | "POS" | "IE" | "ES" | "SC" | "SY" | "HR" | "DA" | "ESQ" | "MS" | "RC" | "RI"
  | "SEISMIC" | "FLOOD" | "FIRE";

interface CueRule {
  match: RegExp;
  lead: string;
  example: string;
}

interface WorkbookCueProfile {
  label: string;
  fallbackExample: string;
  rules: CueRule[];
}

const COMMON_RULES: CueRule[] = [
  {
    match: /interfaces?|technical-element handoff|transferred record|transferred values/i,
    lead: "Shows the controlled information this analysis receives or supplies and lets the analyst verify the transferred records.",
    example: "a linked POS-03 record carrying its operating mode, 168-hour duration, and entry frequency",
  },
  {
    match: /capability category/i,
    lead: "Sets the intended analysis rigor so the applicable supporting requirements and evidence expectations are clear.",
    example: "Capability Category II selected for the operational baseline",
  },
  {
    match: /plant stage/i,
    lead: "Identifies the lifecycle stage used to determine which analysis requirements and evidence are presently applicable.",
    example: "Operational selected after fuel loading and completion of the as-built walkdown",
  },
  {
    match: /supporting documents?|controlled evidence|evidence/i,
    lead: "Links the calculations, drawings, procedures, data records, and reviews that substantiate the analysis.",
    example: "CALC-PRA-042 Rev. 3 linked with an approved status and configuration date",
  },
  {
    match: /conformance check/i,
    lead: "Summarizes whether the populated analysis satisfies the applicable supporting requirements before controlled review.",
    example: "42 of 45 applicable requirements met with three evidence gaps still open",
  },
  {
    match: /hand-off to internal review/i,
    lead: "Packages the current analysis baseline for technical review after validation blockers and unresolved preparation items are addressed.",
    example: "Revision 0 submitted with the model snapshot, report, evidence index, and open-item register",
  },
  {
    match: /submit for internal approval/i,
    lead: "Advances the reviewed workbook to the assigned approver after the technical comments have been dispositioned.",
    example: "all 14 review comments resolved before the approval request is released",
  },
  {
    match: /what is being attested/i,
    lead: "Identifies the exact analysis baseline, conformance status, and configuration snapshot covered by the approval signature.",
    example: "Capability Category II, model revision 6, with 45 of 45 applicable requirements satisfied",
  },
  {
    match: /review comments?|add review comment|request revision/i,
    lead: "Records technical-review findings and their disposition against the controlled analysis baseline.",
    example: "a major comment requesting justification for excluding the standby train from the mission model",
  },
  {
    match: /after approval|external workflows/i,
    lead: "Selects the controlled, read-only release path for independent peer review or audit.",
    example: "approved Revision 1 released to the peer-review team with comment-only access",
  },
  {
    match: /remove /i,
    lead: "Removes a superseded or duplicate analysis record while preserving the reason for the controlled change.",
    example: "a duplicate draft record removed after confirming the approved record remains linked",
  },
];

const PROFILES: Record<WorkbookCueCode, WorkbookCueProfile> = {
  POS: {
    label: "Plant Operating States analysis",
    fallbackExample: "POS-03, hot shutdown with forced decay-heat removal available for 168 hours",
    rules: [
      { match: /scope|plant identity|pra application/i, lead: "Defines the plant, application, operating-state boundary, and risk measures covered by the POS analysis.", example: "a four-module sodium fast reactor evaluated for all-power and shutdown configurations" },
      { match: /evolution/i, lead: "Records the operational evolutions that change plant configuration, availability, or risk during normal and shutdown operation.", example: "a planned power-to-hot-shutdown evolution following reactor trip and turbine runback" },
      { match: /representative/i, lead: "Groups similar evolutions into a representative case without masking differences that affect PRA inputs.", example: "two refuelling outages represented by the longer outage with the lower decay-heat-removal availability" },
      { match: /boundary/i, lead: "Defines where one operating state ends and another begins using observable configuration or time-dependent changes.", example: "a boundary at primary sodium temperature below 400 °C when natural-circulation credit begins" },
      { match: /operating state|state details|state definition/i, lead: "Defines a distinct plant configuration whose frequency, duration, equipment availability, and initiating-event applicability are modeled together.", example: "POS-03, hot shutdown with one DRACS train unavailable during maintenance" },
      { match: /transition/i, lead: "Captures modeled movements between operating states when the transition has distinct frequency, duration, equipment demand, or operator actions.", example: "transition from low power to shutdown cooling over a 45-minute alignment window" },
      { match: /duration|frequency/i, lead: "Quantifies how often an operating state occurs and how long the plant remains in it for annualized risk calculations.", example: "2.0 entries per year with a mean duration of 168 hours" },
      { match: /decay heat/i, lead: "Establishes the time-dependent decay-heat condition associated with each operating state and evolution.", example: "3.2% of rated power at one hour after shutdown for POS-02" },
      { match: /radioactive-material|inventory|source location/i, lead: "Records the radioactive-material inventories, locations, and status associated with each operating state.", example: "irradiated reactor fuel in-vessel and spent fuel in the storage pool during POS-06" },
      { match: /equipment|configuration/i, lead: "Records equipment alignments, outages, and support conditions that distinguish the modeled operating state.", example: "DRACS trains A and B available while train C is tagged out for inspection" },
      { match: /uncertainty|assumption|alternative/i, lead: "Captures uncertain quantities and modeling choices that can change POS frequency, duration, configuration, or downstream use.", example: "a sensitivity using a 240-hour outage duration instead of the 168-hour mean" },
      { match: /documentation|technical record/i, lead: "Assembles the POS inputs, methods, results, interfaces, assumptions, and limitations into a reproducible technical record.", example: "a report package linking the outage schedule, state table, transition model, and configuration snapshot" },
    ],
  },
  IE: {
    label: "Initiating Event analysis",
    fallbackExample: "IE-LOFC-01, unplanned loss of forced primary flow quantified at 2.3E-2 per reactor-year",
    rules: [
      { match: /scope|radioactive material/i, lead: "Defines the plant conditions, radioactive-material sources, hazards, and operating states covered by the initiating-event search.", example: "in-core fuel and cover-gas activity evaluated for power operation and shutdown states" },
      { match: /search method/i, lead: "Documents the complementary systematic methods used to identify credible initiating events without relying on a single search technique.", example: "master logic diagram, HAZOP, operating-experience review, and generic-event catalogue" },
      { match: /challenge spectrum/i, lead: "Checks that the initiating-event set spans the challenges that can disrupt safety functions or radionuclide barriers.", example: "loss of heat removal, reactivity insertion, sodium leakage, and loss of electrical support" },
      { match: /initiator details|all initiators|initiator catalogue/i, lead: "Defines each initiating event, its causes, affected barriers, applicable states, and credited detection or protection.", example: "IE-LOFC-01 caused by loss of primary pump power and applicable to POS-01 and POS-02" },
      { match: /applicable operating states/i, lead: "Selects the operating states in which the initiating event can occur and require event-sequence treatment.", example: "loss of forced flow applied to full power and hot standby but excluded during defuelled maintenance" },
      { match: /group|bounding|similarity/i, lead: "Combines initiators with sufficiently similar plant response while retaining a representative or bounding case.", example: "single-pump trips grouped under total loss of primary pumping using the more demanding coastdown" },
      { match: /hazard/i, lead: "Records internal or external hazards considered by the initiating-event analysis and their screening disposition.", example: "site seismic hazard retained while aircraft impact is screened using frequency and consequence criteria" },
      { match: /completeness|coverage/i, lead: "Tests the candidate event set against operating states, challenge categories, equipment failures, hazards, and operating experience.", example: "a category-by-state matrix showing at least one heat-removal challenge in every fueled state" },
      { match: /screening/i, lead: "Applies the approved screening criteria and records whether each candidate is retained, grouped, or screened out.", example: "instrument-air loss retained because it disables multiple isolation and control functions" },
      { match: /annual frequenc|quantification/i, lead: "Assigns an annual occurrence frequency and uncertainty basis to each retained initiator or representative group.", example: "loss of offsite power quantified at 1.1E-2 per reactor-year using plant and industry data" },
    ],
  },
  ES: {
    label: "Event Sequence analysis",
    fallbackExample: "ES-ULOFA-04, reactor trip succeeds, DRACS fails, and the sequence maps to release category RC-2",
    rules: [
      { match: /source|barrier/i, lead: "Identifies the radionuclide sources and transport barriers whose challenges must be represented in event-sequence logic.", example: "in-core fuel bounded by cladding, the primary boundary, and containment" },
      { match: /safety function|what it must do/i, lead: "Defines the reactor-specific safety functions questioned by the event trees and the success conditions supplied by Success Criteria.", example: "remove decay heat using at least two of three DRACS trains for 72 hours" },
      { match: /sequence path|event tree|coverage/i, lead: "Builds the ordered event-tree questions and paths needed to represent credible plant responses to each initiator.", example: "trip, primary-flow coastdown, DRACS alignment, and containment isolation following ULOF" },
      { match: /dependenc/i, lead: "Records functional, equipment, human, and phenomenological dependencies that couple event-tree branches or sequences.", example: "loss of 125 VDC prevents both breaker opening and automatic DRACS damper actuation" },
      { match: /operator-action|window|feasibility|applies to/i, lead: "Defines operator actions, available timing, cues, and affected sequences for later human-reliability quantification.", example: "manually align pony-motor cooling within 20 minutes using low-flow alarm FAL-201" },
      { match: /phenomen|condition|characteristic/i, lead: "Captures physical conditions that change sequence progression, equipment success, or radionuclide release.", example: "sodium boiling onset delayed beyond 35 minutes when natural circulation is established" },
      { match: /end state|outcome/i, lead: "Assigns each completed sequence to a defined plant-damage or release outcome.", example: "stable shutdown with intact barriers assigned to OK; core damage with containment bypass assigned to RC-3" },
      { match: /release-category|mapping basis/i, lead: "Maps sequence outcomes to release categories using the relevant barrier status and release characteristics.", example: "sequences with failed primary boundary and successful containment isolation mapped to RC-2" },
      { match: /sequence famil|representative plant response|classification/i, lead: "Groups sequences with comparable response and consequences while retaining the features needed for quantification and interpretation.", example: "all successful-trip, failed-DRACS sequences grouped into the ULOF heat-removal family" },
      { match: /screening|disposition|justification/i, lead: "Records the technical basis for retaining, grouping, or screening an event sequence.", example: "a sequence retained because its preliminary frequency is 3E-7 per reactor-year and it challenges containment" },
      { match: /point-estimate|returned quantification/i, lead: "Reviews preliminary sequence frequencies and imports quantified results used to confirm model behavior and licensing-basis coverage.", example: "ES-ULOFA-04 returned from ESQ at 6.4E-6 per reactor-year" },
    ],
  },
  SC: {
    label: "Success Criteria analysis",
    fallbackExample: "two of three DRACS trains operating for 72 hours to maintain peak fuel temperature below 900 °C",
    rules: [
      { match: /barrier|protection|challenge load/i, lead: "Defines the radionuclide barriers, credited protection, and challenge loads evaluated by the success-criteria analysis.", example: "primary boundary protected from a 0.42 MPa transient with a 0.65 MPa median capacity" },
      { match: /end state|definition|determining parameter|margin and selection/i, lead: "Defines measurable parameters and thresholds used to distinguish successful, damaged, and release end states.", example: "core damage defined by peak fuel temperature exceeding 1,200 °C" },
      { match: /success criteria table|system success criteria|required capacities/i, lead: "Specifies the minimum system configuration and performance required for each safety function and sequence condition.", example: "two of three DRACS trains providing at least 4.5 MW total heat removal" },
      { match: /shared system|resource|treatment/i, lead: "Identifies shared equipment or resources whose finite capacity affects more than one unit, train, or safety function.", example: "one portable diesel shared between Units 1 and 2 with only one connection crew available" },
      { match: /mission time|sequence and time|component and time|safe stable state/i, lead: "Establishes how long each system or component must perform before the sequence reaches a stable condition.", example: "battery-supported instrumentation required for 24 hours and DRACS operation required for 72 hours" },
      { match: /engineering analys|analysis detail/i, lead: "Links the thermal-hydraulic, structural, or phenomenological calculation that supports a selected success criterion.", example: "TH-CALC-017 showing two DRACS trains keep sodium temperature below 650 °C" },
      { match: /computer code|code|phenomena validation|limitation/i, lead: "Records the analysis code, validation basis, applicability, and limitations supporting the engineering calculation.", example: "SAS4A/SASSYS-1 version 5.3 validated for natural-circulation decay-heat transients" },
      { match: /capacity|uncertainty|evaluation method/i, lead: "Compares calculated demand with capacity and represents the uncertainty that affects the success threshold.", example: "median containment capacity 0.65 MPa with logarithmic standard deviation 0.30" },
      { match: /expert judgment|judgment|process/i, lead: "Documents a structured expert judgment used where test data or validated calculations are insufficient.", example: "a three-member panel estimating a 0.1 probability of sodium-fire propagation through an unsealed penetration" },
      { match: /passive safety|model/i, lead: "Defines the credited performance and failure treatment of passive safety features.", example: "natural-circulation DRACS credited after damper opening with heat-exchanger fouling represented as uncertainty" },
      { match: /consistency|open item/i, lead: "Checks agreement between success criteria, system models, event sequences, and supporting calculations and records unresolved gaps.", example: "an open item where the event tree assumes 48 hours but the thermal-hydraulic calculation supports 36 hours" },
    ],
  },
  SY: {
    label: "Systems analysis",
    fallbackExample: "DRACS succeeds with any two of three trains, including required 125 VDC damper power and service-water support",
    rules: [
      { match: /scope|system boundary|system detail/i, lead: "Defines the modeled system boundary, credited function, operating states, and success criterion represented by the logic model.", example: "DRACS boundary from decay-heat exchanger inlet through air-side dampers and supporting 125 VDC" },
      { match: /function|success criterion/i, lead: "Connects the system model to the safety function and minimum performance required by Success Criteria.", example: "remove at least 4.5 MW using any two DRACS trains for 72 hours" },
      { match: /fault tree|logic|gate/i, lead: "Builds the Boolean combinations of component failures and support losses that cause system failure.", example: "top event DRACS-F fails when fewer than two trains operate or common 125 VDC is lost" },
      { match: /component|basic event|failure mode/i, lead: "Defines modeled component failure modes, probabilities, repair assumptions, and applicability to the system logic.", example: "air damper AD-101 fails to open with probability 2.0E-3 per demand" },
      { match: /support|dependenc/i, lead: "Represents shared electrical, cooling, instrumentation, and environmental dependencies needed for system success.", example: "both trains depend on DC bus DCB-1 for damper actuation" },
      { match: /common cause|ccf/i, lead: "Defines common-cause component groups and parameters for redundant equipment susceptible to a shared failure mechanism.", example: "three identical DRACS dampers modeled as one alpha-factor group with alpha2 of 0.08" },
      { match: /unavailability|maintenance|test/i, lead: "Quantifies planned and unplanned equipment unavailability consistent with the operating-state configuration.", example: "train C unavailable for maintenance during 120 hours per reactor-year" },
      { match: /uncertainty|sensitivity/i, lead: "Identifies uncertain failure data or modeling choices that materially affect system unavailability.", example: "a sensitivity doubling the common-cause beta factor from 0.05 to 0.10" },
    ],
  },
  HR: {
    label: "Human Reliability analysis",
    fallbackExample: "HRA-DRACS-02, operators manually align pony-motor cooling within 20 minutes with a mean HEP of 3.0E-2",
    rules: [
      { match: /scope|crew|plant condition/i, lead: "Defines the operating context, crew model, procedures, and plant conditions covered by the human-reliability analysis.", example: "a two-person control-room crew responding to ULOF during full-power operation" },
      { match: /human action|task|action detail/i, lead: "Defines the operator action, success criteria, affected sequences, and failure consequence represented in the PRA.", example: "manually open DRACS damper AD-101 before sodium temperature reaches 650 °C" },
      { match: /time|window/i, lead: "Establishes detection, diagnosis, travel, execution, and margin times available for the credited action.", example: "20 minutes available, including 5 minutes for diagnosis and 4 minutes for local execution" },
      { match: /cue|procedure|training/i, lead: "Records the alarms, indications, procedures, and training that support correct diagnosis and execution.", example: "low-flow alarm FAL-201 directing operators to abnormal procedure AOP-14, Step 6" },
      { match: /feasib|screening/i, lead: "Checks whether the action is physically and cognitively feasible under the modeled accident conditions.", example: "local valve access retained below 45 °C with emergency lighting available" },
      { match: /dependenc/i, lead: "Represents shared cues, crews, procedures, timing, and cognitive failures between human actions.", example: "failure to diagnose loss of flow treated as highly dependent with the later failure to start pony motors" },
      { match: /hep|quantif|probability/i, lead: "Calculates the human error probability using the selected method, performance-shaping factors, and dependency treatment.", example: "mean HEP 3.0E-2 with a 5th-to-95th percentile range of 8E-3 to 1.1E-1" },
      { match: /uncertainty|sensitivity/i, lead: "Captures uncertainty in timing, diagnosis, execution, and dependency assumptions affecting the human error probability.", example: "a sensitivity reducing the available action time from 20 minutes to 12 minutes" },
    ],
  },
  DA: {
    label: "Data Analysis",
    fallbackExample: "motor-operated valve failure-to-open estimated from 3 failures in 4,200 demands using a Bayesian update",
    rules: [
      { match: /scope|parameter/i, lead: "Defines the PRA parameters, populations, operating experience, and uncertainty outputs covered by the data analysis.", example: "failure-to-start probabilities for safety-grade sodium pumps and emergency diesel generators" },
      { match: /data source|dataset|operating experience|evidence/i, lead: "Registers plant, fleet, test, and generic data used to estimate PRA parameters.", example: "3 valve failures in 4,200 surveillance demands from 2016–2025 plant records" },
      { match: /classification|event|failure/i, lead: "Classifies observed events consistently with the modeled component boundary and failure mode.", example: "a breaker failing to close on demand classified as fail-to-start rather than unavailable due to maintenance" },
      { match: /exposure|demand|hours/i, lead: "Calculates the demand counts, operating hours, standby time, or reactor-years associated with observed failures.", example: "18,600 pump operating hours with two run failures" },
      { match: /statistical|bayes|posterior|distribution/i, lead: "Applies the selected statistical model to combine evidence and produce a mean parameter with uncertainty.", example: "a beta prior updated with 3 failures in 4,200 demands to obtain a posterior mean of 9.0E-4" },
      { match: /common cause|ccf/i, lead: "Estimates common-cause parameters for redundant components using consistently screened multi-component events.", example: "one dependent two-pump failure producing an alpha2 estimate for the primary-pump group" },
      { match: /trend|homogene|pool/i, lead: "Tests whether data can be pooled across time, plants, component groups, or operating conditions.", example: "a change-point check separating pre- and post-modification valve performance" },
      { match: /quality|uncertainty|sensitivity/i, lead: "Evaluates data completeness, applicability, and modeling uncertainty that may affect the parameter estimate.", example: "a sensitivity excluding two ambiguous maintenance-related failures from the posterior" },
    ],
  },
  ESQ: {
    label: "Event Sequence Quantification",
    fallbackExample: "ES-ULOFA-04 quantified at 6.4E-6 per reactor-year after Boolean reduction and a 1E-12 truncation cutoff",
    rules: [
      { match: /scope|model assembly|input/i, lead: "Defines the event-sequence models, system logic, human actions, initiating frequencies, and assumptions included in quantification.", example: "ULOFA event tree linked to DRACS fault trees, two HEPs, and a 2.3E-2 per-year initiator" },
      { match: /boolean|logic|substitution/i, lead: "Assembles and reduces the Boolean logic used to calculate each event-sequence frequency.", example: "substituting the DRACS top event and simplifying repeated loss-of-DC basic events" },
      { match: /house event|flag/i, lead: "Sets sequence- or state-specific logic conditions that activate or disable modeled events.", example: "house event POS03-MAINT set true to force DRACS train C unavailable" },
      { match: /dependenc|common cause/i, lead: "Confirms dependent failures, common-cause groups, and shared support events are represented once and consistently.", example: "one DCB-1 loss event shared by both DRACS train fault trees" },
      { match: /truncation|cutset|minimal cut/i, lead: "Generates minimal cut sets using a documented truncation level that preserves the risk-significant result.", example: "cut sets retained above 1E-12 per reactor-year with a quantified truncation loss below 0.5%" },
      { match: /quantif|frequency|probability/i, lead: "Calculates sequence and release-category frequencies from the assembled logic and parameter values.", example: "ES-ULOFA-04 calculated at 6.4E-6 per reactor-year" },
      { match: /importance|contributor/i, lead: "Calculates importance measures and identifies the events that dominate the quantified result.", example: "DRACS damper common cause with Fussell–Vesely importance of 0.31" },
      { match: /uncertainty|sensitivity/i, lead: "Propagates parameter uncertainty and tests influential modeling assumptions or alternatives.", example: "a Monte Carlo 95th percentile of 1.8E-5 per reactor-year and a no-recovery sensitivity" },
      { match: /result|return|output/i, lead: "Packages quantified sequence, end-state, and release-category results for Event Sequences and Risk Integration.", example: "RC-2 total frequency of 8.1E-6 per reactor-year with its top ten cut sets" },
    ],
  },
  MS: {
    label: "Mechanistic Source Term analysis",
    fallbackExample: "MST-ULOFA-02 releasing 1.8E15 Bq of Cs-137 to containment beginning 2.4 hours after initiation",
    rules: [
      { match: /scope|scenario|sequence/i, lead: "Defines the accident sequences, radionuclide inventories, barriers, and release phases covered by the mechanistic source-term analysis.", example: "ULOFA with failed primary boundary and successful containment isolation" },
      { match: /inventory|radionuclide|source/i, lead: "Establishes the radionuclide inventory and physical form available for release from each source region.", example: "3.2E17 Bq of Cs-137 in damaged fuel with 65% retained in the primary sodium" },
      { match: /release|timing|phase/i, lead: "Quantifies release fractions, rates, durations, and onset times for each modeled release phase.", example: "containment release beginning at 2.4 hours and lasting 6 hours" },
      { match: /transport|retention|aerosol|chemistry/i, lead: "Models radionuclide transport, deposition, chemical form, and retention through plant barriers.", example: "90% cesium retention in sodium and 70% aerosol deposition inside containment" },
      { match: /phenomen|model|code/i, lead: "Selects and documents the mechanistic models and calculations used for relevant accident phenomena.", example: "MELCOR aerosol agglomeration with sodium-pool scrubbing represented by a decontamination factor of 25" },
      { match: /uncertainty|sensitivity/i, lead: "Represents uncertainty in inventory, release, transport, retention, and timing parameters.", example: "a sensitivity reducing sodium-pool retention from 96% to 85%" },
    ],
  },
  RC: {
    label: "Radiological Consequence analysis",
    fallbackExample: "a 95th-percentile two-hour boundary dose of 0.42 Sv for release category RC-2",
    rules: [
      { match: /scope|endpoint|receptor/i, lead: "Defines the release categories, receptors, exposure periods, and consequence measures calculated by the analysis.", example: "two-hour exclusion-area-boundary dose and 30-day population dose for RC-2" },
      { match: /source term|release input/i, lead: "Imports the radionuclide release magnitude, timing, duration, and chemical form used in consequence calculations.", example: "1.8E15 Bq of Cs-137 released to the environment over six hours" },
      { match: /site|weather|meteorolog/i, lead: "Defines site geometry and meteorological data used to represent atmospheric transport conditions.", example: "five years of hourly wind, stability class, precipitation, and mixing-height observations" },
      { match: /dispersion|transport/i, lead: "Calculates atmospheric dispersion and deposition from each release point to the selected receptors.", example: "95th-percentile χ/Q of 2.1E-4 s/m³ at the exclusion-area boundary" },
      { match: /pathway|dose/i, lead: "Calculates inhalation, cloudshine, groundshine, and ingestion contributions for the selected dose endpoint.", example: "0.31 Sv inhalation plus 0.11 Sv cloudshine for the limiting two-hour interval" },
      { match: /health|consequence|population/i, lead: "Calculates individual or population consequences associated with each release category.", example: "a mean conditional early-fatality probability of 2.0E-5 within 10 miles" },
      { match: /emergency|protective action/i, lead: "Represents evacuation, sheltering, relocation, or other protective actions credited by the consequence model.", example: "evacuation starting 45 minutes after warning at an effective speed of 3 mph" },
      { match: /uncertainty|sensitivity/i, lead: "Propagates uncertainty and tests influential source-term, weather, transport, and protective-action assumptions.", example: "a sensitivity delaying evacuation initiation from 45 to 90 minutes" },
    ],
  },
  RI: {
    label: "Risk Integration",
    fallbackExample: "total release-category frequency of 1.7E-5 per reactor-year with ULOF/DRACS failure contributing 38%",
    rules: [
      { match: /scope|risk metric|endpoint/i, lead: "Defines the integrated risk measures, plant configurations, hazards, units, and reporting endpoints included in the assessment.", example: "total core-damage frequency and RC-2-or-greater frequency for all operating states" },
      { match: /aggregate|total|result/i, lead: "Combines quantified contributions across initiators, sequences, operating states, hazards, and units without double counting.", example: "an all-hazards RC-2-or-greater frequency of 1.7E-5 per reactor-year" },
      { match: /contributor|importance/i, lead: "Identifies the sequences, systems, components, human actions, and assumptions driving the integrated risk result.", example: "ULOF with DRACS common-cause failure contributing 38% of total risk" },
      { match: /uncertainty|distribution/i, lead: "Combines propagated uncertainties and reports the mean and selected percentile results for each risk metric.", example: "mean frequency 1.7E-5 with 5th and 95th percentiles of 5.2E-6 and 4.9E-5" },
      { match: /sensitivity|alternative/i, lead: "Evaluates how important modeling choices or uncertain assumptions change the integrated risk conclusions.", example: "removing operator recovery increases total risk by 22%" },
      { match: /multi-unit|module/i, lead: "Combines unit or module contributions while representing shared initiators, resources, and dependencies.", example: "a site loss of offsite power affecting all four modules with one shared emergency generator" },
      { match: /insight|application|decision/i, lead: "Translates integrated results into traceable risk insights for the stated PRA application.", example: "prioritizing the shared DC-bus modification because it reduces RC-2 frequency by 14%" },
    ],
  },
  SEISMIC: {
    label: "Seismic PRA",
    fallbackExample: "a 1E-4 annual-frequency ground motion producing a 0.65 g PGA demand at the reactor-building control point",
    rules: [
      { match: /scope|pra application|reference plant|boundary|imported pos/i, lead: "Defines the plant, operating states, seismic risk measures, and physical boundary covered by the Seismic PRA.", example: "all fueled POSs for the reactor building, balance-of-plant structures, and shared electrical yard" },
      { match: /site|catalog|study region/i, lead: "Establishes the site, regional earthquake catalogue, and geotechnical information used by the seismic-hazard model.", example: "events within 300 km since 1900 with moment magnitude 3.0 or greater" },
      { match: /source model|geometry|magnitude|recurrence|logic tree/i, lead: "Defines seismic sources and alternative recurrence models used to calculate the site hazard.", example: "a 60 km fault source with Mmax 7.1 and three weighted recurrence branches" },
      { match: /ground-motion|motion basis|spectrum|hazard curve/i, lead: "Defines or calculates the ground-motion measures and hazard results required by response and fragility analyses.", example: "mean 5%-damped PGA hazard curve from 1E-2 to 1E-7 annual exceedance" },
      { match: /soil|profile|layer|site response|amplification/i, lead: "Models how local soil and rock conditions modify motion between the reference horizon and plant control points.", example: "a 12 m soil layer with median shear-wave velocity of 420 m/s" },
      { match: /structure|response|modal|ssi|sampling|convergence/i, lead: "Calculates seismic demand on structures and equipment using the selected structural and soil–structure-interaction models.", example: "median 10 Hz floor spectral acceleration of 1.15 g at elevation 132 ft" },
      { match: /screening|rugged|walkdown|investigation/i, lead: "Screens SSCs and records plant-specific walkdown evidence for items requiring retained seismic evaluation.", example: "a standard motor screened at 1.2 g while an unanchored cabinet is retained" },
      { match: /capacity|fragility|hclpf|failure mechanism|vulnerability/i, lead: "Quantifies SSC seismic capacity and uncertainty for the governing failure mode.", example: "median anchorage capacity of 1.8 g with βR 0.25 and βU 0.35" },
      { match: /system|scenario|sequence|quantif/i, lead: "Integrates seismic failures, correlations, human actions, and event-sequence logic to quantify seismic risk.", example: "loss of both offsite power and emergency switchgear producing a 3.2E-6 per-year sequence" },
      { match: /uncertainty|sensitivity|alternative/i, lead: "Propagates seismic hazard, response, capacity, and modeling uncertainties and evaluates influential alternatives.", example: "a sensitivity using the upper-bound soil damping model increases mean seismic risk by 18%" },
    ],
  },
  FLOOD: {
    label: "Internal Flood PRA",
    fallbackExample: "a 100 mm service-water line rupture releasing 38 kg/s into Auxiliary Building Room A-101",
    rules: [
      { match: /scope|pra application|reference plant|boundary|baseline/i, lead: "Defines the plant, operating states, risk measures, and physical boundary covered by the Internal Flood PRA.", example: "all fueled POSs and rooms containing credited safety equipment below elevation 125 ft" },
      { match: /internal-flood definition/i, lead: "Defines the common source parameters and physical flood-area references used to characterize releases, accumulation, propagation, and exposed SSCs.", example: "a 100 mm service-water line rupture in Auxiliary Building Room A-101 at elevation 100 ft" },
      { match: /source|release/i, lead: "Identifies internal flood sources and records the fluid, inventory, pressure, flow, isolation, and location needed for release analysis.", example: "a 100 mm service-water line rupture at 1.1 MPa releasing 38 kg/s" },
      { match: /area|partition|location/i, lead: "Defines hydraulically distinct plant areas used to organize sources, propagation paths, exposed SSCs, and scenarios.", example: "Auxiliary Building, elevation 100 ft, Rooms A-101 and A-102" },
      { match: /propagation|drain|door|penetration/i, lead: "Models how released fluid accumulates and moves through openings, drains, barriers, and elevation changes.", example: "flow through Door D-14 begins at 0.18 m depth and reaches the cable-spreading room in 11 minutes" },
      { match: /ssc|target|exposure/i, lead: "Identifies equipment and cables exposed to submergence, spray, jet impact, or environmental conditions in each flood area.", example: "480 V switchgear SWGR-1 fails when water depth reaches 75 mm" },
      { match: /scenario|screening/i, lead: "Defines retained flood scenarios by combining a source, propagation path, exposed targets, mitigation, and resulting plant response.", example: "service-water rupture in A-101 disables both residual-heat-removal pump trains" },
      { match: /frequency|initiating/i, lead: "Quantifies the occurrence frequency of each retained flood source or scenario using applicable plant and industry evidence.", example: "room-level rupture frequency of 2.6E-4 per reactor-year" },
      { match: /human|operator/i, lead: "Defines flood-related operator actions, cues, timing, access, and environmental constraints for HRA treatment.", example: "isolate header SW-12 within 12 minutes using control-room indication and local valve HV-221" },
      { match: /quantif|risk result/i, lead: "Integrates flood initiators, equipment failures, human actions, and sequence logic to calculate flood risk.", example: "A-101 service-water scenario frequency of 4.2E-6 per reactor-year" },
      { match: /uncertainty|sensitivity/i, lead: "Represents uncertainty in release rate, propagation, equipment fragility, isolation, and scenario modeling.", example: "a sensitivity assuming floor drains are unavailable increases the scenario frequency by 30%" },
    ],
  },
  FIRE: {
    label: "Internal Fire PRA",
    fallbackExample: "an electrical-cabinet fire in PAU RB-2A damaging Train A power and control cables",
    rules: [
      { match: /scope|pra application|reference plant|analysis boundary/i, lead: "Defines the plant, operating states, risk measures, and physical boundary covered by the Internal Fire PRA.", example: "all fueled POSs and fire areas containing credited safety equipment or cables" },
      { match: /physical analysis unit|pau|partition|barrier/i, lead: "Defines nonoverlapping plant volumes used to organize fire sources, targets, barriers, scenarios, and risk results.", example: "PAU RB-2A, Reactor Building elevation 118 ft, bounded by three-hour-rated walls" },
      { match: /ignition|fire source/i, lead: "Identifies fixed and transient ignition sources with the location, fuel, heat-release profile, and fire characteristics needed for scenario development.", example: "a 440 V switchgear cabinet with a peak heat-release rate of 702 kW" },
      { match: /cable|circuit|hot short/i, lead: "Maps fire-damaged cables and circuit failure modes to equipment functions and event-sequence logic.", example: "cable CBL-AD101-OPEN hot-shorts and spuriously closes DRACS damper AD-101" },
      { match: /detection|suppression|brigade/i, lead: "Models credited fire detection and suppression features, response timing, availability, and effectiveness.", example: "smoke detection at 3 minutes followed by brigade suppression at 18 minutes" },
      { match: /scenario|screening|target/i, lead: "Defines retained fire scenarios by combining an ignition source, growth, targets, damage, suppression, and plant response.", example: "cabinet SWGR-A fire damages Train A power and adjacent Train B control cables" },
      { match: /frequency/i, lead: "Quantifies ignition-source and scenario frequencies using source counts, operating experience, and plant-specific factors.", example: "electrical-cabinet ignition frequency of 3.1E-4 per cabinet-year" },
      { match: /human|operator/i, lead: "Defines fire-related operator actions, cues, timing, access, smoke, heat, and alternate-control constraints.", example: "operators transfer decay-heat removal to the remote shutdown panel within 25 minutes" },
      { match: /quantif|risk result/i, lead: "Integrates fire initiators, cable and equipment damage, human actions, suppression, and sequence logic to calculate fire risk.", example: "PAU RB-2A cabinet-fire sequence frequency of 5.7E-6 per reactor-year" },
      { match: /uncertainty|sensitivity/i, lead: "Represents uncertainty in ignition frequency, fire growth, damage thresholds, suppression, circuit response, and HRA.", example: "a sensitivity increasing peak heat-release rate from 702 to 1,000 kW" },
    ],
  },
};

function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, " ").replace(/\s+[·•]\s+\d+$/, "").trim();
}

function firstUsefulSentences(value: string): string {
  const sentences = value.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  const useful = sentences.filter((sentence) => !/^(remember|this becomes|these become|the result|the output|downstream|later\b)/i.test(sentence));
  const selected = useful.length > 1 && /^(record|select|define|use|enter|review|compare|identify|evaluate|choose|confirm|link|capture|establish|calculate|document|assign|map|quantify|build|set|inspect|complete|apply|import|group|test|check)\b/i.test(useful[1])
    ? useful.slice(0, 2)
    : useful.slice(0, 1);
  if (selected.join(" ").length > 300) return selected[0] ?? value.trim();
  return selected.join(" ") || value.trim();
}

function findRule(workbook: WorkbookCueCode, title: string): CueRule | undefined {
  const normalized = normalizeTitle(title);
  return [...COMMON_RULES, ...PROFILES[workbook].rules].find((rule) => rule.match.test(normalized));
}

function generatedLead(workbook: WorkbookCueCode, title: string): string {
  const normalized = normalizeTitle(title).replace(/[.:]+$/, "");
  return `Defines the ${normalized.toLowerCase()} used in the ${PROFILES[workbook].label} and records the applicable technical basis or result.`;
}

function composeWorkbookCue(workbook: WorkbookCueCode, title: string, description?: ReactNode): ReactNode {
  const rule = findRule(workbook, title);
  const candidate = typeof description === "string" ? firstUsefulSentences(description) : undefined;
  const supplied = candidate !== undefined && !/\b(later|downstream|subsequent|next step|will use|becomes? the)\b/i.test(candidate)
    ? candidate
    : undefined;
  const lead = supplied !== undefined && supplied.length > 0 ? supplied : rule?.lead ?? generatedLead(workbook, title);
  if (/\b(for example|e\.g\.)\b/i.test(lead)) return lead;
  const example = rule?.example ?? PROFILES[workbook].fallbackExample;
  if (description !== undefined && typeof description !== "string") {
    return createElement(Fragment, null, description, ` For example, ${example}.`);
  }
  return `${lead.replace(/\s+$/, "")} For example, ${example}.`;
}

export { composeWorkbookCue, type WorkbookCueCode };
