/**
 * @module quantification_adapter
 * @description Adapter for converting OpenPRA models to third-party quantification input format
 *
 * This module provides adapters and utilities for converting OpenPRA technical elements
 * to the format expected by the third-party quantification engine. It maintains a clear
 * separation between OpenPRA's native schema and the third-party interface, enabling
 * quantification without modifying OpenPRA's core data structures.
 *
 * The adapter follows these principles:
 * 1. No modifications to OpenPRA's schema
 * 2. One-way conversion from OpenPRA to the quantification format
 * 3. Clean error handling for incompatible elements
 * 4. Support for partial model conversion when complete conversion isn't needed
 */

import { QuantificationInput } from './scram-quantification-input';

// Import type definitions from adapter-specific types file
import {
  SystemsAnalysis,
  EventSequenceAnalysis,
  InitiatingEventsAnalysis,
  asSystemsAnalysis,
  asEventSequenceAnalysis,
  asInitiatingEventsAnalysis,
  safeGet,
  asRecord,
} from './quantification-adapter-types';

/**
 * Configuration options for the quantification adapter
 * @group SCRAM Adapter
 */
export interface QuantificationAdapterOptions {
  /**
   * Whether to include event trees in the conversion
   * @default true
   */
  includeEventTrees?: boolean;

  /**
   * Whether to include fault trees in the conversion
   * @default true
   */
  includeFaultTrees?: boolean;

  /**
   * Whether to include CCF groups in the conversion
   * @default true
   */
  includeCCFGroups?: boolean;

  /**
   * How to handle errors during conversion
   * @default "warn"
   */
  errorHandling?: 'fail' | 'warn' | 'ignore';

  /**
   * Whether to validate the converted model before returning
   * @default true
   */
  validateOutput?: boolean;
}

/**
 * Default options for the quantification adapter
 * @group SCRAM Adapter
 */
const DEFAULT_ADAPTER_OPTIONS: QuantificationAdapterOptions = {
  includeEventTrees: true,
  includeFaultTrees: true,
  includeCCFGroups: true,
  errorHandling: 'warn',
  validateOutput: true,
};

/**
 * Result of a conversion operation, including the converted model and any warnings
 * @group SCRAM Adapter
 */
export interface ConversionResult {
  /**
   * The converted quantification input model
   */
  quantificationInput: QuantificationInput;

  /**
   * Any warnings generated during conversion
   */
  warnings: string[];

  /**
   * Mapping between OpenPRA IDs and quantification input IDs
   */
  idMapping: Record<string, string>;
}

/**
 * Adapter class for converting OpenPRA models to the quantification input format
 * @group SCRAM Adapter
 */
