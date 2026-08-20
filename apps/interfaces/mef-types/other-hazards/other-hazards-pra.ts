import { z } from "zod";
import { OtherHazardsPRASchema } from "../zod/other-hazards/other-hazards-pra";
import { createOtherHazardsSrCatalog, OtherHazardsSrCatalogEntry } from "./other-hazards-pra-common";

export * from "./other-hazards-pra-common";
export type OtherHazardsPRA = z.infer<typeof OtherHazardsPRASchema>;

export interface OtherHazardsStepDefinition {
  id: string;
  number: string;
  label: string;
  subelement: "OHA" | "OFR" | "OPR" | "INTEGRATED" | "WORKFLOW";
  title: string;
  subtitle: string;
}

export const OTHER_HAZARDS_STEP_DEFINITIONS: OtherHazardsStepDefinition[] = [
  { id: "analysis-basis", number: "01", label: "Analysis basis", subelement: "INTEGRATED", title: "Analysis basis, scope, and interfaces", subtitle: "Define applications, capability, site basis, operating states, material sources, baseline PRA, and technical-element handoffs." },
  { id: "site-evidence", number: "02", label: "Site and evidence", subelement: "OHA", title: "Controlled site, design, and evidence basis", subtitle: "Control site and regional data, design information, operating experience, investigations, references, and lifecycle assumptions." },
  { id: "retained-hazards", number: "03", label: "Retained hazards", subelement: "OHA", title: "Retained hazard-group definition", subtitle: "Import HSA dispositions and define complete, non-overlapping hazard groups, subgroups, effects, intensity measures, and analysis boundaries." },
  { id: "source-characterization", number: "04", label: "Sources and effects", subelement: "OHA", title: "Hazard source and effect characterization", subtitle: "Characterize sources, locations, intensity measures, primary effects, spatial influence, warning, duration, and affected plant areas." },
  { id: "frequency-analysis", number: "05", label: "Frequency analysis", subelement: "OHA", title: "Hazard occurrence and frequency analysis", subtitle: "Develop occurrence and severity models from qualified site, regional, generic, historical, simulated, and expert information." },
  { id: "secondary-hazards", number: "06", label: "Secondary hazards", subelement: "OHA", title: "Secondary and combined hazards", subtitle: "Evaluate consequential fires, floods, explosions, toxic environments, missiles, common conditions, and transferred specialized analyses." },
  { id: "hazard-curves", number: "07", label: "Hazard curves", subelement: "OHA", title: "Hazard curves, intervals, and uncertainty", subtitle: "Produce mean and uncertainty-family curves, logic trees, analysis intervals, upper-tail treatment, and convergence evidence." },
  { id: "preliminary-response", number: "08", label: "SSC scope", subelement: "OPR", title: "Preliminary plant response and SSC scope", subtitle: "Identify hazard-induced initiators, required functions, exposed SSCs, supports, operator-action dependencies, and failure modes." },
  { id: "investigation", number: "09", label: "Investigation", subelement: "OFR", title: "Plant investigation and configuration confirmation", subtitle: "Confirm actual or intended configuration, source inventories, spatial interactions, protection features, access routes, and assumptions." },
  { id: "fragility-basis", number: "10", label: "Fragility basis", subelement: "OFR", title: "SSC screening and fragility basis", subtitle: "Screen SSC/effect combinations and select justified demand, capacity, data, dependency, and correlation methods." },
  { id: "fragility-analysis", number: "11", label: "Fragility analysis", subelement: "OFR", title: "SSC and functional fragility analysis", subtitle: "Quantify physical and functional failures with a compatible hazard intensity parameter, including secondary effects and personnel impacts." },
  { id: "scenarios", number: "12", label: "Initiators and scenarios", subelement: "OPR", title: "Initiating-event and scenario development", subtitle: "Develop direct, degraded, secondary, common-cause, multi-unit, and multi-source scenario families and timelines." },
  { id: "plant-response", number: "13", label: "Plant response", subelement: "OPR", title: "Other Hazards plant-response modeling", subtitle: "Adapt event sequences, success criteria, systems, mission times, data, correlations, peer-review dispositions, and Level 2 interfaces." },
  { id: "human-reliability", number: "14", label: "Human reliability", subelement: "OPR", title: "Other Hazards human reliability analysis", subtitle: "Evaluate preparation, response, and recovery under hazard-specific warning, access, habitability, workload, protective-equipment, and dependency conditions." },
  { id: "quantification", number: "15", label: "Quantification", subelement: "OPR", title: "Event-sequence quantification and convergence", subtitle: "Integrate hazard, fragility, plant response, and HRA while treating success states, numerical approximations, screening, and uncertainty." },
  { id: "risk-interpretation", number: "16", label: "Risk interpretation", subelement: "INTEGRATED", title: "Uncertainty, sensitivity, and risk interpretation", subtitle: "Evaluate alternatives and sensitivities, rank contributors, identify vulnerabilities, and refine material model gaps." },
  { id: "risk-integration", number: "17", label: "Risk integration", subelement: "INTEGRATED", title: "Risk integration and controlled baseline", subtitle: "Transfer plant-year and Level 2 results, prevent double counting, record decisions, close traceability, and establish the controlled baseline." },
  { id: "technical-closure", number: "18", label: "Technical closure", subelement: "INTEGRATED", title: "Documentation, conformance, and peer-review readiness", subtitle: "Complete requirement conformance, documentation, interfaces, independent review preparation, findings, limitations, and readiness evidence." },
  { id: "draft", number: "19", label: "Draft", subelement: "WORKFLOW", title: "Produce the draft", subtitle: "Generate and verify the controlled Other Hazards PRA report and supporting analysis package." },
  { id: "review", number: "20", label: "Review", subelement: "WORKFLOW", title: "Review and resolve findings", subtitle: "Perform technical and independent review and resolve findings with traceable evidence." },
  { id: "approval", number: "21", label: "Approval", subelement: "WORKFLOW", title: "Approve and release the baseline", subtitle: "Confirm readiness, obtain approval, and release the configuration-controlled Other Hazards PRA baseline." },
];

