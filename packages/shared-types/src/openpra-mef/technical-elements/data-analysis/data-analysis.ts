import typia, { tags } from "typia";
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Named, Unique } from "../meta";
import { BasicEvent} from "../events";
import { SystemComponent, FailureMode, SuccessCriteria, UnavailabilityEvent, System } from "../systems-analysis/systems-analysis";
import { PlantOperatingStatesTable } from "../plant-operating-state-analysis/plant-operating-state-analysis";

/**
 * Interface representing the types of parameters used in data analysis.
 * The parameter type determines the type of data analysis that can be performed.
 * The parameter type must be one of the types defined in `ParameterType` enum.
 */
export type ParameterType =
    | "FREQUENCY"
    | "PROBABILITY"
    | "UNAVAILABILITY"
    | "CCF_PARAMETER"
    | "HUMAN_ERROR_PROBABILITY"
    | "OTHER";

/**
 * Enum representing the types of probability models used in data analysis.
 */
export enum DistributionType {
    EXPONENTIAL = "exponential",
    BINOMIAL = "binomial",
    NORMAL = "normal",
    LOGNORMAL = "lognormal",
    WEIBULL = "weibull",
    POISSON = "poisson",
    UNIFORM = "uniform",
    BETA = "beta",
    GAMMA = "gamma",
    POINT_ESTIMATE = "point_estimate",
    // Add other probability models as needed
}

/**
 * Interface representing data sources and their context
 */
export interface DataSource {
    /**
     * The source of the data (e.g., "Plant maintenance records 2020-2023")
     */
    source: string;
    /**
     * The context or type of the data source (e.g., "Industry standard", "Plant specific")
     */
    context?: string;
    /**
     * Any additional notes about the data source
     */
    notes?: string;
}

/**
 * Interface representing an assumption and its context
 */
export interface Assumption {
    /**
     * The assumption statement
     */
    statement: string;
    /**
     * The context or type of the assumption (e.g., "General", "Value-specific")
     */
    context?: string;
    /**
     * Any additional notes about the assumption
     */
    notes?: string;
}

/**
 * Interface representing the uncertainty associated with a parameter.
 * The structure of the uncertainty changes based on the distribution type.
 */
export interface Uncertainty {
    distribution: DistributionType;
    parameters: Record<string, number>;
    /**
     * Sources of uncertainty in the model.
     */
    model_uncertainty_sources?: string[];
}

/**
 * Base Data Analysis Parameter - parent of all data analysis parameters
 * 
 * This interface implements several PRA standard requirements:
 * - DA-A4: IDENTIFY the parameter to be estimated
 * - DA-A5: IDENTIFY the sources of model uncertainty, related assumptions
 * - DA-A6: IDENTIFY assumptions made due to lack of as-built details
 */
export interface BaseDataAnalysisParameter extends Unique, Named {
    description?: string;
    /**
     * The type of parameter being analyzed.
     * DA-A4: IDENTIFY the parameter to be estimated
     */
    parameterType: ParameterType;
    /**
     * Uncertainty information for the parameter.
     * DA-A5: IDENTIFY the sources of model uncertainty
     */
    uncertainty?: Uncertainty;
    /**
     * All data sources used in the analysis, including both general and specific sources.
     * DA-A4: IDENTIFY the data required for estimation
     */
    data_sources?: DataSource[];
    /**
     * All assumptions made in the analysis, including both general and specific assumptions.
     * DA-A5: IDENTIFY the sources of model uncertainty, related assumptions
     * DA-A6: IDENTIFY assumptions made due to lack of as-built details
     */
    assumptions?: Assumption[];
}

/**
 * Data Analysis parameter
 * 
 * This interface implements several PRA standard requirements:
 * - DA-A2: DEFINE failure modes and success criteria
 * - DA-A3: USE an appropriate probability model for each basic event
 * - HLR-DA-B: Grouping components into a homogeneous population
 */
export interface DataAnalysisParameter extends BaseDataAnalysisParameter {
    /**
     * The estimated value for the parameter
     */
    value: number & tags.Minimum<0>;
    
    //Links to event
    basicEventId?: string;
    unavailabilityEventId?: string;

