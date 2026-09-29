interface SyDrawerContext {
  kind: "system" | "sysdef" | "variant" | "alignment" | "boundary" | "states" | "operations" | "ccf" | "hfe" | "screening" | "behavior" | "trip" | "unavail" | "ssc" | "spc" | "inv" | "dic" | "dep" | "need" | "act" | "method" | "confirm" | "detail" | "cbound" | "module" | "naming" | "convention" | "oc" | "unc" | "uccf" | "udep" | "puc" | "assum" | "sens" | "be" | "house" | "diagram";
  id: string;
  modelId?: string;
  diagramId?: string;
}

export type { SyDrawerContext };
