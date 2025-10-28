/** Row in an FMEA table keyed by column id. */
export interface Row {
  id: string;
  row_data: Record<string, unknown>;
}