export class QuantificationAdapter {
  /**
   * Convert an OpenPRA model to the third-party QuantificationInput format
   *
   * @param originalSystemsAnalysis - The OpenPRA systems analysis model
   * @param originalEventSequenceAnalysis - The OpenPRA event sequence analysis model
   * @param originalInitiatingEventAnalysis - Optional initiating event analysis model
   * @param options - Configuration options for the conversion
   * @returns The conversion result with the converted model and any warnings
   */
  public static convertToQuantificationInput(
    originalSystemsAnalysis: any,
    originalEventSequenceAnalysis: any,
    originalInitiatingEventAnalysis?: any,
    options: Partial<QuantificationAdapterOptions> = {},
  ): ConversionResult {
    // Convert original objects to adapter-specific types
    const systemsAnalysis = asSystemsAnalysis(originalSystemsAnalysis);
    const eventSequenceAnalysis = asEventSequenceAnalysis(
      originalEventSequenceAnalysis,
    );
    const initiatingEventAnalysis = originalInitiatingEventAnalysis
      ? asInitiatingEventsAnalysis(originalInitiatingEventAnalysis)
      : undefined;

    // Merge options with defaults
    const mergedOptions: QuantificationAdapterOptions = {
      ...DEFAULT_ADAPTER_OPTIONS,
      ...options,
    };

    // Initialize warnings array and ID mapping
    const warnings: string[] = [];
    const idMapping: Record<string, string> = {};

    try {
      // Build the basic structure of the quantification input
      const quantificationInput: QuantificationInput = {
        name:
          safeGet(systemsAnalysis, 'id', '') ||
          safeGet(eventSequenceAnalysis, 'id', ''),
        label:
          safeGet(systemsAnalysis, 'name', '') ||
          safeGet(eventSequenceAnalysis, 'name', ''),

        // Add global model data (basic events, house events, parameters)
        modelData: {
          basicEvents: this.convertBasicEvents(
            systemsAnalysis,
            warnings,
            idMapping,
          ),
          houseEvents: this.convertHouseEvents(
            systemsAnalysis,
            warnings,
            idMapping,
          ),
          parameters: this.convertParameters(
            systemsAnalysis,
            warnings,
            idMapping,
          ),
        },
      };

      // Add fault trees if requested
      if (mergedOptions.includeFaultTrees) {
        quantificationInput.faultTrees = this.convertFaultTrees(
          systemsAnalysis,
          warnings,
          idMapping,
        );
      }

      // Add event trees if requested
      if (mergedOptions.includeEventTrees) {
        quantificationInput.eventTrees = this.convertEventTrees(
          eventSequenceAnalysis,
          warnings,
          idMapping,
        );
      }

      // Add CCF groups if requested
      if (mergedOptions.includeCCFGroups) {
        quantificationInput.ccfGroups = this.convertCCFGroups(
          systemsAnalysis,
          warnings,
          idMapping,
        );
      }

      // Validate the output if requested
      if (mergedOptions.validateOutput) {
        this.validateQuantificationInput(quantificationInput, warnings);
      }

      return {
        quantificationInput,
        warnings,
        idMapping,
      };
    } catch (error) {
      // Handle errors based on the error handling option
      const errorMessage = `Error during conversion: ${error instanceof Error ? error.message : String(error)}`;

      if (mergedOptions.errorHandling === 'fail') {
        throw new Error(errorMessage);
      }

      warnings.push(errorMessage);

      // Return a partial model if we can't complete the conversion
      return {
        quantificationInput: {
          name: 'ERROR_PARTIAL_CONVERSION',
          label: 'Error occurred during conversion',
          attributes: [
            {
              name: 'conversion_error',
              value: errorMessage,
            },
          ],
        },
        warnings,
        idMapping,
      };
    }
  }

