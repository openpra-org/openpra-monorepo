# Seismic PRA Workflow TODO

Design the workbook around the analyst's engineering workflow and technical handoffs. Map HLRs and supporting requirements to the resulting records as conformance checks; do not use HLR order to define the user journey.

## Step 01 - Establish the analysis basis

- [x] Define the intended application and decisions supported by the Seismic PRA.
- [x] Define the plant, unit, plant operating state, and radioactive-material-source scope.
- [x] Define the risk endpoints, event-sequence families, and release categories.
- [x] Define required uncertainty outputs; assess capability category separately for each applicable supporting requirement.
- [x] Define the shared ground-motion parameters, frequencies, damping, directions, and control points.
- [x] Assign technical ownership and establish controlled, versioned interfaces.

## Step 02 - Build the qualified evidence base

- [x] Register the existing PRA records used by the Seismic PRA.
- [x] Register P&IDs, electrical diagrams, layouts, and structural drawings.
- [x] Register seismic design, qualification, test, and response calculations.
- [x] Register site, geological, seismological, and geotechnical information.
- [x] Register procedures, operating experience, walkdown records, and configuration information.
- [x] Record evidence provenance, revision, applicability, limitations, assumptions, and identified gaps.

## Step 03 - Freeze the baseline PRA and identify the seismic delta

- [x] Freeze the applicable baseline PRA model and version.
- [x] Identify the baseline POSs, initiators, sequences, success criteria, systems, data, and HFEs.
- [x] Identify the applicable fire, flood, external-hazard, and risk-integration models.
- [x] Classify every affected baseline record as reused, modified, or newly required.
- [x] Establish the seismic model boundaries and unresolved technical-element interfaces.

## Step 04 - Build the initial SEL and failure-consequence map

- [x] Add active SSCs represented in the baseline PRA.
- [x] Add structures, passive components, supports, cabinets, relays, and distribution equipment.
- [x] Add fire, flood, interaction, and operator-support SSCs.
- [x] Record plant identifiers, functions, locations, mounting, and parent structures or cabinets.
- [x] Map each SSC to its systems consequence and credible physical failure mechanisms.
- [x] Assign preliminary screening dispositions and correlation groups.

## Step 05 - Develop the site seismic-hazard model

- [x] Define the PSHA study design and structured evaluation process.
- [x] Compile and evaluate the earthquake catalog and completeness treatment.
- [x] Characterize fault and distributed seismic sources.
- [x] Select and weight applicable ground-motion models.
- [x] Model local site response and its uncertainty.
- [x] Calculate mean and fractile hazard curves.
- [x] Develop uniform hazard spectra, vertical motion, and deaggregation results.
- [x] Evaluate fault displacement, liquefaction, settlement, slope, and earthquake-induced external-flood hazards.

## Step 06 - Translate site hazard into plant demand

- [x] Select reference earthquake levels and target spectra.
- [x] Develop compatible horizontal and vertical input time histories.
- [x] Calculate foundation input motion.
- [x] Model soil-structure interaction.
- [x] Develop three-dimensional structural-response models.
- [x] Calculate floor, cabinet, and component response.
- [x] Characterize median demand, variability, and model uncertainty.
- [x] Map the correct demand record to every applicable SEL item.
- [x] Demonstrate response-model and simulation convergence.

## Step 07 - Validate the plant configuration and finalize the SEL

- [x] Perform the required plant walkdown or pre-operational design review.
- [x] Confirm equipment identity and installed or intended configuration.
- [x] Verify anchorage, supports, and complete load paths.
- [x] Evaluate spatial interactions and differential movement.
- [x] Identify internal fire and flood sources created by seismic failures.
- [x] Verify operator routes, controls, communications, lighting, and indications.
- [x] Record vulnerabilities, open findings, and remaining data gaps.
- [x] Reconcile demand locations and failure modes and finalize the SEL scope.

## Step 08 - Screen SSCs and develop fragilities

