# OpenPRA: Technical Overview

---

## Abstract

OpenPRA is an open-source Probabilistic Risk Assessment (PRA) platform designed to support the full lifecycle of PRA model development, analysis, and deployment. It provides three distinct user-facing interfaces — a command-line interface (CLI), a desktop graphical interface (GUI), and a browser-based web application — all backed by a unified monorepo architecture. This document describes the platform's structural design, component hierarchy, and the role each subsystem plays within the broader ecosystem.

---

## 1. Interfaces

OpenPRA exposes its capabilities through three interactive interfaces, each targeting a different usage context.

### 1.1 Command-Line Interface (CLI)

The CLI provides direct, scriptable access to OpenPRA's solvers and tools. It is intended for automated workflows, high-performance computing environments, and users who prefer programmatic control over analysis pipelines. The CLI wraps solver execution, model conversion, and benchmarking operations behind a consistent command structure.

### 1.2 Graphical User Interface (GUI)

The desktop GUI is a native application that provides a visual environment for building, editing, and analyzing PRA models. It targets practitioner users who require interactive model authoring, fault tree construction, and results visualization without writing code.

### 1.3 Web Application

The web application delivers the same model authoring and analysis capabilities through a browser, enabling collaborative and remote access. It communicates with backend services over standard web protocols and shares frontend logic with the desktop GUI where possible.

---

## 2. Monorepo Architecture

All OpenPRA application code resides in a single monorepo. This ensures consistent tooling, shared dependency management, and coordinated versioning across every component of the platform.

The monorepo is organized into the following top-level directories:

```
openpra/
├── apps/        # Source code for all applications
├── deploy/      # Deployment scripts and infrastructure configuration
├── docs/        # Documentation for all applications
├── fixtures/    # Test files that have known outputs
├── .ci/         # CI/CD pipeline configuration
└── <configs>    # Project-wide configuration files (linting, formatting, build, etc.)
```

`apps/`, `deploy/`, and `docs/` share a parallel internal structure. Each contains the same set of application categories, described in Section 3. This symmetry means that for any given component, its source, deployment configuration, and documentation all live under the same category path within their respective top-level directories.

---

## 3. Application Categories

Every top-level directory (`apps/`, `deploy/`, `docs/`) is subdivided into six categories. These categories represent the functional layers of the OpenPRA ecosystem, ordered roughly from lowest-level infrastructure to user-facing tooling.

### 3.1 Solvers

Solvers are the computational foundation of OpenPRA. They implement the core quantification algorithms — fault tree analysis, event tree analysis, importance measures, uncertainty quantification, and related methods. All other components in the ecosystem ultimately depend on solvers to produce numerical results.

Solvers are designed to be self-contained, high-performance, and invocable from multiple entry points: directly via the CLI, through microservices, or embedded within other tools.

### 3.2 Microservices

Microservices wrap solver functionality behind well-defined service boundaries. Each microservice exposes a narrow, focused capability — such as fault tree quantification or minimal cut set generation — as an independently deployable unit. This design allows solvers to be scaled, versioned, and consumed independently without tight coupling to any single application.

Microservices communicate with backends and tools over standard inter-service protocols.

### 3.3 Backends

Backends serve as the application layer between microservices and frontends. They handle concerns such as authentication, authorization, session management, data persistence, and request orchestration. A backend may coordinate multiple microservices to fulfill a single user request, or it may operate as a standalone service when microservice integration is not required.

Both the GUI and the web application are backed by backend services. The CLI may also interact with backends when operating in a networked or multi-user context.

### 3.4 Frontends

Frontends implement the user interface layer for the GUI and the web application. They provide model authoring environments, results dashboards, and visualization components. Where the GUI and web application share interface logic, that logic is factored into shared frontend libraries within this category.

Frontends consume backend APIs and do not communicate with solvers or microservices directly.
IOS apps. The frontends need to be dynamic. The AI agents should be able to change the frontends on the fly depending on the result.

### 3.5 Interfaces

Interfaces define the data contracts that flow between components. This category contains shared type definitions, data schemas, and model exchange formats used across multiple applications. By centralizing these definitions, OpenPRA ensures that all components — regardless of language or runtime — operate on a consistent, versioned data model.

