# Non-LWR Reactor PRA Web Application — Technical Specification

### Basis: ASME/ANS RA-S-1.4 (2021) | OpenPRA MEF Schema | RG 1.247

---

## 0. Purpose & Scope

An advanced reactor company needs one tool that:

1. Captures plant design
2. Runs all PRA analyses required by ASME/ANS RA-S-1.4
3. Stores everything in OpenPRA MEF schema
4. Outputs regulatory compliance package for NRC/RG 1.247

This document specifies all frontend, backend, solver, and integration components. It is **library-agnostic** — implementation technology choices are left to the engineering team.

---

## 1. System Architecture — High-Level

```
┌─────────────────────────────────────────────────────────────┐
│                     BROWSER / CLIENT                        │
│  Drawing Canvas | Logic Editors | Dashboards | Report View  │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST / WebSocket / GraphQL
┌──────────────────────────▼──────────────────────────────────┐
│                    API GATEWAY / BFF                        │
│   Auth | Rate Limit | Schema Validation | Session Mgmt      │
└──┬──────────────┬───────────────┬────────────────┬──────────┘
   │              │               │                │
┌──▼──┐     ┌────▼────┐    ┌─────▼─────┐   ┌─────▼──────┐
│ MEF │     │Analysis │    │  Solver   │   │  Report    │
│Store│     │Orchestr.│    │  Engine   │   │  Engine    │
│(DB) │     │Service  │    │  Cluster  │   │  Service   │
└─────┘     └─────────┘    └───────────┘   └────────────┘
   │              │               │
┌──▼──────────────▼───────────────▼──────────────────────────┐
│               OBJECT / FILE STORAGE                        │
│  MEF JSON | Solver Inputs/Outputs | Generated Reports      │
└─────────────────────────────────────────────────────────────┘
```

**Core principle:** Every persistent data object maps 1:1 to an OpenPRA MEF schema type. The MEF store is the single source of truth. All solver inputs/outputs are traceable back to a MEF node.

---

## 2. Data Model — OpenPRA MEF Schema Mapping

Every feature in the app writes to and reads from these MEF namespaces:

| MEF Namespace                 | App Module     | Key Schema Types                                                  |
| ----------------------------- | -------------- | ----------------------------------------------------------------- |
| `PlantDesign`                 | Drawing Module | `SystemDefinition`, `ComponentDefinition`, `SpatialDefinition`    |
| `PlantOperatingStates`        | POS Dashboard  | `PlantOperatingState`, `POSTransitionEvent`                       |
| `InitiatingEvents`            | IE Module      | `InitiatingEvent`, `InitiatingEventGroup`, `FrequencyEstimate`    |
| `EventSequences`              | ES Editor      | `EventSequence`, `EventTree`, `FunctionalEventTree`               |
| `SuccessCriteria`             | SC Module      | `SuccessCriterion`, `ThermalHydraulicBasis`, `NeutronicsBasis`    |
| `Systems`                     | SY Module      | `FaultTree`, `GateDefinition`, `BasicEvent`, `CCFGroup`           |
| `HumanReliability`            | HRA Module     | `HumanFailureEvent`, `PerformanceShapingFactor`, `DependencyLink` |
| `DataAnalysis`                | DA Module      | `ParameterEstimate`, `UncertaintyDistribution`, `PlantRecord`     |
| `EventSequenceQuantification` | ESQ Module     | `SequenceFrequency`, `MinimalCutSet`, `ImportanceMeasure`         |
| `MechanisticSourceTerm`       | MS Module      | `ReleaseCategory`, `SourceTermResult`, `FuelFailureModel`         |
| `RadiologicalConsequence`     | RC Module      | `ConsequenceResult`, `AtmosphericDispersion`, `DosePathway`       |
| `RiskIntegration`             | RI Module      | `RiskMetric`, `UncertaintyResult`, `SensitivityStudy`             |
| `InternalHazards`             | IH Module      | `FireScenario`, `FloodScenario`, `HazardBarrier`                  |
| `ExternalHazards`             | EH Module      | `SeismicHazardCurve`, `FragilityModel`, `WindHazard`              |
| `Documentation`               | Report Module  | `ProcessDocumentation`, `AssumptionLog`, `PeerReviewRecord`       |

---

## 3. Frontend Components

### 3.1 Global Shell

**Purpose:** Persistent navigation, project management, user context.

**Components:**

- Project selector — load/create/branch MEF model instance
- Technical element navigation tree — mirrors RA-S-1.4 structure; shows completeness status per element (Not Started / In Progress / Complete / Peer Reviewed)
- Global search — full-text across all MEF object labels and IDs
- Traceability sidebar — click any object, see all upstream/downstream dependencies
- Notification feed — solver job status, peer review comments, schema validation failures
- Version/config control indicator — current model version hash, branch name

---

### 3.2 Plant Drawing Module

**Purpose:** Capture plant design; auto-generate `SystemDefinition`, `ComponentDefinition`, and spatial data in MEF schema.

**Sub-components:**

**3.2.1 P&ID Canvas**

- Drag-and-drop component palette (pump, valve, heat exchanger, reactor vessel, piping, instrumentation)
- Component types tagged with reactor-type flags (sodium-cooled, molten-salt, gas-cooled, microreactor) for appropriate property sets
- Connection tool — draw piping/electrical/I&C links; each link becomes an `InterfaceDefinition` in MEF
- Room/zone overlay — draw spatial boundaries; assigns components to `SpatialZone` objects
- Environmental tag panel — per-zone: temperature, radiation, flooding susceptibility, fire load
- Auto-export: every component placed writes a `ComponentDefinition`; every zone writes `SpatialDefinition`

**3.2.2 One-Line Electrical Diagram Editor**