- [x] Establish risk-based screening targets using the hazard and plant logic.
- [x] Perform inherent-ruggedness and capacity screening.
- [x] Assign justified representative fragilities where appropriate.
- [x] Develop detailed fragilities for risk-significant SSC failure modes.
- [x] Record the governing failure mechanism for every modeled fragility.
- [x] Calculate median capacity, beta_R, beta_U, and HCLPF where applicable.
- [x] Link each fragility to its capacity and demand evidence.
- [x] Establish correlation groups and their physical bases.
- [x] Evaluate fragility uncertainty and sensitivity.

## Step 09 - Construct the seismic plant-response model

- [x] Identify direct seismic initiating events.
- [x] Identify secondary-hazard and consequential initiating events.
- [x] Evaluate multi-unit and multi-source initiators and dependencies.
- [x] Adapt baseline event sequences, success criteria, and mission times.
- [x] Add seismic basic events to the appropriate systems and sequence logic.
- [x] Model structures, passive failures, relay chatter, interactions, and correlated failures.
- [x] Preserve applicable random failures, unavailability, common cause, and non-seismic dependencies.
- [x] Map sequences to plant end states, event-sequence families, and release categories.

## Step 10 - Model human response under seismic conditions

- [x] Identify applicable baseline HFEs and new seismic-specific actions.
- [x] Define each action in its sequence and damage-state context.
- [x] Evaluate cues, diagnosis, timing, workload, and stress.
- [x] Evaluate control-room conditions and communications.
- [x] Evaluate access routes and local execution conditions.
- [x] Define the seismic damage-state or hazard-bin treatment.
- [x] Evaluate recovery credit and HFE dependencies.
- [x] Quantify seismic HEPs and their uncertainty.

## Step 11 - Quantify annual seismic risk

- [x] Define hazard intervals or an alternative numerical-integration method.
- [x] Convolve hazard and fragility consistently at the shared intensity parameter and control point.
- [x] Integrate conditional initiator, SSC, HFE, and sequence probabilities.
- [x] Calculate event-sequence-family and release-category frequencies.
- [x] Use an exact or controlled Boolean solution appropriate for large conditional probabilities.
- [x] Assess rare-event approximations and overlapping cut sets.
- [x] Evaluate the high-motion tail and truncation treatment.
- [x] Demonstrate bin or numerical convergence.
- [x] Propagate significant parameter and model uncertainty.
- [x] Produce sensitivity results and significant cut sets.

## Step 12 - Interpret results and iteratively refine the model

- [x] Identify dominant ground-motion ranges and hazard sources.
- [x] Identify important initiators, sequences, and release outcomes.
- [x] Identify risk-significant SSCs and physical failure mechanisms.
- [x] Evaluate correlation and common-dependency effects.
- [x] Identify important human actions and HRA assumptions.
- [x] Identify parameter and model-uncertainty drivers.
- [x] Define targeted refinements to evidence, demand, fragility, plant logic, and HRA.
- [x] Requantify after each material refinement.
- [x] Establish and verify result-stability and stopping criteria.

## Step 13 - Integrate risk, support decisions, and establish the controlled baseline

- [x] Aggregate results across POSs, units, radioactive-material sources, and seismic initiators.
- [x] Integrate seismic results with internal events and other hazards.
- [x] Demonstrate that overlapping outcomes are not double counted.
- [x] Report plant-level risk, uncertainty, and dominant contributors.
- [x] Translate results into design, operational, procedural, monitoring, and data-collection decisions.
- [x] Provide inputs to defense-in-depth and SSC-classification evaluations.
- [x] Provide bidirectional traceability from risk results to physical evidence and back.
- [x] Run automated technical consistency and conformance validation.
- [x] Complete the controlled technical documentation, peer review, approval, and configuration baseline.

## Workflow behavior

- [ ] Allow Steps 05 through 10 to proceed in parallel where their inputs are available.
- [ ] Make every technical handoff versioned and traceable.
- [ ] Mark downstream records stale when an upstream handoff changes.
- [ ] Support iteration from Step 12 back to any affected technical step.
- [ ] Keep HLR and supporting-requirement status visible as conformance evidence, not navigation.