Interface definitions also serve as the canonical specification for PRA model interchange, enabling external tools to read and write OpenPRA-compatible models.

### 3.6 Utility Tools

Tools are purpose-built applications that extend the OpenPRA ecosystem with specialized capabilities. OpenPRA currently includes four tools:

**Pracciolini — Model Conversion Tool**
Pracciolini converts PRA models between OpenPRA's native format and external formats used by other industry tools. It enables interoperability with existing model libraries and supports migration workflows.

**Benchmarking Tool**
The benchmarking tool provides a structured pipeline for evaluating solver performance and result accuracy. It runs solvers against standardized model sets, collects quantitative metrics, and produces comparative reports. It is used for both internal validation and external performance characterization.

**Technical Report Extraction Tool**
There needs to be AI agents that can extract data from PRA technical reports and map them to the OpenPRA MEF schema or interfaces.

**Report Generation Tool**
These OpenPRA MEF formatted data then needs to be uploaded to OpenPRA Web App's tools. There needs to be AI agents that can generate reports from these tools in Word or PDF format.

### 3.7 Prototyping

**Synthetic Model Generation Tool**
This tool generates synthetic PRA models programmatically for testing, benchmarking, and research purposes. It produces structurally valid models with configurable parameters, allowing controlled experiments at scales that are impractical with real-world models.

**Automated Model Generation from P&ID and PFD**
This tool constructs PRA models directly from engineering source documents — Piping and Instrumentation Diagrams (P&IDs) and Process Flow Diagrams (PFDs). It reduces manual model authoring effort by automating the extraction of system structure and failure logic from plant design documentation.

---

## 4. Structural Symmetry

The parallel structure of `apps/`, `deploy/`, and `docs/` is a deliberate design choice. For any component — say, a specific microservice — its source code, its deployment configuration (container definitions, orchestration manifests, environment specifications), and its documentation all exist under the same named path within their respective top-level directories. This makes the repository navigable by category regardless of whether the concern is development, operations, or documentation.

```
apps/microservices/<name>/     # source code
deploy/microservices/<name>/   # deployment configuration
docs/microservices/<name>/     # documentation
```

This convention scales uniformly across all six application categories.

---

## 5. Summary

OpenPRA is structured as a layered, monorepo-based platform. Solvers provide the computational core. Microservices expose that core as discrete services. Backends orchestrate services and manage application state. Frontends deliver user interfaces for the GUI and web application. Interfaces define the shared data model that connects every layer. Tools extend the platform with model conversion, generation, and benchmarking capabilities.

The three user-facing interfaces — CLI, GUI, and web application — are entry points into this stack, each suited to a different mode of interaction. The monorepo architecture ensures that source, deployment, and documentation remain structurally aligned across all components and all categories.

---

# Non-LWR PRA Technical Elements & Tools
*(Per ASME/ANS RA-S-1.4)*

---

## IE — Initiating Event Analysis
- **Master Logic Diagram (MLD)** — top-down logic to find all initiators
- **FMEA** — component failures → system-level initiators
- **Historical data review** — operational experience, generic databases
- **Expert elicitation** — novel reactor types with no history

---

## POS — Plant Operating States
- **State enumeration tables** — matrix of power/temp/config combos
- **Plant walkdowns / procedure review** — confirm actual states

---

## SC — Success Criteria
- **Thermal-hydraulic codes** (RELAP5, SAC-CFD, SAM, Flownex) — minimum flow/cooling needed
- **Neutronics codes** (Serpent, OpenMC) — reactivity control margins
- **Deterministic bounding analysis** — envelopes for success/failure threshold

---

## ES — Event Sequence Analysis
- **Functional Event Trees (FET)** — high-level challenge → response sequences
- **Dynamic Event Trees (DET)** — time-dependent branching, continuous state tracking
- **Influence Diagrams** — causal structure for complex dependencies
- **RELAP/SAM coupled runs** — inform branch timing and conditions

---

## SY — Systems Analysis
- **Fault Trees (FT)** — system unavailability from component failures
- **Reliability Block Diagrams (RBD)** — series/parallel system logic
- **FMEA** — single-failure identification at component level
- **Common Cause Failure (CCF) models** (MGL, Alpha Factor) — dependent failures