- Bus bars, breakers, transformers, DC/AC divisions
- Division independence tagging (Division A/B/C) → populates `DivisionDefinition` in MEF
- Shared power path detector — flags components sharing a single bus → pre-seeds CCF group candidates

**3.2.3 Logic Diagram Editor**

- Control system logic blocks (AND/OR/NOT gates, setpoints, actuation logic)
- I&C architecture — sensor to actuation path drawing
- Auto-identifies safety actuation signals → seeds `InitiatingEvent` candidates

**3.2.4 Drawing Import**

- Accepts: SVG, DXF, PDF (rasterized for tracing)
- Semi-automated symbol recognition — user confirms/corrects before MEF write
- Version diff view — compare imported revision against stored MEF model

---

### 3.3 Plant Operating States (POS) Module

**Purpose:** Define all discrete plant states and transitions; write `PlantOperatingState` objects.

**Sub-components:**

- State matrix builder — rows = operational phases (full power, startup, shutdown, refueling, maintenance), columns = key parameters (power level, coolant temperature, key system availability, decay heat level)
- State vector definition — for each cell, define min/max parameter bounds
- Transition event log — define what moves plant from state to state; becomes `POSTransitionEvent`
- Mission time assignment — per state, assign mission time for success criteria analysis
- POS completeness checker — verifies states are mutually exclusive and collectively exhaustive (MECE validation rule from MEF schema)
- Decay heat curve importer — time-based decay heat values linked to specific POS for non-LWR fuel types

---

### 3.4 Initiating Event (IE) Module

**Purpose:** Identify, group, and quantify all initiating events; populate `InitiatingEvent` and `FrequencyEstimate`.

**Sub-components:**

**3.4.1 Master Logic Diagram (MLD) Builder**

- Top-down graphical tool: top node = "Plant upset initiating event"
- Decompose into: Loss of Heat Removal, Reactivity Insertion, Loss of Coolant, Support System Failure, External
- Each leaf becomes an `InitiatingEvent` object
- MLD exports as SVG; stored in `ProcessDocumentation`

**3.4.2 FMEA Worksheet**

- Tabular interface: Component | Failure Mode | Effect on Plant | Initiates? | Group
- FMEA rows linked to `ComponentDefinition` from drawing module
- Auto-groups similar functional effects into `InitiatingEventGroup`

**3.4.3 HAZOP / What-If Interface**

- Node-by-node review table: System Node | Guide Word | Deviation | Cause | Consequence | Initiator?
- Facilitator mode — supports workshop sessions; records findings in real time

**3.4.4 Frequency Estimation Panel**

- Source selector per IE: Generic database | Plant-specific | Expert elicitation
- Bayesian update widget — input: prior distribution parameters + plant observations → posterior displayed graphically
- Supported distributions: Lognormal, Poisson, Gamma
- Output writes to `FrequencyEstimate` with full provenance tag

---

### 3.5 Success Criteria (SC) Module

**Purpose:** Define minimum conditions for each safety function to succeed; populate `SuccessCriterion`.

**Sub-components:**

**3.5.1 Safety Function Registry**

- List all safety functions: Reactivity Control, Core Heat Removal, Coolant Inventory Control, Confinement/Containment
- Per-function: assign success metric (temperature limit, flow rate, time to action)
- Links to physics basis

**3.5.2 Physics Basis Interface**

- Thermal-hydraulic basis panel: link to T/H analysis run → import minimum flow/coolant conditions
- Neutronics basis panel: link to neutronics analysis → import shutdown margin requirements
- Fuel performance panel: link to fuel model → import temperature/burnup failure thresholds
- Each basis imports into `ThermalHydraulicBasis` or `NeutronicsBasis` MEF object

**3.5.3 T/H Code Job Launcher** _(see Solver section 5.2)_

- Parameter input form → submits job to solver cluster
- Result viewer: time-history plots of key parameters (temperature, flow, pressure)
- Success/failure threshold overlay
- Auto-extracts minimum success conditions → proposes `SuccessCriterion` value

**3.5.4 Sensitivity / Margin Dashboard**

- Show success criterion value vs. parameter uncertainty
- Flag criteria with thin margins (< 10% margin to failure)

---

### 3.6 Event Sequence Analysis (ES) Module

**Purpose:** Build logic structure from initiating event through plant response to end state; populate `EventSequence` and `EventTree`.

**Sub-components:**

**3.6.1 Functional Event Tree (FET) Editor**

- Graphical tree builder: initiating event on left, functional headings across top, branch logic right
- Functional heading = safety function (Reactivity Control, Heat Removal, etc.)
- Branch on: Success (top) / Failure (bottom)
- Each path = an `EventSequence` object; end state assigned (OK / Core Damage / Large Release / etc.)
- Link system fault trees to heading top events (consumed in ESQ module)
- Multi-tree linking: plant damage state tree links to Level 2 release tree

**3.6.2 Dynamic Event Tree (DET) Interface**

- For non-LWR applications where timing/order matters (passive systems, natural circulation, molten salt drain)
- Timeline-based branching: x-axis = time, branch at operator action windows or system state transitions
- Coupled to T/H solver: branches defined by T/H output variables crossing thresholds
- DET sequence list auto-populates `EventSequence` objects with time-tagged conditions

**3.6.3 End-State Binning Tool**

- Rule-based binning: assign sequences to damage states based on combinations of failed functions
- Custom bin rule editor: IF (Function A failed AND Function B failed) THEN bin = "Core Damage State 1"
- Bin inventory maps to `PlantDamageState` or `SourceTermCategory`

---

### 3.7 Systems Analysis (SY) Module

**Purpose:** Model system unavailability; build fault trees; populate `FaultTree`, `BasicEvent`, `CCFGroup`.