export const OHA_SR_CATALOG = createOtherHazardsSrCatalog("OHA", {
  A: [
    "Identify the specific reactor site or define and justify a bounding site for the Other Hazards PRA.",
    "Collect current site and regional information through investigations, records, interviews, and applicable data sources.",
    "Use plant-specific information for CC-II and justify all regional or generic information used for either capability category.",
    "Demonstrate that generic or regional data are applicable and sufficiently conservative when used for CC-I.",
  ],
  B: [
    "Select a hazard intensity parameter that accurately represents the hazard and supports plant-response and fragility integration.",
    "Develop site-specific or justified bounding hazard occurrence and severity models for each retained hazard group or subgroup.",
    "Calculate a family of hazard curves and a mean curve with parameter and model uncertainty propagated.",
    "Use a documented formal expert-judgment process when expert elicitation materially supports the hazard analysis.",
  ],
  C: [
    "Identify consequential secondary hazards and causally related combinations for each retained hazard group.",
    "Quantify secondary-hazard frequency or conditional probability and characterize the resulting plant challenge.",
    "Apply the relevant Fire, Internal Flood, or External Flood requirements when those effects are induced by the retained hazard.",
  ],
  D: [
    "Identify parameter, model, and assumption uncertainties and evaluate reasonable alternatives.",
    "Control pre-operational assumptions and define closure actions for unavailable site or as-built information.",
  ],
  E: [
    "Document the hazard-analysis process, inputs, methods, results, investigations, and information sources.",
    "Document bounding-site justification, secondary-hazard treatment, uncertainty, assumptions, limitations, and alternatives.",
  ],
});