---

## HRA — Human Reliability Analysis
- **THERP** — proceduralized tasks, error probability tables
- **IDHEAS** — cognitive framework, context-based
- **ATHEANA** — error-forcing contexts, commission errors
- **CBDT / IDAC** — dynamic HRA for time-critical actions
- **Time Reliability Correlation (TRC)** — time-stress mapping

---

## DA — Data Analysis
- **Bayesian updating** — plant-specific data + generic priors
- **MLE / MOM** — frequentist parameter estimation
- **Generic databases** (NUREG/CR-6928, IAEA TECDOC) — failure rates, CCF factors
- **Jeffreys prior** — non-informative Bayesian baseline

---

## ESQ — Event Sequence Quantification
- **Fault tree linking** — FTs linked to ET top events → sequence frequency
- **Binary Decision Diagrams (BDD)** — exact solution, no truncation error
- **Monte Carlo simulation** — uncertainty propagation through model
- **SAPHIRE / RiskSpectrum / OpenPSA** — integration platforms
- **Minimal cut set generation** — dominant failure combinations

---

## MS — Mechanistic Source Term Analysis *(Non-LWR specific)*
- **MELCOR** (adapted for non-LWR) — severe accident progression, fission product release
- **SAM** — molten salt / sodium fast reactor accident modeling
- **ORIGEN** — decay heat, isotopic inventory
- **Fuel performance codes** (BISON, PARFUME) — TRISO/advanced fuel failure
- **CFD** (OpenFOAM, STAR-CCM+) — coolant/gas transport in non-standard geometries

---

## RC — Radiological Consequence Analysis
- **MACCS** — offsite dose, health effects, economic consequence
- **RADTRAD** — onsite/control room dose
- **Gaussian plume models** — simple atmospheric dispersion
- **MELCOR/MACCS coupling** — end-to-end source term → consequence chain

---

## RI — Risk Integration
- **Latin Hypercube Sampling (LHS)** — efficient uncertainty space sampling
- **Monte Carlo propagation** — full uncertainty distribution on CDF/LERF
- **Importance measures** (Fussell-Vesely, RAW, RRW) — identify risk drivers
- **Sensitivity analysis** — parameter variation impact on risk metrics
- **Truncation limit studies** — verify low-cutset truncation doesn't bias results

---

## Internal Hazards (IH) — Fire, Flood, etc.
- **Fire**: NUREG/CR-6850 methodology, FAST/CFAST/FDS (fire growth), circuit failure models
- **Flood**: Flood source enumeration, flood propagation logic, zone interaction FTs
- **Spray/high energy line break**: Bounding consequence tables, zone FTs

---

## External Hazards (EH) — Seismic, Wind, etc.
- **Seismic**: HCLPF calculation (fragility curves), SPRA (HAZUS, EPRI NP-6728), GMPE models
- **High winds/tornado**: Probabilistic wind hazard curves, missile impact models
- **Fragility analysis**: Log-normal fragility curves, CDFM / hybrid method

Assume **ASME/ANS non-LWR PRA standard** (RA-S-1.4 family).  
Book versions differ a little. Some smash **Consequence** into **Source Term**. Some smash **Uncertainty** into **Quantification**.  
Tiny fix: **event tree** mostly builds sequence. **Quant** step turns tree + system model into numbers.  
I give **method families**, not every software name.

## 1) Setup / plant states / mission
- **P&IDs, one-lines, logic drawings** — plant map.
- **Mode tables / state vectors** — what plant state.
- **Mission time analysis** — how long stuff must work.
- **Boundary / interface maps** — what model includes.

## 2) Initiating event analysis
- **Master Logic Diagram (MLD)** — top-down hunt for bad start.
- **HAZOP / what-if / PHA** — team asks “what can go wrong?”
- **FMEA / FMECA** — bottom-up fail-start list.
- **Operating experience review** — use real events.
- **Bayes / rate estimation** — how often bad start happens.