**Sub-components:**

**3.7.1 Fault Tree Editor**

- Graphical gate-and-event tree builder
- Gate types: AND, OR, INHIBIT, TRANSFER, VOTING (k-of-n for redundant trains)
- Basic event types: Component failure, Test/maintenance unavailability, CCF event, Human failure event (linked to HRA), Passive system failure
- Transfer gate links to sub-trees; supports modular construction (each system = one sub-tree module)
- Auto-import from P&ID: component list from drawing module populates basic event palette
- INHIBIT gate for conditional enabling (flood valve opens only if flood occurs)

**3.7.2 Common Cause Failure (CCF) Manager**

- CCF group definition: select affected components from drawing module
- Supported models: Beta Factor, Multiple Greek Letter (MGL), Alpha Factor
- Parameter input: defense mechanisms, diversity level, physical separation → adjusts CCF fraction
- CCF events auto-inserted into fault trees as basic events

**3.7.3 Passive System Reliability Tool**

- Special tool for non-LWR passive safety systems (natural circulation loops, passive heat exchangers, passive reactivity control)
- Input: driving head calculation, thermal resistance, flow path geometry
- Method selector: REPAS | RMPS | Reliability analysis by T/H uncertainty
- Output: failure probability curve → writes to `PassiveSystemReliability` MEF object

**3.7.4 Test & Maintenance Unavailability Calculator**

- Input: test interval, test duration, repair time, staggered vs. simultaneous testing
- Calculates: average unavailability due to testing + repair
- Surveillance test matrix: import from plant procedure set; calculate overall system unavailability

**3.7.5 Markov / State-Space Model Builder**

- For standby / repairable systems where FT is insufficient
- State diagram builder: define system states (operating, standby, failed, in-repair)
- Transition rate inputs: failure rate, repair rate, demand rate
- Solver: steady-state and time-dependent probabilities
- Output feeds back to fault tree as a `BasicEvent` probability

**3.7.6 Dependency Checker**

- Cross-reference all systems for: shared power bus, shared cooling, shared I&C, shared structure/room
- Generates dependency matrix
- Flags unmodeled dependencies as findings

---

### 3.8 Human Reliability Analysis (HRA) Module

**Purpose:** Quantify probability of human failure; populate `HumanFailureEvent` and `PerformanceShapingFactor`.

**Sub-components:**

**3.8.1 Task Analysis Workbench**

- Procedure import — parse procedure text, auto-extract action steps
- Cognitive task analysis form — for each action: Cue detection, Diagnosis, Decision, Execution steps
- Timeline builder — map actions to event sequence timeline; flag actions with tight time windows

**3.8.2 HRA Method Selector & Calculator**

- Supported methods: THERP, ASEP, SPAR-H, IDHEAS, ATHEANA
- Per-action: select applicable method
- PSF (Performance Shaping Factor) checklist: Stress/Time pressure, Complexity, Procedures quality, Training, Ergonomics, Fitness/Fatigue
- PSF multipliers applied per chosen method
- Output: nominal HEP × PSF multipliers = task HEP → writes to `HumanFailureEvent`

**3.8.3 Dependency Analysis Panel**

- Define action pairs that may be dependent (same operator, same time pressure, same procedure error)
- Dependency level selector: Complete / High / Moderate / Low / Zero
- Conditional HEP calculator: P(B|A) given dependency level

**3.8.4 Time Reliability Correlation Tool**

- Input: available time for action, median required time
- Method: THERP TRC or IDHEAS time curve
- Output: time-stress HEP contribution

---

### 3.9 Data Analysis (DA) Module

**Purpose:** Derive failure rates, repair rates, CCF parameters; populate `ParameterEstimate` and `UncertaintyDistribution`.

**Sub-components:**

**3.9.1 Component Data Manager**

- Component group registry: link plant components to generic data groups
- Failure mode table: per component, per failure mode (fail to start, fail to run, inadvertent actuation, etc.)
- Plant-specific event log: enter observed failures + operating hours/demands from plant records

**3.9.2 Generic Data Library**

- Pre-loaded: NUREG/CR-6928, IAEA TECDOC, INL generic data sets, EDF/EPRI sources
- Extensible: import custom data source with citation
- Filterable by: component type, technology, environment, failure mode

**3.9.3 Bayesian Update Calculator**

- Inputs: prior distribution (from generic data), plant evidence (failures + exposure)
- Method: conjugate Bayesian (Gamma-Poisson for failure rates; Beta-Binomial for demand probabilities)
- Output: posterior distribution parameters + comparison plot (prior vs. posterior)
- Chi-square / likelihood ratio test for data-generic data compatibility
- Result writes to `ParameterEstimate` with provenance

**3.9.4 Expert Elicitation Recorder**

- Structured elicitation form: parameter, basis, expert ID, distribution type, percentile estimates
- Aggregation: linear pooling or log-opinion pool
- Documents elicitation process for regulatory traceability

**3.9.5 CCF Data Fitter**

- Input: CCF observations by multiplicity
- Fits: MGL model parameters (β, γ, δ), Alpha Factor vector
- Output: CCF parameters for CCF Manager in SY module

---

### 3.10 Event Sequence Quantification (ESQ) Module

**Purpose:** Combine event trees + fault trees into sequence frequencies; run uncertainty; compute importance.

**Sub-components:**

**3.10.1 Model Integration View**

- Visual check: all ET headings linked to FT top events; all FT basic events have parameter assignments
- Completeness indicator: unlinked headings, missing data flagged in red
- Truncation limit configuration: set cutset truncation probability floor

**3.10.2 Quantification Job Launcher** _(see Solver 5.5)_

