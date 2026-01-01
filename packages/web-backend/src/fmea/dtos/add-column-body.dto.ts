/**
 * Request body to add a new column to an FMEA.
 * When type is "string", dropdownOptions can be omitted.
 *
 * @public
 */
export type AddColumnBody = {
  /** Display name for the column. */
  name: string;
  /** Column type. */
  type: "string" | "dropdown";
  /** Optional options if type is dropdown. */
  dropdownOptions?: { number: number; description: string }[];
};