  /**
   * Convert basic events from OpenPRA to the quantification input format
   * @group SCRAM Adapter
   */
  private static convertBasicEvents(
    systemsAnalysis: SystemsAnalysis,
    warnings: string[],
    idMapping: Record<string, string>,
  ): any[] {
    const basicEvents: any[] = [];

    try {
      // Extract basic events from systems analysis
      const basicEventsRecord = safeGet(
        systemsAnalysis,
        'systemBasicEvents',
        {},
      );

      Object.values(basicEventsRecord).forEach((basicEvent) => {
        // Map the basic event to the quantification input format
        const convertedEvent: any = {
          name: safeGet(basicEvent, 'id', 'UNKNOWN_ID'),
          label:
            safeGet(basicEvent, 'name', '') ||
            safeGet(basicEvent, 'description', ''),
          role: safeGet(basicEvent, 'role', 'public'),
        };

        // Check for probability model from Data Analysis first
        const probabilityModel = safeGet(basicEvent, 'probabilityModel', null);
        if (probabilityModel) {
          // Use probability model from Data Analysis
          convertedEvent.expression = {
            distribution: safeGet(
              probabilityModel,
              'distribution',
              'point_estimate',
            ),
            parameters: safeGet(probabilityModel, 'parameters', {}),
          };
        }
        // Then check for the expression field
        else if (safeGet(basicEvent, 'expression', null)) {
          const expression = safeGet(basicEvent, 'expression', {});
          convertedEvent.expression = {
            value: safeGet(expression, 'value', null),
            parameter: safeGet(expression, 'parameter', null),
            formula: safeGet(expression, 'formula', null),
          };
        }
        // Fall back to probability field
        else if (safeGet(basicEvent, 'probability', undefined) !== undefined) {
          convertedEvent.expression = {
            value: safeGet(basicEvent, 'probability', 0),
          };
        }

        // Add unit if available
        const unit = safeGet(basicEvent, 'unit', null);
        if (unit) {
          convertedEvent.unit = this.mapUnit(unit);
        }

        // Add reference to Data Analysis basic event if available
        const dataAnalysisRef = safeGet(
          basicEvent,
          'dataAnalysisBasicEventRef',
          null,
        );
        if (dataAnalysisRef) {
          convertedEvent.attributes = convertedEvent.attributes ?? [];
          convertedEvent.attributes.push({
            name: 'data_analysis_ref',
            value: dataAnalysisRef,
          });
        }

        // Add attributes if available
        const attributes = safeGet(basicEvent, 'attributes', []);
        if (attributes.length > 0) {
          convertedEvent.attributes = convertedEvent.attributes ?? [];
          attributes.forEach((attr) => {
            convertedEvent.attributes.push({
              name: safeGet(attr, 'name', 'unknown'),
              value: String(safeGet(attr, 'value', '')),
            });
          });
        }

        // Store ID mapping
        const id = safeGet(basicEvent, 'id', '');
        if (id) {
          idMapping[id] = id;
        }

        basicEvents.push(convertedEvent);
      });

      return basicEvents;
    } catch (error) {
      warnings.push(
        `Error converting basic events: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Convert house events from OpenPRA to the quantification input format
   * @group SCRAM Adapter
   */
  private static convertHouseEvents(
    systemsAnalysis: SystemsAnalysis,
    warnings: string[],
    idMapping: Record<string, string>,
  ): any[] {
    const houseEvents: any[] = [];

    try {
      // Extract house events from systems analysis
      // Note: OpenPRA might not have direct house events, so we need to extract them from the model
      // This is a simplified version - actual implementation would need to identify house events in the system

      return houseEvents;
    } catch (error) {
      warnings.push(
        `Error converting house events: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Convert parameters from OpenPRA to the quantification input format
   * @group SCRAM Adapter
   */
  private static convertParameters(
    systemsAnalysis: SystemsAnalysis,
    warnings: string[],
    idMapping: Record<string, string>,
  ): any[] {
    const parameters: any[] = [];

    try {
      // Extract parameters from systems analysis
      const parametersRecord = safeGet(systemsAnalysis, 'parameters', {});

      Object.values(parametersRecord).forEach((param) => {
        // Map the parameter to the quantification input format
        const convertedParam: any = {
          name: safeGet(param, 'id', 'UNKNOWN_ID'),
          label:
            safeGet(param, 'name', '') || safeGet(param, 'description', ''),
          // Convert the parameter value to an expression
          expression: {
            value:
              typeof safeGet(param, 'value', null) === 'number'
                ? safeGet(param, 'value', 0)
                : 0,
          },
        };

        // Add unit if available
        const unit = safeGet(param, 'unit', null);
        if (unit) {
          convertedParam.unit = this.mapUnit(unit);
        }

        // Store ID mapping
        const id = safeGet(param, 'id', '');
        if (id) {
          idMapping[id] = id;
        }

        parameters.push(convertedParam);
      });

      return parameters;
    } catch (error) {
      warnings.push(
        `Error converting parameters: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Convert fault trees from OpenPRA to the quantification input format
   */
  private static convertFaultTrees(
    systemsAnalysis: SystemsAnalysis,
    warnings: string[],
    idMapping: Record<string, string>,
  ): any[] {
    const faultTrees: any[] = [];

    try {
      // Extract fault trees from systems analysis
      const faultTreesRecord = safeGet(systemsAnalysis, 'faultTrees', {});

      Object.values(faultTreesRecord).forEach((faultTree) => {
        // Map the fault tree to the quantification input format
        const convertedTree: any = {
          name: safeGet(faultTree, 'id', 'UNKNOWN_ID'),
          label: safeGet(faultTree, 'name', ''),
          // Convert gates
          events: this.convertGates(faultTree, warnings, idMapping),
        };

        // Add components if available
        const components = safeGet(faultTree, 'components', []);
        if (components.length > 0) {
          convertedTree.components = components.map((comp) =>
            this.convertComponent(comp, warnings, idMapping),
          );
        }

        faultTrees.push(convertedTree);
      });

      return faultTrees;
    } catch (error) {
      warnings.push(
        `Error converting fault trees: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Convert gates from OpenPRA fault tree to the quantification input format
   * @group SCRAM Adapter
   */
  private static convertGates(
    faultTree: any,
    warnings: string[],
    idMapping: Record<string, string>,
  ): any[] {
    const gates: any[] = [];

    try {
      // Extract gates from fault tree
      const gatesRecord = safeGet(faultTree, 'gates', {});

      Object.values(gatesRecord).forEach((gate) => {
        // Map the gate to the quantification input format
        const convertedGate: any = {
          name: safeGet(gate, 'id', 'UNKNOWN_ID'),
          label: safeGet(gate, 'name', '') || safeGet(gate, 'description', ''),
          formula: this.convertFormula(gate, warnings, idMapping),
        };

        gates.push(convertedGate);
      });

      return gates;
    } catch (error) {
      warnings.push(
        `Error converting gates: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Convert a component from OpenPRA to the quantification input format
   */
  private static convertComponent(
    component: any,
    warnings: string[],
    idMapping: Record<string, string>,
  ): any {
    try {
      // Map the component to the quantification input format
      const convertedComponent: any = {
        name: safeGet(component, 'id', 'UNKNOWN_ID'),
        label:
          safeGet(component, 'name', '') ||
          safeGet(component, 'description', ''),
      };

      // Add failure data if available
      const failureData = safeGet(component, 'failureData', null);
      if (failureData) {
        convertedComponent.attributes = convertedComponent.attributes ?? [];

        // Add failure rate
        if (safeGet(failureData, 'failureRate', null) !== null) {
          convertedComponent.attributes.push({
            name: 'failure_rate',
            value: String(safeGet(failureData, 'failureRate', 0)),
          });
        }

        // Add failure probability
        if (safeGet(failureData, 'failureProbability', null) !== null) {
          convertedComponent.attributes.push({
            name: 'failure_probability',
            value: String(safeGet(failureData, 'failureProbability', 0)),
          });
        }

        // Add time unit
        if (safeGet(failureData, 'timeUnit', null)) {
          convertedComponent.attributes.push({
            name: 'time_unit',
            value: safeGet(failureData, 'timeUnit', ''),
          });
        }

        // Add CCF group reference
        if (safeGet(failureData, 'ccfGroupReference', null)) {
          convertedComponent.attributes.push({
            name: 'ccf_group_ref',
            value: safeGet(failureData, 'ccfGroupReference', ''),
          });
        }
      }

      // Add quantification attributes if available
      const quantAttributes = safeGet(
        component,
        'quantificationAttributes',
        [],
      );
      if (quantAttributes.length > 0) {
        convertedComponent.attributes = convertedComponent.attributes ?? [];
        quantAttributes.forEach((attr) => {
          convertedComponent.attributes.push({
            name: safeGet(attr, 'name', ''),
            value: String(safeGet(attr, 'value', '')),
          });
        });
      }

      return convertedComponent;
    } catch (error) {
      warnings.push(
        `Error converting component: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        name: 'ERROR_COMPONENT',
        label: 'Error converting component',
      };
    }
  }

  /**
   * Convert a formula from OpenPRA to the quantification input format
   */
  private static convertFormula(
    gate: any,
    warnings: string[],
    idMapping: Record<string, string>,
  ): any {
    try {
      // The logic depends on the gate type
      const gateType = safeGet(gate, 'type', '').toUpperCase();
      const inputs = safeGet(gate, 'inputs', []);

      switch (gateType) {
        case 'AND':
          return {
            and: inputs.map((input: any) => ({
              name: safeGet(input, 'id', 'UNKNOWN_ID'),
            })),
          };
        case 'OR':
          return {
            or: inputs.map((input: any) => ({
              name: safeGet(input, 'id', 'UNKNOWN_ID'),
            })),
          };
        case 'NOT':
          return {
            not: { name: safeGet(inputs[0], 'id', 'UNKNOWN_ID') },
          };
        case 'XOR':
          return {
            xor: [
              { name: safeGet(inputs[0], 'id', 'UNKNOWN_ID') },
              { name: safeGet(inputs[1], 'id', 'UNKNOWN_ID') },
            ],
          };
        case 'ATLEAST':
          return {
            atleast: {
              min: safeGet(gate, 'k', 2),
              arguments: inputs.map((input: any) => ({
                name: safeGet(input, 'id', 'UNKNOWN_ID'),
              })),
            },
          };
        default:
          warnings.push(`Unsupported gate type: ${gateType}`);
          return {
            and: [{ name: 'UNSUPPORTED_GATE_TYPE' }],
          };
      }
    } catch (error) {
      warnings.push(
        `Error converting formula: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        and: [{ name: 'ERROR_FORMULA' }],
      };
    }
  }

  /**
   * Convert event trees from OpenPRA to the quantification input format
   */
  private static convertEventTrees(
    eventSequenceAnalysis: EventSequenceAnalysis,
    warnings: string[],
    idMapping: Record<string, string>,
  ): any[] {
    const eventTrees: any[] = [];

    try {
      // Extract event trees from event sequence analysis
      const eventTreesRecord = safeGet(eventSequenceAnalysis, 'eventTrees', {});

      Object.values(eventTreesRecord).forEach((eventTree) => {
        // Convert the event tree to the quantification input format
        eventTrees.push(this.convertEventTree(eventTree, warnings, idMapping));
      });

      return eventTrees;
    } catch (error) {
      warnings.push(
        `Error converting event trees: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Convert a single event tree from OpenPRA to the quantification input format
   */
  private static convertEventTree(
    eventTree: any,
    warnings: string[],
    idMapping: Record<string, string>,
  ): any {
    try {
      // Map the event tree to the quantification input format
      const convertedTree: any = {
        name: safeGet(eventTree, 'id', 'UNKNOWN_ID'),
        label: safeGet(eventTree, 'name', ''),

        // Convert functional events
        functionalEvents: Object.values(
          safeGet(eventTree, 'functionalEvents', {}),
        ).map((fe: any) => ({
          name: safeGet(fe, 'id', 'UNKNOWN_ID'),
          label: safeGet(fe, 'name', ''),
        })),

        // Convert sequences
        sequences: Object.values(safeGet(eventTree, 'sequences', {})).map(
          (seq: any) => ({
            name: safeGet(seq, 'id', 'UNKNOWN_ID'),
            label: safeGet(seq, 'name', ''),
          }),
        ),

        // Convert initial state
        initialState: {
          branch: {
            // This is a simplified conversion - actual implementation would need to map the full tree structure
            instructions: [],
          },
        },
      };

      return convertedTree;
    } catch (error) {
      warnings.push(
        `Error converting event tree: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        name: 'ERROR_EVENT_TREE',
        label: 'Error converting event tree',
        initialState: {
          branch: {
            instructions: [],
          },
        },
      };
    }
  }

  /**
   * Convert CCF groups from OpenPRA to the quantification input format
   */
  private static convertCCFGroups(
    systemsAnalysis: SystemsAnalysis,
    warnings: string[],
    idMapping: Record<string, string>,
  ): any[] {
    const ccfGroups: any[] = [];

    try {
      // Extract CCF groups from systems analysis
      const ccfGroupsRecord = safeGet(
        systemsAnalysis,
        'commonCauseFailureGroups',
        {},
      );

      Object.values(ccfGroupsRecord).forEach((ccfGroup) => {
        // First, check if the CCF group uses modelType or model
        const ccfModelType =
          safeGet(ccfGroup, 'modelType', null) ??
          safeGet(ccfGroup, 'model', '');

        // Map the CCF group to the quantification input format
        const convertedGroup: any = {
          name: safeGet(ccfGroup, 'id', 'UNKNOWN_ID'),
          label: safeGet(ccfGroup, 'name', ''),
          model: this.mapCCFModelType(ccfModelType, warnings),
        };

        // Check for members first
        const predefinedMembers = safeGet(ccfGroup, 'members', null);
        const affectedComponents = safeGet(ccfGroup, 'affectedComponents', []);

        // Use predefined members if available, otherwise convert from affected components
        if (
          predefinedMembers &&
          safeGet(predefinedMembers, 'basicEvents', null)
        ) {
          convertedGroup.members = {
            basicEvents: safeGet(predefinedMembers, 'basicEvents', []).map(
              (member: any) => ({
                name: safeGet(member, 'id', 'UNKNOWN_ID'),
              }),
            ),
          };
        } else {
          convertedGroup.members = {
            basicEvents: affectedComponents.map((compId: string) => ({
              name: compId,
            })),
          };
        }

        // Check for probabilityModel from Data Analysis first
        const probabilityModel = safeGet(ccfGroup, 'probabilityModel', null);
        if (probabilityModel) {
          convertedGroup.distribution = {
            expression: {
              distribution: safeGet(
                probabilityModel,
                'distribution',
                'point_estimate',
              ),
              parameters: safeGet(probabilityModel, 'parameters', {}),
            },
          };
        } else {
          // Fall back to totalProbability
          convertedGroup.distribution = {
            expression: {
              value: safeGet(ccfGroup, 'totalProbability', 0),
            },
          };
        }

        // Check for predefined factors first
        const predefinedFactors = safeGet(ccfGroup, 'factors', null);
        if (predefinedFactors && safeGet(predefinedFactors, 'factor', null)) {
          convertedGroup.factors = predefinedFactors;
        } else {
          // Extract factors from model specific parameters
          convertedGroup.factors = {
            factor: this.extractCCFFactors(ccfGroup, warnings),
          };
        }

        // Add reference to Data Analysis CCF parameter if available
        const dataAnalysisRef = safeGet(
          ccfGroup,
          'dataAnalysisCCFParameterRef',
          null,
        );
        if (dataAnalysisRef) {
          convertedGroup.attributes = convertedGroup.attributes ?? [];
          convertedGroup.attributes.push({
            name: 'data_analysis_ref',
            value: dataAnalysisRef,
          });
        }

        ccfGroups.push(convertedGroup);
      });

      return ccfGroups;
    } catch (error) {
      warnings.push(
        `Error converting CCF groups: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Map OpenPRA CCF model type to the quantification input format.
   * This function handles the translation between OpenPRA's internal CCF model types
   * and the format expected by the quantification engine.
   *
   * @param modelType - The CCF model type from OpenPRA
   * @param warnings - Array to add warnings to if mapping issues occur
   * @returns The mapped CCF model type for the quantification engine
   */
  private static mapCCFModelType(
    modelType: string,
    warnings: string[] = [],
  ): 'beta-factor' | 'MGL' | 'alpha-factor' | 'phi-factor' {
    if (!modelType) {
      warnings.push('No CCF model type specified, defaulting to beta-factor');
      return 'beta-factor';
    }

    // Normalize the model type by removing spaces and converting to uppercase
    const normalizedType = modelType.toUpperCase().replace(/[- _]/g, '');

    switch (normalizedType) {
      // Beta Factor model variations
      case 'BETA':
      case 'BETAFACTOR':
      case 'BETA_FACTOR':
      case 'BETAMETHOD':
        return 'beta-factor';

      // Multiple Greek Letter model variations
      case 'MGL':
      case 'MULTIPLEGREEKLETTER':
      case 'MULTIPLE_GREEK_LETTER':
        return 'MGL';

      // Alpha Factor model variations
      case 'ALPHA':
      case 'ALPHAFACTOR':
      case 'ALPHA_FACTOR':
      case 'ALPHAMETHOD':
        return 'alpha-factor';

      // Phi Factor model variations (direct parameter specification)
      case 'PHI':
      case 'PHIFACTOR':
      case 'PHI_FACTOR':
      case 'DIRECT':
      case 'DIRECTPARAMETER':
        return 'phi-factor';

      // Binomial Failure Rate model - map to closest equivalent
      case 'BFR':
      case 'BINOMIAL':
      case 'BINOMIALFAILURERATE':
        warnings.push(
          'Binomial Failure Rate model mapped to alpha-factor (closest equivalent)',
        );
        return 'alpha-factor';

      // Common Load model - map to closest equivalent
      case 'CLM':
      case 'COMMONLOAD':
        warnings.push(
          'Common Load model mapped to beta-factor (closest equivalent)',
        );
        return 'beta-factor';

      // If unknown, default to beta-factor with a warning
      default:
        warnings.push(
          `Unknown CCF model type "${modelType}" - defaulting to beta-factor`,
        );
        return 'beta-factor';
    }
  }

  /**
   * Extract CCF model parameters based on the model type.
   * This function handles the extraction of parameters from the enhanced CCF group structure
   * and maps them to the format expected by the quantification engine.
   *
   * @param ccfGroup - The CCF group from OpenPRA
   * @param warnings - Array to add warnings to if mapping issues occur
   * @returns An array of factor objects for the quantification engine
   */
  private static extractCCFFactors(
    ccfGroup: any,
    warnings: string[] = [],
  ): { level: number; expression: { value: number } }[] {
    const factors: { level: number; expression: { value: number } }[] = [];
    const modelType = safeGet(ccfGroup, 'modelType', '').toUpperCase();

    try {
      // Check if the group has model-specific parameters structure
      const modelSpecificParams = safeGet(
        ccfGroup,
        'modelSpecificParameters',
        null,
      );

      if (modelSpecificParams) {
        // Beta Factor model
        if (
          modelType.includes('BETA') &&
          safeGet(modelSpecificParams, 'betaFactorParameters', null)
        ) {
          const betaParams = safeGet(
            modelSpecificParams,
            'betaFactorParameters',
            {},
          );
          const beta = safeGet(betaParams, 'beta', 0);

          // For beta factor model, we only need one factor for all failures
          factors.push({
            level: safeGet(ccfGroup, 'affectedComponents', []).length,
            expression: { value: beta },
          });
        }
        // Multiple Greek Letter model
        else if (
          modelType === 'MGL' &&
          safeGet(modelSpecificParams, 'mglParameters', null)
        ) {
          const mglParams = safeGet(modelSpecificParams, 'mglParameters', {});
          const beta = safeGet(mglParams, 'beta', 0);
          const gamma = safeGet(mglParams, 'gamma', 0);
          const delta = safeGet(mglParams, 'delta', 0);
          const additionalFactors = safeGet(mglParams, 'additionalFactors', {});

          // Add factors in order
          factors.push({ level: 2, expression: { value: beta } });

          if (gamma > 0) {
            factors.push({ level: 3, expression: { value: gamma } });
          }

          if (delta > 0) {
            factors.push({ level: 4, expression: { value: delta } });
          }

          // Add any additional factors
          Object.entries(additionalFactors).forEach(([key, value]) => {
            const level = parseInt(key, 10);
            if (!isNaN(level) && level > 4) {
              factors.push({ level, expression: { value: value as number } });
            }
          });
        }
        // Alpha Factor model
        else if (
          modelType.includes('ALPHA') &&
          safeGet(modelSpecificParams, 'alphaFactorParameters', null)
        ) {
          const alphaParams = safeGet(
            modelSpecificParams,
            'alphaFactorParameters',
            {},
          );
          const alphaFactors = safeGet(alphaParams, 'alphaFactors', {});

          // Add all alpha factors
          Object.entries(alphaFactors).forEach(([key, value]) => {
            const level = parseInt(key, 10);
            if (!isNaN(level)) {
              factors.push({ level, expression: { value: value as number } });
            }
          });
        }
        // Phi Factor model (direct parameter specification)
        else if (
          modelType.includes('PHI') &&
          safeGet(modelSpecificParams, 'phiFactorParameters', null)
        ) {
          const phiParams = safeGet(
            modelSpecificParams,
            'phiFactorParameters',
            {},
          );
          const phiFactors = safeGet(phiParams, 'phiFactors', {});

          // Add all phi factors
          Object.entries(phiFactors).forEach(([key, value]) => {
            const level = parseInt(key, 10);
            if (!isNaN(level)) {
              factors.push({ level, expression: { value: value as number } });
            }
          });
        }
      }

      // Fall back to generic modelParameters if model-specific ones aren't available
      if (factors.length === 0) {
        const genericParams = safeGet(ccfGroup, 'modelParameters', {});

        Object.entries(genericParams).forEach(([key, value]) => {
          // Try to extract level from parameter name
          const levelMatch = key.match(/(\d+)/);
          const level = levelMatch ? parseInt(levelMatch[1], 10) : 0;

          if (level > 0) {
            factors.push({ level, expression: { value: value as number } });
          } else if (key.toLowerCase().includes('beta')) {
            factors.push({ level: 2, expression: { value: value as number } });
          } else if (key.toLowerCase().includes('gamma')) {
            factors.push({ level: 3, expression: { value: value as number } });
          } else if (key.toLowerCase().includes('delta')) {
            factors.push({ level: 4, expression: { value: value as number } });
          }
        });
      }

      // Sort factors by level
      factors.sort((a, b) => a.level - b.level);

      // If no factors were extracted, add a warning
      if (factors.length === 0) {
        warnings.push(
          `No factors could be extracted for CCF group ${safeGet(ccfGroup, 'id', 'unknown')}`,
        );
      }

      return factors;
    } catch (error) {
      warnings.push(
        `Error extracting CCF factors: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Map OpenPRA unit to the quantification input format
   */
  private static mapUnit(
    unit: string,
  ):
    | 'bool'
    | 'int'
    | 'float'
    | 'hours'
    | 'hours-1'
    | 'years'
    | 'years-1'
    | 'fit'
    | 'demands' {
    switch (unit?.toLowerCase()) {
      case 'boolean':
      case 'bool':
        return 'bool';
      case 'integer':
      case 'int':
        return 'int';
      case 'float':
      case 'double':
      case 'real':
        return 'float';
      case 'hour':
      case 'hours':
        return 'hours';
      case 'per_hour':
      case 'hours-1':
      case '1/hour':
      case '1/hours':
        return 'hours-1';
      case 'year':
      case 'years':
        return 'years';
      case 'per_year':
      case 'years-1':
      case '1/year':
      case '1/years':
        return 'years-1';
      case 'fit':
        return 'fit';
      case 'demand':
      case 'demands':
        return 'demands';
      default:
        return 'float'; // Default to float if unknown
    }
  }

  /**
   * Validate the converted quantification input model
   * This is a simple validation - a full implementation would be more comprehensive
   */
  private static validateQuantificationInput(
    quantificationInput: QuantificationInput,
    warnings: string[],
  ): void {
    // Check required fields
    if (!quantificationInput.name) {
      warnings.push('Missing required field: name');
    }

    // Check for basic events if fault trees are defined
    if (
      quantificationInput.faultTrees?.length &&
      (!quantificationInput.modelData?.basicEvents ||
        quantificationInput.modelData.basicEvents.length === 0)
    ) {
      warnings.push('Fault trees defined but no basic events found');
    }

    // Check for fault tree gates
    if (quantificationInput.faultTrees?.length) {
      quantificationInput.faultTrees.forEach((ft) => {
        if (!ft.events || ft.events.length === 0) {
          warnings.push(`Fault tree ${ft.name} has no events defined`);
        }
      });
    }

    // Check for event tree elements
    if (quantificationInput.eventTrees?.length) {
      quantificationInput.eventTrees.forEach((et) => {
        if (!et.functionalEvents || et.functionalEvents.length === 0) {
          warnings.push(
            `Event tree ${et.name} has no functional events defined`,
          );
        }
        if (!et.sequences || et.sequences.length === 0) {
          warnings.push(`Event tree ${et.name} has no sequences defined`);
        }
      });
    }
  }
}