- Job type selector: Point estimate | Full uncertainty | Importance measures
- Engine selector: internal BDD solver | SAPHIRE adapter | SCRAM adapter | OpenPSA adapter
- Submit button → jobs queued to solver cluster
- Progress indicator with cancel option

**3.10.3 Results Dashboard**

- Sequence frequency table: sorted by frequency; color-coded vs. acceptance criteria
- Cut set viewer: top N cut sets per sequence; expandable to show contributing basic events
- CDF / LERF summary: total risk metric with uncertainty band (5th–95th percentile)
- Acceptance criteria overlay: plot CDF/LERF against RG 1.247 target limits

**3.10.4 Importance Measures Panel**

- Per basic event and per system: Fussell-Vesely (FV), Risk Achievement Worth (RAW), Risk Reduction Worth (RRW), Birnbaum
- Sortable table + bar chart visualization
- Risk significant component list: auto-flag FV > 0.005 or RAW > 2 (configurable thresholds)

**3.10.5 Uncertainty Analysis Panel**

- Uncertainty propagation: Monte Carlo or Latin Hypercube Sampling
- Sample count selector (10K – 1M)
- Tornado chart: top uncertainty contributors
- Sensitivity study runner: vary one parameter at a time across ± N sigma

---

### 3.11 Mechanistic Source Term (MS) Module

**Purpose:** Model fuel failure, fission product transport, release from confinement; populate `SourceTermResult` and `ReleaseCategory`.

**Sub-components:**

**3.11.1 Fuel Inventory Calculator**

- Input: fuel type (TRISO, metallic, oxide, molten salt dissolved), enrichment, burnup, power history
- Code: ORIGEN (interfaced via backend) → radionuclide inventory by isotope
- Output: `RadioisotopeInventory` MEF object

**3.11.2 Fuel Failure Model Configurator**

- Failure mechanism selector: cladding breach, TRISO coating failure, fuel dissolution
- Failure threshold inputs: temperature limit, dose limit, transient conditions
- Probability of failure vs. condition curve input
- Links to success criteria from SC module

**3.11.3 Transport & Retention Model**

- Fission product transport path definition: fuel → primary coolant → cover gas → confinement → environment
- Retention mechanism inputs per path segment: deposition velocity, scrubbing efficiency, plate-out fraction
- Chemistry model: speciation inputs (iodine chemical form, aerosol size distribution)
- Non-LWR specific: sodium fire aerosol model (for SFR), fluoride volatility (for MSR), graphite oxidation (for HTR)

**3.11.4 Severe Accident Code Interface** _(see Solver 5.6)_

- MELCOR / SAM job launcher: parameter form → submit to HPC cluster
- Results importer: parse code output → extract release fractions by nuclide group and timing
- Release binning tool: group sequences into release categories based on release magnitude and timing

**3.11.5 Confinement Leakage Model**

- Barrier definition: fuel, primary boundary, guard vessel, confinement building
- Leakage path: normal leakage rate, failure-induced leakage rate per barrier
- Barrier failure event tree: conditional on sequence conditions, each barrier fails or holds

---

### 3.12 Radiological Consequence (RC) Module

**Purpose:** Compute dose to workers and public; populate `ConsequenceResult`.

**Sub-components:**

**3.12.1 Site Characterization Panel**

- Site map importer: terrain, exclusion zone radius, population distribution
- Meteorological data importer: joint frequency distribution of wind direction/speed/stability class
- Receptor definition: maximum individual at exclusion area boundary, 50-mile population grid

**3.12.2 Atmospheric Dispersion Model** _(see Solver 5.7)_

- Model selector: Gaussian plume (RADTRAD-equivalent) | Straight-line puff | MACCS sector-averaged
- Release parameter inputs from MS module: release rate, release height, release duration
- Output: χ/Q (concentration-to-flow-rate ratio) by sector and distance

**3.12.3 Dose Calculator**

- Pathway selector: cloudshine, groundshine, inhalation, ingestion
- Dose conversion factors: EPA Federal Guidance or ICRP-based
- Worker dose: control room, onsite worker
- Public dose: exclusion area boundary, low-population zone

**3.12.4 Consequence Integration**

- Risk-triplet assembly: sequence frequency × release fraction × dose = risk
- Complementary cumulative distribution function (CCDF) of dose to maximum individual
- Early fatality / latent cancer fatality estimates (for MACCS-level analysis)
- Acceptance criteria check vs. 10 CFR 50.34 / RG 1.183 dose limits

---

### 3.13 Risk Integration (RI) Module

**Purpose:** Assemble total risk picture, uncertainties, and sensitivity; populate `RiskMetric` and `UncertaintyResult`.

**Sub-components:**

**3.13.1 Risk Aggregation Panel**

- Sum all POS-weighted sequence frequencies → total CDF by POS and overall
- Level 2: total large early release frequency (LERF) and large release frequency (LRF)
- POS contribution chart: pie/bar of risk by operating state
- Hazard contribution chart: internal events vs. fire vs. flood vs. seismic vs. other external

**3.13.2 Acceptance Criteria Dashboard**

- Regulatory target display (RG 1.247): CDF target, LERF target, cliff-edge criteria
- Model uncertainty adder: add model uncertainty factor to mean risk estimate
- Go/No-Go status for each metric (color-coded)

**3.13.3 Integrated Sensitivity Study Runner**

- Global sensitivity: vary all uncertain parameters simultaneously, rank by Sobol index or rank correlation
- Single-parameter sensitivity: slider for any parameter → live update to risk metric
- Cliff-edge search: binary search for parameter value that puts risk metric at acceptance limit

**3.13.4 Key Assumptions & Limitations Register**