## 3) Event sequence analysis
- **Event tree / functional event tree** — branch on success/fail of key functions.
- **Linked event trees / sequence diagrams** — connect many paths.
- **Dynamic event tree** — time, order, physics matter.
- **End-state binning** — group same outcomes.

## 4) Success / safety criteria analysis
- **PIRT** — rank important physics.
- **Thermal-hydraulic models** — cooling, flow, heat removal need.
- **Neutronics / kinetics models** — reactivity, power need.
- **Fuel / structural / chemistry models** — damage limits, barrier limits.
- **CFD / local models** — hot spots, mixing, local effects.
- **Sensitivity / uncertainty runs** — margin size.
- **Response surface / surrogate model** — turn big physics into fast PRA rule.

## 5) Systems analysis
- **Fault tree** — little fails make big system fail.
- **Success tree / reliability block diagram** — success paths.
- **Markov / state-space model** — time, repair, standby, dependency.
- **Dynamic fault tree / Petri net / GO-FLOW** — order and timing logic.
- **Common-cause model** — one cause breaks many items.
- **Dependency / interface analysis** — shared power, cooling, I&C.
- **Test / maintenance unavailability model** — gear out when needed.
- **Passive-system reliability model** — natural circulation, decay heat removal, etc.

## 6) Human reliability analysis
- **Task / cognitive task analysis** — what human sees, thinks, does.
- **Timeline / time-reliability analysis** — enough time or not.
- **THERP / ASEP / SPAR-H / ATHEANA / IDHEAS** — human error number.
- **PSF analysis** — stress, cues, training, procedures.
- **Dependency analysis** — one human action affects next one.
- **Simulator data / expert elicitation** — fill data gaps.

## 7) Data analysis
- **Failure / repair / test data** — raw numbers.
- **Generic + plant-specific data merge** — better numbers.
- **Bayesian update / max-likelihood** — convert data to rates/probabilities.
- **Alpha-factor / beta-factor / similar CCF fits** — common-cause numbers.
- **Repair-time / unavailability estimation** — how long gear stays out.
- **Expert elicitation** — sparse-data fix.
- **Uncertainty distributions** — keep spread, not one number.

## 8) Quantification
- **ET/FT linking** — tie sequence path to system logic.
- **Minimal cut sets** — smallest fail combos.
- **Boolean reduction / BDD** — solve logic clean.
- **Rare-event approx / exact solve** — sequence frequency.
- **Monte Carlo / Latin hypercube / importance sampling** — uncertainty, nonlinear cases.
- **Importance measures (FV, RAW, RRW, Birnbaum)** — what matters most.
- **Truncation / convergence checks** — keep math sane.

## 9) Mechanistic source term / release analysis
- **Radionuclide inventory model** — how much bad stuff exists.
- **Fuel failure model** — when bad stuff leaves fuel.
- **Transport / retention model** — where bad stuff moves or gets trapped.
- **Chemistry / aerosol / deposition model** — form changes, sticking.
- **Confinement / containment leak model** — barrier leak.
- **Release / containment event tree** — barrier-fail paths.
- **Mechanistic source-term / severe-accident code** — amount, timing, form released.
- **Release binning** — group similar releases.

## 10) Consequence analysis
- **Atmospheric dispersion model** — where plume goes.
- **Dose / pathway model** — worker/public dose.
- **Meteorology / site model** — wind, rain, terrain.
- **Consequence binning** — group same harm.

## 11) Uncertainty / sensitivity / integration
- **Parameter uncertainty propagation** — input wiggle.
- **Model uncertainty cases** — method wiggle.
- **Sensitivity studies** — big drivers.
- **Importance ranking** — top contributors.
- **Model checks / peer review / traceability** — catch dumb model.

## 12) Hazard-specific add-ons, if scope includes hazards
- **Hazard ID / screening / MLD** — pick hazards that matter.
- **Hazard curves** — how hard hazard hits.
- **Fragility analysis** — chance SSC breaks under hazard.
- **Walkdowns** — see real plant paths and weak spots.
- **Fire / flood / seismic / wind / external event physics models** — hazard damage details.

*OpenPRA is developed and maintained as an open-source project. Contributions, issue reports, and model format proposals are welcomed through the project's public repository.*
