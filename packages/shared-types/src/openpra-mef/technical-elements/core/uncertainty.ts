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

/**
 * Base interface for model uncertainty across all technical elements
 */
export interface BaseModelUncertainty extends Unique, Named {
  /** Description of the model uncertainty */
  description: string;
  
  /** Assumptions related to this uncertainty */
  assumptions?: BaseAssumption[];
  
  /** Reasonable alternatives that could be considered */
  reasonableAlternatives?: string[];
  
  /** Potential impact on the analysis results */
  impact?: string;
  
  /** Plans to address or reduce this uncertainty */
  addressingPlans?: string;
  
  /** Importance level of this uncertainty */
  importanceLevel?: ImportanceLevel;
  
  /** Characterization of the uncertainty */
  characterization?: {
    /** Type of characterization */
    type: "QUALITATIVE" | "QUANTITATIVE";
    
    /** Description of the characterization */
    description: string;
    
    /** Range or bounds of the uncertainty if quantitative */
    range?: [number, number];
  };
}

/**
 * Base interface for sensitivity studies across all technical elements
 */
export interface BaseSensitivityStudy extends Unique, Named {
  /** Description of the sensitivity study */
  description: string;
  
  /** Parameters varied in the study */
  variedParameters: string[];
  
  /** Range of variation for each parameter */
  parameterRanges: Record<string, [number, number]>;
  
  /** Results of the sensitivity study */
  results?: string;
  
  /** Insights gained from the study */
  insights?: string;
  
  /** Impact on analysis outcomes */
  impact?: string;
}

/**
 * Base interface for statistical uncertainty representation
 */
export interface BaseUncertainty {
  /** The probability distribution type */
  distribution: DistributionType;
  
  /** Parameters of the distribution */
  parameters: Record<string, number>;
  
  /** Sources of uncertainty */
  uncertaintySources?: string[];
  
  /** Sensitivity studies performed */
  sensitivityStudies?: BaseSensitivityStudy[];
}

/**
 * Base interface for uncertainty documentation across all technical elements
 */
export interface BaseUncertaintyDocumentation extends Unique, Named {
  /** Sources of model uncertainty */
  uncertaintySources: {
    /** Source description */
    source: string;
    /** Impact on analysis */
    impact: string;
    /** Applicable parameters/elements */
    applicableElements?: string[];
  }[];
  
  /** Related assumptions */
  relatedAssumptions: {
    /** Assumption description */
    assumption: string;
    /** Basis for assumption */
    basis: string;
    /** Applicable elements */
    applicableElements?: string[];
  }[];
  
  /** Reasonable alternatives considered */
  reasonableAlternatives: {
    /** Alternative description */
    alternative: string;
    /** Reason not selected */
    reasonNotSelected: string;
    /** Applicable elements */
    applicableElements?: string[];
  }[];
}