export const OFR_SR_CATALOG = createOtherHazardsSrCatalog("OFR", {
  A: [
    "Identify realistic hazard-induced failure modes for every SSC or function selected by the plant-response analysis.",
    "Include fragility effects from consequential secondary hazards.",
    "Express fragility using the same or demonstrably compatible hazard intensity parameter used by the hazard curve.",
    "Use conservative failure probabilities for CC-I and realistic failure probabilities for CC-II.",
    "Justify generic, test, experience, or design-capacity information used in fragility development.",
  ],
  B: [
    "Perform investigations sufficient to establish or confirm the plant conditions that govern fragility.",
    "Reflect as-built and as-operated conditions, or as-designed and as-intended conditions for pre-operational analyses.",
  ],
  C: [
    "Identify fragility parameter, model, correlation, and assumption uncertainties and evaluate reasonable alternatives.",
    "Control fragility-related pre-operational assumptions and closure actions.",
  ],
  D: [
    "Document fragility methods, SSC scope, failure modes, values, data sources, locations, and investigations.",
    "Document dominant failure modes, correlations, uncertainty, limitations, and generic-data applicability.",
  ],
});

export const OPR_SR_CATALOG = createOtherHazardsSrCatalog("OPR", {
  A: [
    "Identify direct hazard-induced initiating events and degraded plant conditions.",
    "Identify consequential secondary hazards and applicable industry operating experience.",
    "Model risk-significant event sequences and accident progression for every applicable plant operating state.",
    "Identify SSCs, supports, and operator actions needed to maintain operation, respond to the event, and prevent release.",
    "Address multiple reactor units and other radionuclide sources within the PRA scope.",
  ],
  B: [
    "Use the internal-events event-sequence and system model as the basis and add hazard-specific or multi-source sequences as needed.",
    "Resolve or incorporate applicable peer-review findings from the internal-events and relevant hazard PRA models.",
  ],
  C: [
    "Include hazard-induced failures and their dependencies and correlations.",
    "Apply consistent fragility and scenario screening and document aggregate screened contributions.",
    "Justify credit for beneficial hazard-induced failures.",
    "Establish hazard-appropriate success criteria and mission times.",
  ],
  D: [
    "Ensure new event-sequence, success-criteria, systems, data, and pre-initiator HRA logic satisfies the applicable technical-element requirements.",
    "Apply Fire, Internal Flood, or External Flood plant-response requirements to induced secondary effects where applicable.",
  ],
  E: [
    "Carry forward applicable internal-events human failure events and identify new hazard-specific actions.",
    "Review procedures and model human actions at the level of detail needed by the application.",
    "Use screening HEPs that bound detailed values and document the screening basis.",
    "Evaluate hazard-specific performance-shaping factors, warning, timing, access, habitability, workload, staffing, and protective equipment.",
    "Evaluate recovery actions and dependencies under hazard-damaged plant and site conditions.",
  ],
  F: [
    "Integrate hazard occurrence, fragility, plant response, and human reliability in event-sequence quantification.",
    "Treat rare-event approximations and success states correctly when conditional failure probabilities are not small.",
    "Demonstrate convergence for hazard discretization, upper-tail truncation, scenario grouping, and applicable numerical methods.",
    "Apply event-sequence screening consistently and control aggregate screened contributions.",
    "Produce the required point estimate for CC-I or mean and parameter-uncertainty results for CC-II.",
    "Evaluate reasonable model alternatives and propagate risk-significant uncertainty.",
  ],
  G: [
    "Document modifications to the internal-events model, SSC and scenario screening, HRA, correlation, and quantification.",
    "Document risk contributors, sensitivities, uncertainty, assumptions, limitations, and pre-operational closure needs.",
    "Provide traceable outputs for Risk Integration and Level 2 plant-damage-state or release-category modeling.",
  ],
});

export const OTHER_HAZARDS_PRA_SR_CATALOG: Record<string, OtherHazardsSrCatalogEntry> = {
  ...OHA_SR_CATALOG,
  ...OFR_SR_CATALOG,
  ...OPR_SR_CATALOG,
};
