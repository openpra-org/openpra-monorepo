/** Published health-effect parameter cards retained for input review, not calculated outcomes. */
export interface RcHealthParameterRecord {
  cardId: string;
  kind: "early_fatality" | "early_injury" | "latent_cancer";
  effect: string;
  organ: string;
  values: number[];
  original: string;
}

export interface RcHealthInput {
  filename: string;
  original: string;
  records: RcHealthParameterRecord[];
}