- Structured log: Assumption ID, Description, Conservative or Non-conservative, Impact estimate, Resolution path
- Pre-operational assumption flag: assumptions requiring resolution before fuel load
- Auto-populated from: SC, HRA, DA, MS modules where user flagged uncertainty

---

### 3.14 Internal Hazards (IH) Module

**Purpose:** Fire, flood, spray, high-energy line break; hazard-specific fault trees merged into main model.

**Sub-components:**

**3.14.1 Fire Analysis Workbench**

- Fire scenario definition: ignition source (from drawing module electrical components) + fire zone
- Fire growth model interface: CFAST / FDS parameter input form → submit to fire solver
- Cable failure model: define cable routing from drawing module; fire-induced spurious actuation logic
- Fire-induced initiating event: cables in zone → which systems affected → initiating event frequency
- NUREG/CR-6850 methodology checklist: fire ignition frequency lookup by fire area type

**3.14.2 Flood Analysis Workbench**

- Flood source inventory: pipe sizes, flow rates, isolation valve logic per zone
- Flood propagation model: zone interconnection paths (floor drains, doors, cable penetrations)
- Zone interaction fault tree: flood reaches safety equipment → system fails
- High-energy line break: pipe whip exclusion zone check, jet impingement target list

**3.14.3 Hazard Screening Tool**

- Hazard list: fire, flood, spray, HELB, chemical release, electromagnetic interference, loss of HVAC, loss of normal power
- Screening criteria: low probability OR no safety-significant components in zone → screened out with documented basis
- Non-screened hazards → passed to dedicated workbench

---

### 3.15 External Hazards (EH) Module

**Purpose:** Seismic, wind/tornado, external flood, transportation, other; seismic PRA (SPRA) primary.

**Sub-components:**

**3.15.1 Seismic Hazard Interface**

- Hazard curve importer: GMPE-based PSHA results (CSV or standard format)
- Site-specific soil column definition: Vs30, soil profile for site amplification
- Uniform hazard spectrum display by return period

**3.15.2 Fragility Analysis Tool**

- Component fragility input: High Confidence Low Probability of Failure (HCLPF), median capacity, β_r, β_u
- Method selector: CDFM | Hybrid method | EPRI/SQUG approach
- Walkdown data importer: anchor bolt sizes, anchorage details → fragility computation
- Fragility curve display per component

**3.15.3 SPRA Quantification** _(see Solver 5.8)_

- Hazard curve × fragility curve convolution → component failure probability vs. PGA
- Seismic fault tree: replace normal failure probabilities with seismic-conditional ones at each PGA bin
- Hazard binning: typically 8–12 PGA bins spanning full hazard curve
- Risk integration: sum over bins → seismic CDF contribution

**3.15.4 Wind / Tornado / External Flood Workbench**

- Hazard curve input: annual exceedance probability vs. wind speed or flood elevation
- Missile model: tornado-borne missile impact probability on structures
- Structure/component fragility vs. wind/flood loading
- Same fault tree overlay method as seismic

---

### 3.16 Report Generation Module

**Purpose:** Compile regulatory compliance package per RG 1.247 / ASME RA-S-1.4.

**Sub-components:**

**3.16.1 Template Engine**

- Report template: mirrors RA-S-1.4 technical element structure
- Auto-fills from MEF `ProcessDocumentation` objects: scope, methodology, assumptions per element
- Figures auto-inserted: MLDs, event trees, fault trees (as SVG), risk pie charts, CCDF plots

**3.16.2 Traceability Matrix Generator**

- For each requirement in RG 1.247: which MEF object, which analysis, which result satisfies it
- Gap detector: requirements with no linked MEF evidence flagged as open items

**3.16.3 Assumption & Uncertainty Summary**

- Pulls `PreOperationalAssumption` and `ModelUncertainty` objects from all modules
- Formats per RA-S-1.4 Section on documentation requirements
- Color-codes by resolution status

**3.16.4 Peer Review Tracker**

- Fact-finding and observation log per technical element
- Response/resolution status per finding
- SFR (Supporting Requirement) compliance table per technical element and capability category

**3.16.5 Export Formats**

- PDF (rendered report)
- DOCX (editable report)
- OpenPRA MEF JSON (full model export, machine-readable)
- SAPHIRE import package
- Custom ZIP: all figures + tables + model files

---

## 4. Backend Components

### 4.1 MEF Schema Engine

**Purpose:** Single source of truth for all data; enforces schema integrity.

**Functions:**

- Runtime schema validation on every write (not just at submission) — validate against OpenPRA MEF TypeScript interfaces
- ID uniqueness enforcement: all MEF objects carry typed IDs matching format `^[A-Z]{2,4}-[A-Z0-9_-]+$`
- Cross-reference validation: foreign key checks across MEF namespaces (e.g., `FaultTree.topEvent` must exist in `BasicEvent` registry)
- MECE checker for POS set
- Circular dependency detector for fault tree gate loops
- Change log: every write appended to immutable audit log with timestamp, user, diff

### 4.2 Analysis Orchestration Service

**Purpose:** Manage multi-step analysis workflows; sequence dependent jobs.

**Functions:**

- Workflow definition: DAG of analysis steps per technical element
- Pre-condition checks before each step (e.g., SC must be complete before ES quantification can run)
- Job dispatch: send computation jobs to solver cluster via job queue
- Result ingestion: parse solver outputs, write results to MEF store
- Dependency propagation: when a parent object changes (e.g., component fails, triggers fault tree recalculation flag), notify downstream modules
- Rollback: if a solver job fails, revert MEF state to pre-run snapshot

### 4.3 Configuration Control Service

**Purpose:** Track model versions; support multi-analyst collaboration.

**Functions:**

