/**
 * Request body to update dropdown options for a column.
 *
 * @public
 */
export type UpdateDropdownBody = {
  /** Column name whose dropdown options are updated. */
  column: string;
  /** New set of dropdown options. */
  dropdownOptions: { number: number; description: string }[];
};
