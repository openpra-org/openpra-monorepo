import { Unique, Named } from "./meta";
import { ImportanceLevel } from "./shared-patterns";
import { DistributionType } from "../data-analysis/data-analysis";

/**
 * Base interface for assumptions across all technical elements
 */
export interface BaseAssumption {
  /** Description of the assumption */
  description: string;
  
  /** Justification or rationale for the assumption */
  justification?: string;
  
  /** Impact of the assumption on the analysis */
  impact?: string;
  
  /** References to supporting documentation */
  references?: string[];
  
  /** Whether this is due to lack of as-built/as-operated details */
  isPreOperational?: boolean;
  
  /** Plans to address or validate the assumption */
  addressingPlans?: string;
  
  /** Status of the assumption */
  status?: "OPEN" | "CLOSED" | "IN_PROGRESS";
}