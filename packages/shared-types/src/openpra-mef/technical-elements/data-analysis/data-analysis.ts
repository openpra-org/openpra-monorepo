    import typia, { tags } from "typia";
    import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
    import { Named, Unique } from "../core/meta";
    import { BasicEvent} from "../core/events";
    import { SystemComponent, FailureMode, SuccessCriteria, UnavailabilityEvent, System } from "../systems-analysis/systems-analysis";
    import { PlantOperatingStatesTable, PlantOperatingState } from "../plant-operating-states-analysis/plant-operating-states-analysis";

    /**
     * @module DataAnalysis
     * @description The objectives of Data Analysis ensure that:
     * - (a) parameter boundaries are defined;
     * - (b) components are appropriately grouped;
     * - (c) parameter data are consistent with parameter definitions;
     * - (d) relevant generic industry and plant-specific evidence are represented in the parameter estimation, including addressing uncertainties;
     * - (e) the Data Analysis is documented to provide traceability of the work.
     * 
     * @preferred
     * @category Technical Elements
     */

    /**
     * @namespace Parameters
     * @description Types and interfaces for data analysis parameters
     */

    /**
     * Interface representing the types of parameters used in data analysis.
     * The parameter type determines the type of data analysis that can be performed.
     * The parameter type must be one of the types defined in `ParameterType` enum.
     * 
     * @memberof Parameters
     */
    export type ParameterType =
        | "FREQUENCY"
        | "PROBABILITY"
        | "UNAVAILABILITY"
        | "CCF_PARAMETER"
        | "HUMAN_ERROR_PROBABILITY"
        | "OTHER";

    /**
     * Base Data Analysis Parameter - parent of all data analysis parameters
     * 
     * This interface implements several PRA standard requirements:
     * - DA-A4: IDENTIFY the parameter to be estimated
     * - DA-A5: IDENTIFY the sources of model uncertainty, related assumptions
     * - DA-A6: IDENTIFY assumptions made due to lack of as-built details
     * 
     * @memberof Parameters
     * @extends {Unique}
     * @extends {Named}
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
     * Data Analysis parameter with specific requirements
     * 
     * This interface implements several PRA standard requirements:
     * - DA-A2: DEFINE failure modes and success criteria
     * - DA-A3: USE an appropriate probability model for each basic event
     * - HLR-DA-B: Grouping components into a homogeneous population
     * 
     * @memberof Parameters
     * @extends {BaseDataAnalysisParameter}
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
         * This can be either a reference to a specific plant operating state by ID,
         * or a complete plant operating states table.
         * 
         * When using a string, it should reference a PlantOperatingState.uuid.
         * When using a PlantOperatingStatesTable, it provides the complete set of
         * operating states that this parameter applies to.
         * 
         * The new PlantOperatingStatesTable structure includes:
         * - startUp: PlantOperatingState - Startup operating state
         * - controlledShutdown: PlantOperatingState - Controlled shutdown operating state
         * - fullPower: PlantOperatingState - Full power operating state
         * - Additional custom operating states as needed
         * 
         * Example using a string reference:
         * ```typescript
         * plant_operating_state: "pos-fullpower-e89b-12d3-a456-426614174000" // References a specific PlantOperatingState by UUID
         * ```
         * 
         * Example using the PlantOperatingStatesTable:
         * ```typescript
         * plant_operating_state: {
         *   fullPower: {
         *     uuid: "pos-fullpower-e89b-12d3-a456-426614174000",
         *     name: "Full Power Operation",
         *     // ... other required properties
         *   },
         *   // ... other operating states
         * }
         * ```
         * 
         * HLR-DA-B: Grouping components into a homogeneous population
         */
        plant_operating_state?: PlantOperatingStatesTable | string;

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
     * @namespace Probability
     * @description Probability and uncertainty modeling
     */

    /**
     * Enum representing the types of probability models used in data analysis.
     * @memberof Probability
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
        POINT_ESTIMATE = "point_estimate"
    }

    /**
     * Interface representing the uncertainty associated with a parameter.
     * The structure of the uncertainty changes based on the distribution type.
     *
     * This interface implements several PRA standard requirements:
     * - **HLR-DA-D**: The parameter estimates shall be based on relevant generic industry and technology- and plant-specific evidence.
     * - **DA-A3**: USE an appropriate probability model for each basic event.
     * - **DA-A5**: IDENTIFY the sources of model uncertainty, the related assumptions, and reasonable alternatives
     * - **ESQ-E1**: ASSESS the effects on event sequence family frequencies of the model uncertainties and related assumptions
     * - **RI-C1**: COMPILE a list of key sources of model uncertainty and related assumptions
     *
     * @memberof Probability
     * @example
     * ```typescript
     * const emergencyDieselGeneratorFailureUncertainty: Uncertainty = {
     *   distribution: DistributionType.LOGNORMAL,
     *   parameters: {
     *     mean: 1.2e-3,
     *     errorFactor: 3
     *   },
     *   model_uncertainty_sources: [
     *     "Limited operational data",
     *     "Environmental factors not fully characterized"
     *   ],
     *   riskImplications: {
     *     affectedMetrics: ["CDF", "LERF"],
     *     significanceLevel: "high",
     *     propagationNotes: "Major impact on SBO sequences"
     *   },
     *   correlations: [
     *     {
     *       parameterId: "DA-EDG-B-FR",
     *       correlationType: "common_cause",
     *       correlationFactor: 0.8
     *     }
     *   ],
     *   sensitivityStudies: [
     *     {
     *       description: "Impact of maintenance practices",
     *       variationRange: { min: 0.5, max: 2.0 },
     *       results: "Linear impact on CDF"
     *     }
     *   ]
     * };
     * ```
     */
    export interface Uncertainty {
        /**
         * The probability distribution type for the uncertainty.
         * DA-A3: USE an appropriate probability model for each basic event. [1, 2]
         */
        distribution: DistributionType;

        /**
         * Parameters associated with the distribution (e.g., mean, standard deviation).
         * DA-A4: IDENTIFY the parameter to be estimated and the data required for estimation [2, 3].
         */
        parameters: Record<string, number>;

        /**
         * Sources of uncertainty in the model (e.g., "Limited data", "Model assumptions").
         * DA-A5: IDENTIFY the sources of model uncertainty, related assumptions [2, 3].
         */
        model_uncertainty_sources?: string[];

        /**
         * Risk assessment implications of this uncertainty.
         * HLR-DA-D: Each parameter estimate shall be accompanied by a characterization of the uncertainty [4].
         */
        riskImplications?: {
            /**
             * References to risk metrics affected by this uncertainty (e.g., "CDF", "LERF").
             */
            affectedMetrics: string[];

            /**
             * Qualitative assessment of uncertainty significance ("high" | "medium" | "low").
             */
            significanceLevel: "high" | "medium" | "low";

            /**
             * Notes on how this uncertainty propagates through the risk model.
             */
            propagationNotes?: string;
        };

        /**
         * Correlations with other parameters. Captures dependencies between parameters.
         * ESQ-E1: ASSESS the effects on event sequence family frequencies of the model uncertainties and related assumptions [5].
         */
        correlations?: {
            /**
             * Reference to correlated parameter.
             */
            parameterId: string;

            /**
             * Type of correlation ("common_cause" | "environmental" | "operational" | "other").
             */
            correlationType: "common_cause" | "environmental" | "operational" | "other";

            /**
             * Correlation coefficient or factor.
             */
            correlationFactor: number;

            /**
             * Description of correlation basis.
             */
            description?: string;
        }[];

        /**
         * Results of sensitivity studies
         */
        sensitivityStudies?: {
            /**
             * Description of the sensitivity study.
             */
            description: string;

            /**
             * Range of parameter variation.
             */
            variationRange: {
                min: number;
                max: number;
            };

            /**
             * Qualitative or quantitative results.
             */
            results: string;
        }[];
    }

    /**
     * @namespace Sources
     * @description Data sources and assumptions
     */

    /**
     * Interface representing data sources and their context
     * @memberof Sources
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
     * @memberof Sources
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
     * The objectives of Data Analysis ensure that:
     * - (a) parameter boundaries are defined;
     * - (b) components are appropriately grouped;
     * - (c) parameter data are consistent with parameter definitions;
     * - (d) relevant generic industry and plant-specific evidence are represented in the parameter estimation, including addressing uncertainties;
     * - (e) the Data Analysis is documented to provide traceability of the work.
     * @packageDocumentation
     */

    /**
     * Interface representing an analysis of data parameters, which is a type of technical element.
     * 
     * @memberof DataAnalysis
     * @extends {TechnicalElement<TechnicalElementTypes.DATA_ANALYSIS>}
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
     *       // Operating Context - Using the new PlantOperatingStatesTable structure
     *       plant_operating_state: {
     *         startUp: {
     *           uuid: "pos-startup-e89b-12d3-a456-426614174000",
     *           name: "Plant Startup",
     *           description: "Reactor startup from subcritical to low power",
     *           timeBoundary: {
     *             startingCondition: "Begin control rod withdrawal for startup",
     *             endingCondition: "Main generator synchronized to grid"
     *           },
     *           radioactiveMaterialSources: ["Reactor Core"],
     *           operatingMode: "Startup",
     *           rcbConfiguration: "Intact",
     *           rcsParameters: {
     *             powerLevel: [0, 0.05],
     *             decayHeatLevel: [0.01, 0.02],
     *             reactorCoolantTemperatureAtControlVolume1: [150, 350],
     *             coolantPressureAtControlVolume1: [0.1, 15.5]
     *           },
     *           decayHeatRemoval: {
     *             primaryCoolingSystems: { "RHR-Loop-A": "YES" },
     *             secondaryCoolingSystems: { "Auxiliary-Feedwater": "YES" }
     *           },
     *           availableInstrumentation: ["Neutron-Flux-Monitoring"],
     *           radionuclideTransportBarrier: {
     *             barrier1: "INTACT",
     *             barrier2: "INTACT"
     *           },
     *           initiatingEvents: [],
     *           safetyFunctions: [],
     *           meanDuration: 24
     *         },
     *         fullPower: {
     *           uuid: "pos-fullpower-e89b-12d3-a456-426614174000",
     *           name: "Full Power Operation",
     *           description: "Normal operation at 100% power with all systems available",
     *           timeBoundary: {
     *             startingCondition: "Generator synchronization complete and power ascension to >95% complete",
     *             endingCondition: "Operator initiates power reduction for shutdown or reactor trip occurs"
     *           },
     *           radioactiveMaterialSources: ["Reactor Core", "Primary Coolant"],
     *           operatingMode: "Power Operation",
     *           rcbConfiguration: "Intact",
     *           rcsParameters: {
     *             powerLevel: [0.98, 1.0],
     *             decayHeatLevel: [0.06, 0.07],
     *             reactorCoolantTemperatureAtControlVolume1: [550, 558],
     *             coolantPressureAtControlVolume1: [2200, 2250]
     *           },
     *           decayHeatRemoval: {
     *             primaryCoolingSystems: { "Main-Feedwater": "YES" },
     *             secondaryCoolingSystems: { "Main-Condenser": "YES" }
     *           },
     *           availableInstrumentation: ["Neutron-Flux-Monitoring"],
     *           radionuclideTransportBarrier: {
     *             barrier1: "INTACT",
     *             barrier2: "INTACT"
     *           },
     *           initiatingEvents: [],
     *           safetyFunctions: [],
     *           meanDuration: 8000
     *         },
     *         controlledShutdown: {
     *           uuid: "pos-shutdown-e89b-12d3-a456-426614174000",
     *           name: "Controlled Shutdown",
     *           description: "Controlled shutdown from full power to hot standby",
     *           timeBoundary: {
     *             startingCondition: "Operator initiates power reduction for shutdown",
     *             endingCondition: "Reactor subcritical and in hot standby condition"
     *           },
     *           radioactiveMaterialSources: ["Reactor Core"],
     *           operatingMode: "Hot Standby",
     *           rcbConfiguration: "Intact",
     *           rcsParameters: {
     *             powerLevel: [0, 0.05],
     *             decayHeatLevel: [0.05, 0.06],
     *             reactorCoolantTemperatureAtControlVolume1: [350, 550],
     *             coolantPressureAtControlVolume1: [1500, 2200]
     *           },
     *           decayHeatRemoval: {
     *             primaryCoolingSystems: { "RHR-Loop-A": "YES" },
     *             secondaryCoolingSystems: { "Auxiliary-Feedwater": "YES" }
     *           },
     *           availableInstrumentation: ["Neutron-Flux-Monitoring"],
     *           radionuclideTransportBarrier: {
     *             barrier1: "INTACT",
     *             barrier2: "INTACT"
     *           },
     *           initiatingEvents: [],
     *           safetyFunctions: [],
     *           meanDuration: 12
     *         }
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
     * @memberof DataAnalysis
     * @example
     * ```typescript
     * const isValid = DataAnalysisSchema.validate(someData);
     * ```
     */
    export const DataAnalysisSchema = typia.json.application<[DataAnalysis], "3.0">();