- Model versioning: every save creates a named snapshot; snapshots are immutable
- Branching: create analysis branches (e.g., Design Revision A vs. B); merge with conflict resolution
- Locking: lock a technical element for editing by one user; others can view but not write
- Baseline management: mark official revision baselines (e.g., "Preliminary Safety Analysis", "Final PRA")
- Diff viewer: compare any two snapshots at object level

### 4.4 Authentication & Authorization Service

**Functions:**

- Role-based access: Analyst | Reviewer | Approver | Read-Only | Admin
- Technical element permissions: a user may have Analyst on SY but Reviewer on HRA
- Audit trail: all access events logged
- Multi-factor authentication for Approver role

### 4.5 Solver Adapter Service

**Purpose:** Translate MEF model objects into solver-specific input formats; ingest results.

**Functions:**

- MEF → SAPHIRE translator: convert `FaultTree` and `EventTree` MEF objects to SAPHIRE MAR-D format
- MEF → OpenPSA MEF translator: convert to OpenPSA XML for SCRAM solver
- MEF → RELAP5/SAM input deck builder: extract success criteria parameters, boundary conditions
- MEF → MELCOR input deck builder: extract source term scenario conditions
- MEF → MACCS input builder: extract release categories, site data
- Result parser: ingest solver output files → write structured results back to MEF `ResultSet` objects
- Unit normalization: enforce consistent units across all solver interfaces

### 4.6 Report Compilation Service

**Functions:**

- Template rendering: populate report template with live MEF data
- Figure generation: SVG to PDF-ready images for all logic diagrams, fault trees, event trees
- Table assembly: pull importance measures, sequence frequencies, consequence results
- Regulatory matrix compiler: map every RA-S-1.4 Supporting Requirement to MEF evidence
- Output format handlers: PDF renderer, DOCX generator, JSON packager

---

## 5. Solver Algorithms & Engines

All solvers run as isolated, containerized jobs on a solver cluster. Jobs are queued, managed, and monitored by the Analysis Orchestration Service.

### 5.1 Initiating Event Frequency Estimator

**Inputs:** Component failure data, operating history, generic priors
**Algorithms:**

- Poisson process MLE: λ̂ = n/T (failures per exposure)
- Gamma-Poisson Bayesian conjugate update: posterior α = α₀ + n, β = β₀ + T
- Log-normal fit for non-Poisson data: method of moments or MLE
- Jeffreys non-informative prior: α₀ = 0.5, β₀ = 0 (for zero-failure cases)
- Output: point estimate + 5th/50th/95th percentile bounds → writes `FrequencyEstimate`

### 5.2 Thermal-Hydraulic Solver Interface

**Supported codes (external, interfaced via input deck builder):**

- RELAP5-3D / RELAP5/MOD3 — LWR-heritage; usable for water-cooled non-LWR
- SAM (Argonne) — sodium fast reactor, molten salt reactor, gas-cooled
- Flownex — general thermal-fluid network solver
- TRACE — NRC code for advanced reactor
  **Job type:**
- Steady-state: compute nominal operating conditions
- Transient: simulate initiating event + operator/system response → extract time to damage thresholds
- Uncertainty: run N samples (Latin Hypercube) over uncertain input parameters → PIRT-guided
  **Output:** Time-history files → parsed for success criterion pass/fail thresholds

### 5.3 Neutronics Solver Interface

**Supported codes:**

- Serpent 2 — Monte Carlo neutronics; depletion; multigroup cross-section generation
- OpenMC — open-source Monte Carlo
- PARCS / DYN3D — nodal kinetics for transient analysis (coupled to T/H)
  **Job type:**
- Criticality: confirm keff, reactivity coefficients
- Transient kinetics: reactivity insertion accident simulation → peak power, fuel temperature
  **Output:** Reactivity margins, temperature coefficients → inform SC basis

### 5.4 Logic Solver (Fault Tree / Event Tree Quantification)

**Algorithms (implemented natively or via adapter to SCRAM/SAPHIRE/OpenPSA):**

- **Fault tree minimal cut set (MCS) generation:**
  - Boolean reduction: successive substitution algorithm
  - Binary Decision Diagram (BDD): ZBDD-based exact solution, no truncation error, handles large trees
  - Truncation: configurable probability floor (default 1E-12); convergence verified by progressive tightening
- **Event tree linking:** top-event probability from FT inserted at ET branch points
- **Sequence frequency:** product of IE frequency × branch probabilities along path
- **Rare event approximation:** P(seq) ≈ Σ P(cut set) when cut sets are small
- **Mutually exclusive event check:** detect conflicting basic events in same cut set
- **CCF expansion:** alpha-factor expansion of CCF group into independent + dependent terms

### 5.5 Uncertainty Propagation Engine

**Algorithms:**

- **Monte Carlo simulation:**
  - Sample input parameters from assigned distributions (lognormal, beta, gamma, uniform, point)
  - Propagate through fault tree/event tree logic for each sample
  - N = 10,000 minimum; 1,000,000 for final results
  - Output: full distribution of CDF, LERF, sequence frequencies
- **Latin Hypercube Sampling (LHS):** stratified sampling for efficiency; faster convergence than pure MC
- **Importance sampling:** focus samples near rare-event tails for better tail estimation
- **Importance measures:**
  - Fussell-Vesely: FV_i = Σ P(cutsets containing event i) / total frequency
  - RAW: Risk\_{with event i at 1} / baseline risk
  - RRW: baseline risk / Risk\_{with event i at 0}
  - Birnbaum: ∂F/∂p_i (marginal sensitivity)
- **Global sensitivity:** Sobol indices via Monte Carlo; rank correlation coefficients

### 5.6 Severe Accident / Source Term Solver Interface

**Supported codes:**

