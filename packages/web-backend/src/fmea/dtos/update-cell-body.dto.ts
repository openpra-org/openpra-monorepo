/**
 * Request body for updating a specific cell value in a row.
 *
 * @public
 */
export type UpdateCellBody = {
  /** The row identifier within the FMEA table. */
  rowId: string;
  /** The column key to be updated. */
  column: string;
  /** The new cell value. */
  value: string;
};