    /**
     * Reference to the system component this parameter is associated with.
     * This provides access to the component's boundary and grouping information.
     * HLR-DA-B: Grouping components into a homogeneous population
     */
    systemComponentId?: string;

    /**
     * Defines how the component can fail.
     * DA-A2: DEFINE failure modes
     */
    failure_mode?: FailureMode;

    /**
     * Defines the criteria for success.
     * DA-A2: DEFINE success criteria
     */
    success_criteria?: SuccessCriteria;

    /**
     * Represents the plant operating state for which the parameter applies.
     * HLR-DA-B: Grouping components into a homogeneous population
     */
    plant_operating_state?: PlantOperatingStatesTable;

    /**
     * The probability model used to evaluate event probability.
     * DA-A3: USE an appropriate probability model for each basic event
     */
    probability_model?: DistributionType;

    /**
     * Alternative approaches or parameters that could be used.
     */
    alternatives?: string[];
}

/**
 * Interface representing an analysis of data parameters, which is a type of technical element.
 *
 * @example
 * ```typescript
 * const analysis: DataAnalysis = {
 *   "technical-element-type": TechnicalElementTypes.DATA_ANALYSIS,
 *   "technical-element-code": "DA",
 *   data_parameters: [
 *     {
 *       uuid: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
 *       name: "Emergency Diesel Generator Failure Rate",
 *       description: "Failure rate analysis for EDG-A during power operation",
 *       parameterType: "FREQUENCY",
 *       value: 1.2e-5,
 *       
 *       // Component and Event References
 *       basicEventId: "BE-EDG-FS-001",
 *       systemComponentId: "SYS-EDG-A",
 *       
 *       // Failure Characteristics
 *       failure_mode: {
 *         type: "FAILURE_TO_START",
 *         description: "Failure to start on demand signal"
 *       },
 *       success_criteria: {
 *         criteria: "Start and reach rated speed within 10 seconds",
 *         basis: "Technical Specifications 3.8.1"
 *       },
 *       
 *       // Operating Context
 *       plant_operating_state: {
 *         state: "AT_POWER",
 *         description: "Normal power operation"
 *       },
 *       
 *       // Statistical Analysis
 *       probability_model: DistributionType.LOGNORMAL,
 *       uncertainty: {
 *         distribution: DistributionType.LOGNORMAL,
 *         parameters: {
 *           median: 1.2e-5,
 *           errorFactor: 3.0
 *         },
 *         model_uncertainty_sources: [
 *           "Limited operational data",
 *           "Environmental factors not fully characterized"
 *         ]
 *       },
 *       
 *       // Data Sources and Assumptions
 *       data_sources: [
 *         {
 *           source: "Plant maintenance records 2020-2023",
 *           context: "Plant specific",
 *           notes: "Based on 156 successful starts and 2 failures"
 *         },
 *         {
 *           source: "NUREG/CR-6928",
 *           context: "Industry average",
 *           notes: "Used for Bayesian update"
 *         }
 *       ],
 *       assumptions: [
 *         {
 *           statement: "Maintenance activities restore component to as-good-as-new condition",
 *           context: "Reliability modeling",
 *           notes: "Based on comprehensive maintenance procedures"
 *         },
 *         {
 *           statement: "Environmental conditions remain within design basis",
 *           context: "Operating environment",
 *           notes: "Verified through environmental monitoring program"
 *         }
 *       ],
 *       
 *       // Alternative Approaches
 *       alternatives: [
 *         "Use of Weibull distribution for age-dependent failure modeling",
 *         "Incorporation of seasonal variation factors"
 *       ]
 *     }
 *   ]
 * };
 * ```
 */
export interface DataAnalysis extends TechnicalElement<TechnicalElementTypes.DATA_ANALYSIS> {
    /**
     * Array of data analysis parameters that are part of this analysis.
     * Each parameter represents a specific data point or measurement being analyzed.
     */
    data_parameters: DataAnalysisParameter[];
}

/**
 * JSON schema for validating {@link DataAnalysis} entities.
 *
 * @example
 * ```typescript
 * const isValid = DataAnalysisSchema.validate(someData);
 * ```
 */
export const DataAnalysisSchema = typia.json.application<[DataAnalysis], "3.0">();