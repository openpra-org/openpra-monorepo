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
 */
export interface BaseDataAnalysisParameter extends Unique, Named {
    description?: string;
    parameterType: ParameterType;
    uncertainty?: Uncertainty;
    /**
     * All data sources used in the analysis, including both general and specific sources
     */
    data_sources?: DataSource[];
    /**
     * All assumptions made in the analysis, including both general and specific assumptions
     */
    assumptions?: Assumption[];
}

/**
 * Data Analysis parameter
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
     */
    systemComponentId?: string;

    /**
     * Defines how the component can fail.
     */
    failure_mode?: FailureMode;

    /**
     * Defines the criteria for success.
     */
    success_criteria?: SuccessCriteria;

    /**
     * Represents the plant operating state for which the parameter applies.
     */
    plant_operating_state?: PlantOperatingStatesTable;

    /**
     * The probability model used to evaluate event probability.
     */
    probability_model?: DistributionType;

    /**
     * Alternative approaches or parameters that could be used.
     */
    alternatives?: string[];
}



// const dataAnalysis: DataAnalysis = {
//     *   uuid: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
//     *   name: "Pump Failure Rate",
//     *    basicEventId: "BE-123",
//     *   parameter: "failure rate", // DA-A4: IDENTIFY the parameter to be estimated
//     *   unit: "per hour",
//     *   value: 1.2e-5,
//     *   uncertainty: {
//     *       type: "lognormal",
//     *       median: 1.2e-5,
//      *      sigma: 0.5
//     *    },
//      *  componentType: "Pump", // HLR-DA-B: Grouping components into a homogeneous population
//      *  plantOperatingState: "At-Power", // HLR-DA-B: Grouping components into a homogeneous population
//      *  failureMode: "Failure to Start", // DA-A2: DEFINE failure modes
//      *  successCriteria: "Starts on Demand", // DA-A2: DEFINE success criteria
//      *  probabilityModel: "Exponential", // DA-A3: USE an appropriate probability model for each basic event.
//      *  dataRequired: "Number of Failures, Operating time", // DA-A4: IDENTIFY the data required for estimation
//     *  assumptions: "No maintenance during operation", // DA-A5: IDENTIFY the sources of model uncertainty, related assumptions
//     *  preOperationalAssumptions: "Based on similar plant data" // DA-A6: IDENTIFY assumptions made due to lack of as-built details
//     * };