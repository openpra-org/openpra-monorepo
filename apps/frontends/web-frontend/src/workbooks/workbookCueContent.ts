import { createElement, Fragment, type ReactNode } from "react";

type WorkbookCueCode =
  | "POS" | "IE" | "ES" | "SC" | "SY" | "HR" | "DA" | "ESQ" | "MS" | "RC" | "RI"
  | "SEISMIC" | "FLOOD" | "FIRE" | "HSA" | "WIND" | "XF" | "O";

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
  HSA: {
    label: "Hazards Screening Analysis",
    fallbackExample: "aircraft crash screened at 6.4E-9 per plant-year after conservative impact, SSC-failure, sequence, and consequence treatment",
    rules: [
      { match: /scope|pra application|plant and site boundary/i, lead: "Defines the plant, site, operating states, radioactive-material sources, risk measures, and hazard-analysis boundary covered by HSA.", example: "six representative POS groups, reactor and spent-fuel sources, and a 16 km industrial and transportation review area" },
      { match: /hazard-screening definition/i, lead: "Establishes the common site references and unscreened hazard basis used consistently by every later HSA decision.", example: "the current rail corridor, nearby chemical facilities, site drainage divide, and the full natural, human-induced, internal, and secondary hazard set" },
      { match: /site and surroundings reference/i, lead: "Defines the physical, environmental, industrial, transportation, and plant-layout features used to test whether a hazard source and pathway can affect the plant.", example: "a Class I railroad 3.1 km southwest of the protected area carrying flammable and toxic commodities" },
      { match: /evidence|site character|regional stud|design basis|change monitoring/i, lead: "Controls the plant, site, regional, design, licensing, and operating information used to identify and screen hazards.", example: "NOAA Atlas 14 precipitation, FEMA flood mapping, the site survey, and current county hazardous-material permits" },
      { match: /hazard inventory|candidate hazard|routing/i, lead: "Records every applicable natural, human-induced, internal, secondary, and combined hazard and routes it to the responsible analysis.", example: "tornado retained for High Winds PRA while tsunami is screened as physically impossible at the inland site" },
      { match: /secondary|combined|interaction/i, lead: "Evaluates consequential, correlated, common-cause, and coincident hazards before individual screening decisions are finalized.", example: "tornado wind, missiles, intense precipitation, lightning, and loss of offsite power treated as one correlated storm set" },
      { match: /criterion|criteria/i, lead: "Defines the approved qualitative and quantitative screening rules, their applicability limits, required conservatism, and prohibited uses.", example: "SCR-1 requires mean event-sequence-family frequency below 1E-7 per plant-year after conservative plant-response treatment" },
      { match: /qualitative screening/i, lead: "Applies site facts, design margin, physical-impossibility, distance, bounding-event, or SCR-3 criteria to each hazard.", example: "volcanic ash screened because no credible source and transport pathway exists within the conservative influence region" },
      { match: /frequency|hazard character|data assessment/i, lead: "Develops conservative occurrence or exceedance frequency, associated loading, exposure, alternative estimates, and uncertainty for retained hazards.", example: "aircraft-impact frequency derived from current flight operations, crash rate, effective target area, and a fivefold upper uncertainty bound" },
      { match: /plant response|vulnerable ssc|human action|peer review/i, lead: "Connects each retained hazard to vulnerable SSCs, failure modes, initiating events, event sequences, human actions, and relevant peer-review findings.", example: "extreme heat challenges the passive heat sink and increases the local recovery HEP from 0.03 to 0.17" },
      { match: /quantitative screening|consequence|final disposition/i, lead: "Combines hazard frequency, SSC failure, sequence response, HRA, and consequence to determine whether the hazard screens or remains in detailed PRA scope.", example: "pipeline rupture retained because the conservative jet-fire sequence exceeds the SCR-1 frequency threshold" },
      { match: /confirmation|investigation|walkdown|surroundings/i, lead: "Confirms that the hazard sources, pathways, protection features, and plant response used by HSA match the actual or intended plant and surroundings.", example: "a site reconnaissance verifies pipeline markers, rail distance, drainage divides, and the current industrial inventory" },
      { match: /uncertainty|assumption|limitation/i, lead: "Records uncertainty, reasonable alternatives, sensitivities, interim conservative treatment, and closure actions that can change a hazard disposition.", example: "final drainage grades remain open, so the external-flood screen uses the higher design ponding elevation until the as-built survey closes the item" },
      { match: /handoff|results integration/i, lead: "Transfers retained hazards, scenarios, risk results, boundaries, and overlap controls to the responsible PRA technical elements.", example: "seismic ground motion and earthquake-induced flood are transferred to Seismic PRA with one controlling origin tag" },
      { match: /traceability|controlled baseline/i, lead: "Links evidence, site facts, hazards, criteria, models, dispositions, and accepted handoffs in the controlled HSA baseline.", example: "NOAA storm data to tornado candidate to combined-storm record to High Winds PRA acceptance" },
    ],
  },
  WIND: {
    label: "High Winds PRA",
    fallbackExample: "a tornado interval centered at 165 mph evaluated for pressure, missile, atmospheric-pressure-change, and wind-driven-rain failures",
    rules: [
      { match: /scope|pra application|site basis|analysis basis/i, lead: "Defines the site, plant conditions, retained wind hazards, effects, risk measures, and applications covered by the High Winds PRA.", example: "straight wind, tropical cyclone, and tornado evaluated for every fueled POS at the reference site" },
      { match: /interface|handoff/i, lead: "Controls the analysis inputs received from other technical elements and the High Winds results supplied to downstream PRA models.", example: "HSA supplies the retained tornado hazard while High Winds PRA supplies interval results to ESQ" },
      { match: /screening|hazard candidate|combination/i, lead: "Identifies straight-wind, tropical-cyclone, tornado, and coexistent effects and records which require quantitative treatment.", example: "tornado retained with coincident intense precipitation and loss of offsite power" },
      { match: /wind data|reference wind|station|qualification/i, lead: "Qualifies meteorological records and converts them to one controlled wind-speed definition for hazard and fragility calculations.", example: "3-second gust at 10 m in Exposure C after height, terrain, and instrument-history adjustments" },
      { match: /straight.wind|extreme.value|pooling/i, lead: "Develops site straight-wind exceedance frequencies from representative records and justified extreme-value models.", example: "a regional GEV fit produces a 120 mph mean annual exceedance frequency of 2.1E-4" },
      { match: /tropical|cyclone|track|wind field/i, lead: "Models tropical-cyclone occurrence, tracks, intensity, wind fields, inland decay, and the resulting site hazard.", example: "50 million simulated storm-years establish the 145 mph coastal-site exceedance frequency" },
      { match: /tornado|climatology|damage wind|target definition/i, lead: "Models tornado occurrence, reporting bias, path geometry, damage-to-wind relationships, wind fields, and target exposure.", example: "an EF3-class path crossing the power-block target with rotational and translational velocity combined" },
      { match: /hazard curve|hazard interval|logic tree|discret|convergence/i, lead: "Combines hazard-model alternatives into controlled curves and intervals and verifies binning and upper-tail convergence.", example: "130–150 mph assigned 3.4E-5 per year with a 140 mph representative speed" },
      { match: /equipment list|hwel|failure mode|preliminary plant response/i, lead: "Identifies wind-relevant initiators, SSCs, supports, functions, and failure modes that must receive fragility and plant-response treatment.", example: "diesel-generator intake louver retained for pressure, missile, and rain-induced functional failure" },
      { match: /investigation|missile survey|survey zone|missile source|population profile/i, lead: "Confirms plant configuration and inventories credible normal-operation and outage missile sources around vulnerable SSCs.", example: "roof pavers, parked trailers, and outage laydown steel catalogued within 300 m of the auxiliary building" },
      { match: /fragility method|correlation|aggregation|ssc screening/i, lead: "Selects the SSC fragility method, screening disposition, correlation treatment, and aggregation basis for each retained failure mode.", example: "similar roof panels assigned partial capacity correlation before building-envelope fragilities are aggregated" },
      { match: /pressure|apc|envelope|topography|shielding/i, lead: "Calculates wind-pressure and atmospheric-pressure-change demand and converts the governing capacities into SSC fragility curves.", example: "progressive cladding loss changes internal pressure and governs the switchgear-building median capacity" },
      { match: /missile fragility|trajectory|impact|damage model|missile categor/i, lead: "Models missile release, flight, target hit, structural damage, multiple-missile effects, and simulation convergence.", example: "a 15 kg timber missile perforates a metal enclosure and fails the outdoor transformer" },
      { match: /rain|entry path|structural interaction/i, lead: "Evaluates adjacent-structure interactions and wind-driven-rain entry paths that can disable credited SSCs.", example: "failed roof vent admits rain that wets both trains of 480 V switchgear in 22 minutes" },
      { match: /plant response|initiating event|event sequence|success criter|mission time|multi.unit/i, lead: "Adapts initiating events, event sequences, success criteria, systems, data, mission times, and multi-unit effects to the wind context.", example: "tornado-induced LOOP with both emergency-diesel intakes blocked by debris" },
      { match: /human|hep|hfe|performance context|recovery/i, lead: "Quantifies operator actions with wind warning, duration, debris, access, outdoor exposure, communications, and dependency conditions.", example: "local debris-removal recovery receives no credit while tornado winds make the route inaccessible" },
      { match: /quantif|uncertainty result|risk contributor/i, lead: "Integrates hazard intervals, fragilities, plant response, and HRA to calculate event-sequence-family frequencies and uncertainty.", example: "the 150–175 mph tornado interval contributes 4.8E-7 per plant-year to release family RF-2" },
      { match: /risk insight|refinement|traceability|controlled baseline|risk decision/i, lead: "Interprets dominant contributors, records refinements and decisions, and preserves evidence-to-result traceability in the controlled baseline.", example: "roof-paver missile control adopted after it ranks first in the tornado risk contribution" },
      { match: /peer review|technical closure|readiness/i, lead: "Confirms conformance, documentation, interface closure, independent review coverage, and disposition of technical findings.", example: "WFR-E7 closed after adding a missile-trajectory sample-size convergence study" },
    ],
  },
  O: {
    label: "Other Hazards PRA",
    fallbackExample: "a nearby chlorine rail release evaluated from source frequency through control-room habitability, operator response, and release-category frequency",
    rules: [
      { match: /scope|pra application|site basis|analysis basis/i, lead: "Defines the site, plant conditions, retained hazards, risk measures, and decision boundary covered by the Other Hazards PRA.", example: "toxic gas, aircraft impact, volcanic ash, all fueled POSs, four reactor modules, and spent-fuel storage" },
      { match: /interface|handoff|transferred record|transferred values/i, lead: "Controls the inputs received from other technical elements and the Other Hazards results supplied to downstream PRA models.", example: "HSA supplies a retained toxic-release hazard while Other Hazards supplies sequence-family results to ESQ" },
      { match: /site|regional|evidence|design.basis|operating experience/i, lead: "Controls the site, regional, design, configuration, and operating evidence used to characterize retained hazards and plant response.", example: "current rail commodity flow, airport operations, site drawings, toxic-gas isolation logic, and applicable industry events" },
      { match: /retained hazard|completeness|overlap/i, lead: "Turns HSA dispositions into complete, non-overlapping hazard groups with explicit subhazards, effects, analysis boundaries, and specialized-PRA allocations.", example: "chlorine and anhydrous-ammonia releases grouped as toxic gases while induced fire remains assigned to Fire PRA" },
      { match: /source|effect model|intensity measure|spatial zone|timeline/i, lead: "Connects each hazard source to a compatible intensity measure, plant effect, exposed location, warning time, and duration.", example: "a 90-ton chlorine railcar 3.2 km southwest modeled as control-room inlet concentration in ppm over time" },
      { match: /frequency|occurrence|regional applicability|expert judgment/i, lead: "Develops annual occurrence and severity frequencies from qualified site, regional, historical, simulated, or formally elicited information.", example: "commodity flow, rail accident rate, release fraction, wind direction, and stability class combined into a toxic-plume exceedance model" },
      { match: /secondary|combined|dependency/i, lead: "Identifies consequential and coincident hazards and transfers specialized fire or flood effects without losing causal dependencies or double counting.", example: "an aircraft fuel fire transferred to Fire PRA while impact damage and shared initiating failures remain in the Other Hazards scenario" },
      { match: /hazard curve|hazard interval|logic.tree|convergence/i, lead: "Combines hazard-model alternatives into controlled intensity-frequency curves and quantification intervals and verifies tail and discretization stability.", example: "10–25 ppm chlorine assigned 2.8E-5 per plant-year with 18 ppm as the representative interval concentration" },
      { match: /ssc scope|ssc list|preliminary|functional requirement/i, lead: "Identifies hazard-induced initiators and every SSC, support, operator action, location, and failure mode requiring detailed fragility or response treatment.", example: "control-room air isolation, toxic-gas detectors, emergency filtration, and the outdoor manual-isolation route retained for toxic release" },
      { match: /investigation|configuration confirmation|access route/i, lead: "Confirms source inventories, protection features, exposed SSCs, plant configuration, procedures, and operator routes against actual or intended conditions.", example: "a walkdown verifies detector placement and times the alternate path to the emergency-filter isolation valve" },
      { match: /fragility basis|method selection|correlation|generic.data|screening decision/i, lead: "Selects and justifies the screening, demand, capacity, generic-data, and correlation method for each retained SSC and hazard effect.", example: "control-room isolation failure modeled from detector and damper reliability with common environmental-demand correlation" },
      { match: /fragility|demand model|capacity model|functional.failure/i, lead: "Quantifies physical and functional failure probability on the same intensity basis used by the hazard curve, including personnel and secondary effects.", example: "operator incapacitation probability increasing from 0.01 at 5 ppm chlorine to 0.95 at 100 ppm" },
      { match: /initiating.event|scenario|industry experience/i, lead: "Builds scenario families and timelines that combine source, intensity interval, location, initiating event, SSC damage, secondary effects, and affected plant scope.", example: "night-shift chlorine release with delayed detection, control-room isolation failure, and loss of local recovery access" },
      { match: /plant response|event sequence|success criter|system.model|mission time|level 2|multi.unit/i, lead: "Adapts event sequences, success criteria, systems, data, recovery, mission times, correlations, and Level 2 interfaces to each Other Hazards scenario.", example: "toxic-gas ingress challenges both units through shared air intakes and requires 12 hours of protected control-room habitability" },
      { match: /human|hep|hfe|performance context|recovery/i, lead: "Quantifies preparation, response, and recovery using hazard warning, cues, habitability, access, protective equipment, staffing, timing, and dependency.", example: "manual emergency-filter isolation receives HEP 0.18 because the outdoor route requires supplied-air protection" },
      { match: /quantif|uncertainty result|risk contributor/i, lead: "Integrates hazard intervals, fragilities, plant response, and HRA into sequence-family frequencies, uncertainty, convergence, and contributor rankings.", example: "toxic-release loss-of-habitability contributes 6.2E-7 per plant-year to release category RC-2" },
      { match: /risk interpretation|sensitivity|refinement|risk insight/i, lead: "Tests reasonable alternatives, interprets dominant vulnerabilities and uncertainties, and prioritizes refinements that can change conclusions.", example: "doubling detector response time raises the toxic-release family frequency by 38 percent and triggers a response-time test" },
      { match: /risk integration|risk decision|traceability|controlled baseline|stopping criteria/i, lead: "Transfers results to total risk, controls overlap, records decisions, demonstrates model stability, and preserves evidence-to-decision traceability.", example: "rail data traced through plume, isolation fragility, sequence result, and a detector-surveillance decision in model O-1.0" },
      { match: /peer review|technical closure|readiness|conformance/i, lead: "Confirms OHA, OFR, and OPR conformance, documentation, interface closure, independent review, findings, limitations, and release evidence.", example: "all applicable supporting requirements mapped and the remaining as-built detector-location action controlled before approval" },
    ],
  },
  XF: {
    label: "External Flood PRA",
    fallbackExample: "a 1E-4 per-year local-intense-precipitation event producing 0.48 m of ponding at the electrical-annex north door",
    rules: [
      { match: /scope|pra application|site basis|analysis basis/i, lead: "Defines the site, plant conditions, flood mechanisms, effects, risk measures, and application boundary covered by External Flood PRA.", example: "all fueled POSs, four reactor modules, spent-fuel storage, shared supports, and protected access routes" },
      { match: /interface|handoff/i, lead: "Controls inputs received from other PRA technical elements and the external-flood results supplied to downstream models.", example: "HSA supplies retained LIP and dam hazards while XF supplies interval sequence frequencies to ESQ" },
      { match: /evidence|site flood data|datum|site parameter|qualification/i, lead: "Controls the surveys, hydrometeorological records, drawings, models, elevations, parameters, and checks that establish one consistent site-flood basis.", example: "2025 QL1 LiDAR and a 2026 survey tie the north door sill to NAVD88 within 0.04 m" },
      { match: /screening|candidate|combination/i, lead: "Identifies every credible flood mechanism and shared source and records which are screened or retained for quantitative analysis.", example: "LIP, riverine, dam failure, and groundwater retained while tsunami is screened by physical disconnection" },
      { match: /local precipitation|precipitation.frequency|catchment|surface flow|lip/i, lead: "Develops local rainfall, catchment, drainage, surface-routing, ponding, ingress, and location-specific hazard results.", example: "a 392 mm six-hour storm produces 0.48 m depth at the north electrical-annex door" },
      { match: /river|watershed|discharge|stage|levee/i, lead: "Develops river discharge frequency and converts it into site water level, velocity, duration, debris, access, levee, ice, and sediment effects.", example: "Bulletin 17C discharge of 6,520 m³/s produces 0.12 m water above protected-island grade" },
      { match: /dam|impoundment|breach/i, lead: "Evaluates relevant impoundments, credible failures, breach development, routing, warning, debris, erosion, and site demands.", example: "Lake Sterling seismic breach arrives in 3.7 hours with 1.12 m depth and 2.35 m/s velocity" },
      { match: /surge|seiche|tsunami|coastal/i, lead: "Evaluates coastal and enclosed-water sources, tides, waves, runup, drawdown, arrival, and hydraulic connection to the plant.", example: "far-field tsunami screened because the site remains 122 m above the maximum connected runup" },
      { match: /hazard curve|hazard interval|logic.tree|spatial|convergence/i, lead: "Integrates hazard alternatives into location-specific curves, spatial fields, quantification intervals, uncertainty, and numerical convergence.", example: "the 0.6–0.9 m LIP interval carries 5.5E-5 per year with one correlated site depth field" },
      { match: /equipment list|xfel|preliminary/i, lead: "Identifies flood-induced initiators and the barriers, SSCs, supports, pathways, functions, and failure modes requiring detailed treatment.", example: "shared DC switchgear retained for submergence after door or cable-seal failure" },
      { match: /investigation|walkdown|pathway|protection feature|drainage feature/i, lead: "Confirms actual or intended grades, openings, barriers, seals, drains, routes, exposed SSCs, procedures, and action feasibility.", example: "walkdown verifies a 0.418 m north-door sill and identifies two cable seals awaiting pressure testing" },
      { match: /fragility|failure mode|structural load|seal|correlation/i, lead: "Converts water level, loads, leakage, debris, erosion, aging, and dependency into conditional protection and SSC failure probabilities.", example: "the north door has 2.35 m median head capacity with βR 0.18 and βU 0.24" },
      { match: /scenario|propagation|timeline/i, lead: "Combines sources, paths, protection states, accumulation, drainage, affected SSCs, warning, failure timing, and action windows into plant-response scenarios.", example: "north-annex LIP reaches the cable trench in 2.4 hours if the door leaks and sump pumping is lost" },
      { match: /plant response|initiating event|event sequence|success criter|mission time|multi.unit/i, lead: "Adapts initiators, sequences, success criteria, systems, data, recovery, mission time, and multi-unit logic to external-flood conditions.", example: "dam-break flooding produces correlated LOOP, UHS loss, access loss, and a 168-hour recovery mission" },
      { match: /human|hep|hfe|performance context|recovery/i, lead: "Quantifies flood preparation, response, and recovery using warning, water, debris, access, lighting, staffing, communication, timing, and dependency.", example: "outfall isolation receives HEP 0.06 after an 18-minute timed talk-through with a 78-minute margin" },
      { match: /quantif|uncertainty result|risk contributor/i, lead: "Integrates hazard intervals, fragilities, scenarios, plant response, and HRA into sequence-family frequencies, uncertainty, and contributor rankings.", example: "LIP north-annex ingress contributes 7.8E-7 per plant-year to the mean external-flood result" },
      { match: /risk insight|refinement|sensitivity/i, lead: "Interprets dominant flood mechanisms and dependencies and tests alternatives that can change model conclusions or improvement priorities.", example: "loss of all drainage raises the LIP family frequency by a factor of 2.6" },
      { match: /risk integration|risk decision|traceability|controlled baseline/i, lead: "Transfers results to total risk, controls storm and seismic overlap, records decisions, and preserves evidence-to-decision traceability.", example: "NOAA rainfall is traced through the north-annex scenario to a seal-test decision without double counting High Winds storm risk" },
      { match: /peer review|technical closure|readiness|conformance/i, lead: "Confirms all XFHA, XFFR, and XFPR requirements, interfaces, documentation, independent review, findings, and release evidence are complete.", example: "109 of 109 supporting requirements mapped with two conservative pre-operational actions under control" },
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