- MELCOR 2.2 (adapted for non-LWR via custom MELTUP / non-LWR packages)
- SAM (Argonne) — integral accident code for sodium and salt reactors
- ORIGEN 2.2 / SCALE ORIGEN — radionuclide inventory and decay
- BISON / PARFUME — TRISO fuel performance (high-temperature gas reactor)
  **Job types:**
- Inventory calculation: burnup + cooling time → isotopic inventory
- Accident progression: scenario initial conditions → release fraction by nuclide group, timing, chemical form
- Sensitivity runs: vary uncertain parameters (e.g., aerosol settling rate, retention efficiency)
  **Output:** Release categories defined by: magnitude (fraction of inventory), timing (early / late), energy (hot / cold), chemical form (elemental I, CsI, aerosol, noble gas) → writes `SourceTermResult`

### 5.7 Atmospheric Dispersion & Dose Solver

**Algorithms:**

- **Gaussian plume model:** χ/Q = [1/(π σ_y σ_z u)] × exp(-H²/2σ_z²)
  - Pasquill-Gifford stability classes A–F
  - Site-specific σ_y, σ_z as function of stability and distance
  - Wake correction for large structures
- **Sector-averaged χ/Q:** for long-term dose, average over wind sector frequencies
- **MACCS-equivalent sector model:** joint frequency table of wind direction × stability × wind speed
- **Dose computation:**
  - Cloudshine: DCF × air concentration × exposure time
  - Groundshine: DCF × ground deposition × dose rate factor
  - Inhalation: breathing rate × air concentration × dose per unit intake
  - Dose conversion factors: FGR-11/12 (EPA) or ICRP-72/103
- **Output:** χ/Q table by distance/sector, dose by pathway and receptor → writes `ConsequenceResult`

### 5.8 Seismic Probabilistic Risk Assessment (SPRA) Solver

**Algorithms:**

- **Hazard deaggregation:** mean hazard curve from PSHA deaggregated by magnitude-distance
- **Fragility function:** P(failure | PGA) = Φ[ ln(PGA/Am) / β_c ] where β_c = √(β_r² + β_u²)
  - Am = median capacity, β_r = randomness, β_u = uncertainty
  - CDFM method: conservative deterministic failure margin → HCLPF = Am × exp(-1.65 β_c)
- **Seismic risk integral:** CDF_seismic = ∫ P(damage|PGA) × |dH(PGA)/dPGA| dPGA
  - Numerical: sum over PGA bins with trapezoidal integration
  - Typically 8 bins: 0.05g, 0.1g, 0.2g, 0.3g, 0.5g, 0.75g, 1.0g, 1.5g
- **Seismic systems analysis:** at each PGA bin, replace component failure probabilities with seismic fragility → run fault tree quantification → sequence fragility
- **SPRA fragility:** convolve system fragility with hazard curve → seismic CDF contribution

### 5.9 Fire Risk Solver

**Algorithms:**

- **Fire growth model (CFAST/zone model):**
  - Two-zone differential equations: upper/lower layer temperature, oxygen, smoke
  - Fire heat release rate (HRR) curve: input or cable fire correlations
  - Time to untenable conditions per zone
- **Cable failure model:**
  - Time to ignition: critical heat flux threshold or temperature threshold
  - Failure mode: open circuit, short circuit, hot short — by cable type and insulation
  - Spurious actuation logic: identify which actuation signals are affected
- **Fire ignition frequency:** NUREG/CR-6850 Table H-1 ignition sources by area type; plant-specific adjustment
- **Fire conditional core damage probability (CCDP):** given fire in zone, P(core damage) from fault trees with fire-affected components failed

### 5.10 HRA Quantification Engine

**Algorithms:**

- **SPAR-H:** nominal HEP × PSF multipliers; diagnosis-action decomposition
- **THERP:** task analysis → error mode → Table 20 nominal HEPs × PSF
- **IDHEAS:** context-based; crew response function → cognitive sub-function failure rates
- **Time-reliability correlation:** TRC curve fit: HEP(t) = a × exp(-b × t/T_median) or IDHEAS time curve
- **Dependency model:** P(B|A) = [Complete: 1.0 | High: (1+P)/2 | Moderate: (0.14+P)/2 | Low: (0.05+P)/2 | Zero: P]
- **Recovery credit:** credit for re-performance; bounded by procedure, time, feedback availability

---

## 6. API Design

### 6.1 REST Endpoints (Core)

```
POST   /api/v1/projects                    Create new PRA project (MEF model instance)
GET    /api/v1/projects/{id}/mef           Export full MEF JSON
PUT    /api/v1/projects/{id}/mef           Import/replace full MEF JSON

GET    /api/v1/projects/{id}/elements      List technical elements + completeness status
GET    /api/v1/projects/{id}/elements/{te} Get all MEF objects for a technical element
POST   /api/v1/projects/{id}/elements/{te} Create/update MEF object in technical element

POST   /api/v1/projects/{id}/jobs          Submit solver job (specify type, inputs)
GET    /api/v1/projects/{id}/jobs/{jid}    Job status + results when complete
DELETE /api/v1/projects/{id}/jobs/{jid}    Cancel job

GET    /api/v1/projects/{id}/report        Generate compliance report (async)
GET    /api/v1/projects/{id}/traceability  Get full traceability matrix
GET    /api/v1/projects/{id}/assumptions   Get all assumptions + pre-op flags

GET    /api/v1/data/generic-db             Query generic failure rate database
GET    /api/v1/data/regulatory-reqs        Get RA-S-1.4 / RG 1.247 requirement list
```

### 6.2 WebSocket Channels

