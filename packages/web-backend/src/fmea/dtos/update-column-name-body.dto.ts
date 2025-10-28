/**
 * Request body to rename a column in an FMEA.
 *
 * @public
 */
export type UpdateColumnNameBody = {
  /** Current column name. */
  column: string;
  /** New column display name. */
  newColumnName: string;
};
