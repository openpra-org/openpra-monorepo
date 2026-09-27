interface SyDrawerContext {
  kind: "system" | "sysdef" | "variant" | "alignment" | "boundary" | "states" | "operations" | "ccf" | "hfe" | "screening" | "behavior" | "trip" | "unavail" | "ssc" | "spc" | "inv" | "dic" | "dep" | "need" | "act" | "method" | "confirm" | "oc" | "unc" | "assum" | "sens" | "be" | "house" | "diagram";
  id: string;
  modelId?: string;
  diagramId?: string;
}

export type { SyDrawerContext };
