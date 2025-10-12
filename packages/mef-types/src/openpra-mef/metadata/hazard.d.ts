/**
 * Schema defining a Hazard Group
 */
export interface HazardGroup {
  name: string;
  extends?: string[];
  "technical-elements"?: unknown[];
}