```
ws://…/projects/{id}/updates    Real-time: MEF object changes, job progress, peer review events
ws://…/projects/{id}/solver     Live solver output streaming (log lines, intermediate results)
```

### 6.3 Error Model

All errors return structured JSON with:

- `code`: machine-readable error class (e.g., `SCHEMA_VALIDATION_FAILURE`, `SOLVER_TIMEOUT`)
- `element`: which technical element and MEF object ID triggered the error
- `detail`: human-readable description
- `resolution`: suggested fix

---

## 7. Integration Points

| External System          | Direction     | Interface                                   | Purpose                     |
| ------------------------ | ------------- | ------------------------------------------- | --------------------------- |
| ORIGEN/SCALE             | Outbound      | File-based (input deck write, output parse) | Radionuclide inventory      |
| RELAP5 / SAM / Flownex   | Outbound      | File-based                                  | Thermal-hydraulic SC basis  |
| Serpent2 / OpenMC        | Outbound      | File-based                                  | Neutronics SC basis         |
| MELCOR                   | Outbound      | File-based                                  | Severe accident source term |
| MACCS                    | Outbound      | File-based                                  | Consequence analysis        |
| SAPHIRE                  | Bidirectional | MAR-D file format                           | Logic model exchange        |
| OpenPSA / SCRAM          | Bidirectional | OpenPSA XML                                 | Logic solver                |
| CFAST / FDS              | Outbound      | Input deck                                  | Fire growth modeling        |
| PSHA output (any code)   | Inbound       | CSV hazard curve                            | Seismic hazard              |
| Plant DCS / procedure DB | Inbound       | Structured import                           | POS, HRA, IE data           |
| NRC ePortal / ADAMS      | Outbound      | PDF/DOCX upload                             | Regulatory submission       |

---

## 8. Data Storage Architecture

### 8.1 MEF Object Store

- Primary: document database (JSON-native) — each MEF object = one document
- Schema enforced at write via validation service
- Indexed by: project ID, technical element type, object ID, modification date
- Full-text index on: description fields, assumption text, procedure references

### 8.2 File Store

- Solver input decks, output files, imported drawings: object storage (S3-compatible)
- Named by: project ID / job ID / filename
- Lifecycle policy: solver scratch files purged after N days; final results retained

### 8.3 Time-Series / Results Store

- Solver output time-series (T/H transient results, Monte Carlo samples): columnar or time-series store
- Enables fast percentile computation and slicing without re-running solver

### 8.4 Audit Log

- Append-only event log: all MEF writes, job submissions, report exports, user access
- Immutable; required for regulatory defensibility

---

## 9. Non-LWR Specific Considerations

The following features are unique to non-LWR and must be treated as first-class citizens in the app (not afterthoughts):

| Non-LWR Feature                                         | Module Impact                                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Passive safety systems dominant                         | SY module: passive system reliability tool mandatory, not optional                                   |
| No high-pressure boundary in many designs               | SC module: success criteria often temperature-based, not pressure-based                              |
| Novel coolants (Na, salt, He, Pb)                       | MS module: chemistry model for each coolant type; aerosol model for sodium fire                      |
| TRISO fuel (no cladding failure in normal sense)        | MS module: BISON/PARFUME interface; TRISO failure fraction model                                     |
| Longer thermal response times                           | ES module: DET timing windows much longer than LWR; mission times extend to days                     |
| Lower fission product inventory at power (some designs) | RC module: source term may be much lower; consequence analysis methods must remain valid at low dose |
| Pre-operational / first-of-kind uncertainty             | DA module: expert elicitation dominant; extra pre-op assumption flags throughout                     |
| Modular / microreactor multi-unit                       | SY module: multi-unit common cause analysis; site-level risk aggregation in RI module                |

---

## 10. Development Roadmap

### Phase 1 — Foundation (Months 1–6)

- MEF schema engine + database
- Authentication + configuration control service
- Plant drawing module (P&ID basic + MEF write)
- POS module
- IE module (MLD builder + FMEA worksheet + Bayesian frequency estimator)
- Basic report skeleton

### Phase 2 — Core PRA Model (Months 7–14)

- ES module (FET editor + end-state binning)
- SY module (fault tree editor + CCF manager + test/maintenance calculator)
- DA module (Bayesian updater + generic data library)
- HRA module (SPAR-H / THERP calculators)
- SC module (success criterion registry + T/H code interface)
- ESQ module (BDD/MCS solver + importance measures)
- Uncertainty propagation engine

### Phase 3 — Level 2 / Consequences (Months 15–20)

- MS module (ORIGEN interface + transport model + severe accident code interface)
- RC module (Gaussian dispersion + dose calculator)
- RI module (risk integration + acceptance criteria dashboard)

### Phase 4 — Hazards (Months 21–26)

- IH module (fire workbench + flood workbench)
- EH module (SPRA solver + seismic fragility tool + wind/tornado workbench)
- Hazard screening tool

### Phase 5 — Report & Compliance (Months 27–30)

- Full report generation engine (PDF/DOCX export)
- Traceability matrix generator
- Peer review tracker
- Pre-operational assumption resolution tracker
- RG 1.247 compliance dashboard

---

## 11. Quality Assurance Hooks

- **Schema validation on save:** every MEF write validated; invalid writes rejected with error
- **Solver input/output checksums:** detect corrupted or truncated solver files
- **Cross-element consistency checks:** run nightly; flag: FT basic events with no data, ET headings with no FT link, SC with no T/H basis, IE group with no sequences in ET
- **Sensitivity check on quantification:** re-run with truncation limit 10× tighter; flag if CDF changes > 5%
- **Automated peer review checklist:** for each technical element, generate SFR-level compliance checklist pre-populated with model data; reviewer fills pass/fail + findings

---

_End of Technical Specification_
