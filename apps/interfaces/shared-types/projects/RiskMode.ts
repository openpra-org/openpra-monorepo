import { z } from "zod";
import { TECHNICAL_ELEMENT_CODES, type TechnicalElementCode } from "interfaces-mef-types/technical-element";

const ProjectStatusSchema = z.enum(["baseline", "in-progress", "not-started", "na"]);
type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

const ProjectStateSchema = z.enum(["active", "baseline", "archived"]);
type ProjectState = z.infer<typeof ProjectStateSchema>;

const RiskModeSchema = z.enum([
  "internal-events",
  "internal-hazards",
  "external-hazards",
  "full-scope",
]);
type RiskMode = z.infer<typeof RiskModeSchema>;

interface RiskModeDefinition {
  id: RiskMode;
  name: string;
  desc: string;
}

const RISK_MODES: readonly RiskModeDefinition[] = [
  {
    id: "internal-events",
    name: "Internal Events",
    desc: "Random equipment failures and human errors during normal operation. Excludes hazards.",
  },
  {
    id: "internal-hazards",
    name: "Internal Hazards",
    desc: "Internal events plus internal fire and flooding analyses.",
  },
  {
    id: "external-hazards",
    name: "External Hazards",
    desc: "Internal events plus seismic, high winds, external flooding and other external hazards.",
  },
  {
    id: "full-scope",
    name: "Full Scope",
    desc: "All technical elements — internal events, internal hazards, and external hazards.",
  },
];

type IncludedCode = Exclude<TechnicalElementCode, "UNK">;

const ELEMENT_DISPLAY_NAMES: Readonly<Record<IncludedCode, string>> = {
  POS: "Plant Operating State Analysis",
  IE: "Initiating Event Analysis",
  ES: "Event Sequence Analysis",
  SC: "Success Criteria Development",
  SY: "Systems Analysis",
  HRA: "Human Reliability Analysis",
  DA: "Data Analysis",
  ESQ: "Event Sequence Quantification",
  MS: "Mechanistic Source Term Analysis",
  RC: "Radiological Consequence Analysis",
  RI: "Risk Integration",
  FL: "Internal Flood PRA",
  F: "Internal Fire PRA",
  S: "Seismic PRA",
  HS: "Hazards Screening Analysis",
  W: "High Winds PRA",
  XF: "External Flooding PRA",
  O: "Other Hazards PRA",
};

const ELEMENT_MODE_MEMBERSHIP: Readonly<Record<IncludedCode, RiskMode[] | "all">> = {
  POS: "all",
  IE: "all",
  ES: "all",
  SC: "all",
  SY: "all",
  HRA: "all",
  DA: "all",
  ESQ: "all",
  MS: "all",
  RC: "all",
  RI: "all",
  FL: ["internal-hazards", "full-scope"],
  F: ["internal-hazards", "full-scope"],
  S: ["external-hazards", "full-scope"],
  HS: ["internal-hazards", "external-hazards", "full-scope"],
  W: ["external-hazards", "full-scope"],
  XF: ["external-hazards", "full-scope"],
  O: ["internal-hazards", "external-hazards", "full-scope"],
};

interface TechnicalElementDefinition {
  code: IncludedCode;
  name: string;
  always: boolean;
  modes: RiskMode[];
}

const INCLUDED_CODES = (Object.keys(TECHNICAL_ELEMENT_CODES) as TechnicalElementCode[])
  .filter((c): c is IncludedCode => c !== "UNK");

const ALL_ELEMENTS: readonly TechnicalElementDefinition[] = INCLUDED_CODES.map((code) => {
  const membership = ELEMENT_MODE_MEMBERSHIP[code];
  return {
    code,
    name: ELEMENT_DISPLAY_NAMES[code],
    always: membership === "all",
    modes: membership === "all" ? [] : membership,
  };
});

function elementsForMode(mode: RiskMode): TechnicalElementDefinition[] {
  return ALL_ELEMENTS.filter((e) => e.always || e.modes.includes(mode));
}

function riskModeLabel(mode: RiskMode): string {
  const def = RISK_MODES.find((m) => m.id === mode);
  return def !== undefined ? def.name : mode;
}

export { ProjectStatusSchema, ProjectStateSchema, RiskModeSchema, RISK_MODES, ALL_ELEMENTS, elementsForMode, riskModeLabel };
export type { ProjectStatus, ProjectState, RiskMode, RiskModeDefinition, TechnicalElementDefinition, IncludedCode };
