/**
 * Role constraint describing subject/action access rules.
 */
export interface Role {
  action: string | string[];
  subject: string | string[];
  fields?: unknown;
  conditionals?: unknown;
  inverted?: boolean;
  reason?: string;
}
