import { QuantificationInput } from "./scram-quantification-input";
import {
  SystemsAnalysis,
  EventSequenceAnalysis,
  InitiatingEventsAnalysis,
  FaultTree,
  Gate,
  Component,
  EventTree,
  FunctionalEvent,
  Sequence,
  CCFGroup,
  asSystemsAnalysis,
  asEventSequenceAnalysis,
  asInitiatingEventsAnalysis,
  safeGet,
} from "./quantification-adapter-types";
import { SystemsAnalysis as CoreSystemsAnalysis } from "../../systems-analysis/systems-analysis";
import { EventSequenceAnalysis as CoreEventSequenceAnalysis } from "../../event-sequence-analysis/event-sequence-analysis";
import { InitiatingEventsAnalysis as CoreInitiatingEventsAnalysis } from "../../initiating-event-analysis/initiating-event-analysis";

export interface QuantificationAdapterOptions {
  includeEventTrees?: boolean;
  includeFaultTrees?: boolean;
  includeCCFGroups?: boolean;
  errorHandling?: "fail" | "warn" | "ignore";
  validateOutput?: boolean;
}
const DEFAULT_ADAPTER_OPTIONS: QuantificationAdapterOptions = {
  includeEventTrees: true,
  includeFaultTrees: true,
  includeCCFGroups: true,
  errorHandling: "warn",
  validateOutput: true,
};
export interface ConversionResult {
  quantificationInput: QuantificationInput;
  warnings: string[];
  idMapping: Record<string, string>;
}

type AttributeValue = string | number | boolean;

interface ConvertedAttribute {
  name: string;
  value: AttributeValue;
}

interface ConvertedExpression {
  distribution?: string;
  parameters?: Record<string, number>;
  value?: number | null;
  parameter?: string | null;
  formula?: string | null;
}

interface ConvertedBasicEvent {
  name: string;
  label?: string;
  role?: "public" | "private";
  expression?: ConvertedExpression | { value: number };
  unit?: string;
  attributes?: ConvertedAttribute[];
}

interface ConvertedParameter {
  name: string;
  label?: string;
  expression: { value: number };
  unit?: string;
}

interface ConvertedGateFormula {
  and?: Array<{ name: string }>;
  or?: Array<{ name: string }>;
  not?: { name: string };
  xor?: [{ name: string }, { name: string }];
  atleast?: {
    min: number;
    arguments: Array<{ name: string }>;
  };
}

interface ConvertedGate {
  name: string;
  label?: string;
  formula: ConvertedGateFormula;
}

interface ConvertedComponent {
  name: string;
  label?: string;
  attributes?: ConvertedAttribute[];
}

interface ConvertedFaultTree {
  name: string;
  label?: string;
  events: ConvertedGate[];
  components?: ConvertedComponent[];
}

interface ConvertedFunctionalEvent {
  name: string;
  label?: string;
}

interface ConvertedSequence {
  name: string;
  label?: string;
}

interface ConvertedEventTree {
  name: string;
  label?: string;
  functionalEvents: ConvertedFunctionalEvent[];
  sequences: ConvertedSequence[];
  initialState: { branch: { instructions: never[] } };
}

interface ConvertedCCFFactor {
  level: number;
  expression: { value: number };
}

interface ConvertedCCFDistribution {
  expression: ConvertedExpression | { value: number };
}

interface ConvertedCCFGroup {
  name: string;
  label?: string;
  model: "beta-factor" | "MGL" | "alpha-factor" | "phi-factor";
  members: { basicEvents: Array<{ name: string }> };
  distribution: ConvertedCCFDistribution;
  factors: { factor: ConvertedCCFFactor[] };
  attributes?: ConvertedAttribute[];
}

export class QuantificationAdapter {
  public static convertToQuantificationInput(
    originalSystemsAnalysis: CoreSystemsAnalysis,
    originalEventSequenceAnalysis: CoreEventSequenceAnalysis,
    originalInitiatingEventAnalysis?: CoreInitiatingEventsAnalysis,
    options: Partial<QuantificationAdapterOptions> = {},
  ): ConversionResult {
    const systemsAnalysis = asSystemsAnalysis(originalSystemsAnalysis);
    const eventSequenceAnalysis = asEventSequenceAnalysis(originalEventSequenceAnalysis);
    const initiatingEventAnalysis =
      originalInitiatingEventAnalysis ? asInitiatingEventsAnalysis(originalInitiatingEventAnalysis) : undefined;
    const mergedOptions: QuantificationAdapterOptions = {
      ...DEFAULT_ADAPTER_OPTIONS,
      ...options,
    };
    const warnings: string[] = [];
    const idMapping: Record<string, string> = {};
    try {
      const quantificationInput = {
        name: safeGet(systemsAnalysis, "id", "") || safeGet(eventSequenceAnalysis, "id", ""),
        label: safeGet(systemsAnalysis, "name", "") || safeGet(eventSequenceAnalysis, "name", ""),
        modelData: {
          basicEvents: this.convertBasicEvents(systemsAnalysis, warnings, idMapping),
          houseEvents: this.convertHouseEvents(systemsAnalysis, warnings, idMapping),
          parameters: this.convertParameters(systemsAnalysis, warnings, idMapping),
        },
      } as unknown as QuantificationInput;
      if (mergedOptions.includeFaultTrees) {
        (quantificationInput as Record<string, unknown>)["faultTrees"] = this.convertFaultTrees(
          systemsAnalysis,
          warnings,
          idMapping,
        );
      }
      if (mergedOptions.includeEventTrees) {
        (quantificationInput as Record<string, unknown>)["eventTrees"] = this.convertEventTrees(
          eventSequenceAnalysis,
          warnings,
          idMapping,
        );
      }
      if (mergedOptions.includeCCFGroups) {
        (quantificationInput as Record<string, unknown>)["ccfGroups"] = this.convertCCFGroups(
          systemsAnalysis,
          warnings,
          idMapping,
        );
      }
      if (mergedOptions.validateOutput) {
        this.validateQuantificationInput(quantificationInput, warnings);
      }
      void initiatingEventAnalysis;
      return {
        quantificationInput,
        warnings,
        idMapping,
      };
    } catch (error) {
      const errorMessage = `Error during conversion: ${error instanceof Error ? error.message : String(error)}`;
      if (mergedOptions.errorHandling === "fail") {
        throw new Error(errorMessage);
      }
      warnings.push(errorMessage);
      return {
        quantificationInput: {
          name: "ERROR_PARTIAL_CONVERSION",
          label: "Error occurred during conversion",
          attributes: [
            {
              name: "conversion_error",
              value: errorMessage,
            },
          ],
        } as unknown as QuantificationInput,
        warnings,
        idMapping,
      };
    }
  }
  private static convertBasicEvents(
    systemsAnalysis: SystemsAnalysis,
    warnings: string[],
    idMapping: Record<string, string>,
  ): ConvertedBasicEvent[] {
    const basicEvents: ConvertedBasicEvent[] = [];
    try {
      const basicEventsRecord = safeGet(systemsAnalysis, "systemBasicEvents", {});
      Object.values(basicEventsRecord).forEach((basicEvent) => {
        const convertedEvent: ConvertedBasicEvent = {
          name: safeGet(basicEvent, "id", "UNKNOWN_ID"),
          label: safeGet(basicEvent, "name", "") || safeGet(basicEvent, "description", ""),
          role: safeGet<"public" | "private">(basicEvent, "role", "public"),
        };
        const probabilityModel = safeGet<Record<string, unknown> | null>(basicEvent, "probabilityModel", null);
        if (probabilityModel) {
          convertedEvent.expression = {
            distribution: safeGet<string>(probabilityModel, "distribution", "point_estimate"),
            parameters: safeGet<Record<string, number>>(probabilityModel, "parameters", {}),
          };
        } else if (safeGet<unknown>(basicEvent, "expression", null)) {
          const expression = safeGet<Record<string, unknown>>(basicEvent, "expression", {});
          convertedEvent.expression = {
            value: safeGet<number | null>(expression, "value", null),
            parameter: safeGet<string | null>(expression, "parameter", null),
            formula: safeGet<string | null>(expression, "formula", null),
          };
        } else if (safeGet<number | undefined>(basicEvent, "probability", undefined) !== undefined) {
          convertedEvent.expression = {
            value: safeGet<number>(basicEvent, "probability", 0),
          };
        }
        const unit = safeGet<string | null>(basicEvent, "unit", null);
        if (unit) {
          convertedEvent.unit = this.mapUnit(unit);
        }
        const dataAnalysisRef = safeGet<string | null>(basicEvent, "dataAnalysisBasicEventRef", null);
        if (dataAnalysisRef) {
          convertedEvent.attributes = convertedEvent.attributes ?? [];
          convertedEvent.attributes.push({
            name: "data_analysis_ref",
            value: dataAnalysisRef,
          });
        }
        const attributes = safeGet<Array<{ name: string; value: string | number | boolean }>>(
          basicEvent,
          "attributes",
          [],
        );
        if (attributes.length > 0) {
          convertedEvent.attributes = convertedEvent.attributes ?? [];
          attributes.forEach((attr) => {
            convertedEvent.attributes!.push({
              name: safeGet<string>(attr, "name", "unknown"),
              value: String(safeGet<string | number | boolean>(attr, "value", "")),
            });
          });
        }
        const id = safeGet<string>(basicEvent, "id", "");
        if (id) {
          idMapping[id] = id;
        }
        basicEvents.push(convertedEvent);
      });
      return basicEvents;
    } catch (error) {
      warnings.push(`Error converting basic events: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  private static convertHouseEvents(
    _systemsAnalysis: SystemsAnalysis,
    warnings: string[],
    _idMapping: Record<string, string>,
  ): never[] {
    try {
      return [];
    } catch (error) {
      warnings.push(`Error converting house events: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  private static convertParameters(
    systemsAnalysis: SystemsAnalysis,
    warnings: string[],
    idMapping: Record<string, string>,
  ): ConvertedParameter[] {
    const parameters: ConvertedParameter[] = [];
    try {
      const parametersRecord = safeGet(systemsAnalysis, "parameters", {});
      Object.values(parametersRecord).forEach((param) => {
        const rawValue = safeGet<number | string | null>(param, "value", null);
        const convertedParam: ConvertedParameter = {
          name: safeGet<string>(param, "id", "UNKNOWN_ID"),
          label: safeGet<string>(param, "name", "") || safeGet<string>(param, "description", ""),
          expression: {
            value: typeof rawValue === "number" ? rawValue : 0,
          },
        };
        const unit = safeGet<string | null>(param, "unit", null);
        if (unit) {
          convertedParam.unit = this.mapUnit(unit);
        }
        const id = safeGet<string>(param, "id", "");
        if (id) {
          idMapping[id] = id;
        }
        parameters.push(convertedParam);
      });
      return parameters;
    } catch (error) {
      warnings.push(`Error converting parameters: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  private static convertFaultTrees(
    systemsAnalysis: SystemsAnalysis,
    warnings: string[],
    idMapping: Record<string, string>,
  ): ConvertedFaultTree[] {
    const faultTrees: ConvertedFaultTree[] = [];
    try {
      const faultTreesRecord = safeGet(systemsAnalysis, "faultTrees", {});
      Object.values(faultTreesRecord).forEach((faultTree) => {
        const convertedTree: ConvertedFaultTree = {
          name: safeGet<string>(faultTree, "id", "UNKNOWN_ID"),
          label: safeGet<string>(faultTree, "name", ""),
          events: this.convertGates(faultTree, warnings, idMapping),
        };
        const components = safeGet<Component[]>(faultTree, "components", []);
        if (components.length > 0) {
          convertedTree.components = components.map((comp) => this.convertComponent(comp, warnings, idMapping));
        }
        faultTrees.push(convertedTree);
      });
      return faultTrees;
    } catch (error) {
      warnings.push(`Error converting fault trees: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  private static convertGates(
    faultTree: FaultTree,
    warnings: string[],
    idMapping: Record<string, string>,
  ): ConvertedGate[] {
    const gates: ConvertedGate[] = [];
    try {
      const gatesRecord = safeGet(faultTree, "gates", {});
      Object.values(gatesRecord).forEach((gate) => {
        const convertedGate: ConvertedGate = {
          name: safeGet<string>(gate, "id", "UNKNOWN_ID"),
          label: safeGet<string>(gate, "name", "") || safeGet<string>(gate, "description", ""),
          formula: this.convertFormula(gate, warnings, idMapping),
        };
        gates.push(convertedGate);
      });
      return gates;
    } catch (error) {
      warnings.push(`Error converting gates: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  private static convertComponent(
    component: Component,
    warnings: string[],
    _idMapping: Record<string, string>,
  ): ConvertedComponent {
    try {
      const convertedComponent: ConvertedComponent = {
        name: safeGet<string>(component, "id", "UNKNOWN_ID"),
        label: safeGet<string>(component, "name", "") || safeGet<string>(component, "description", ""),
      };
      const failureData = safeGet<Record<string, unknown> | null>(component, "failureData", null);
      if (failureData) {
        convertedComponent.attributes = convertedComponent.attributes ?? [];
        if (safeGet<number | null>(failureData, "failureRate", null) !== null) {
          convertedComponent.attributes.push({
            name: "failure_rate",
            value: String(safeGet<number>(failureData, "failureRate", 0)),
          });
        }
        if (safeGet<number | null>(failureData, "failureProbability", null) !== null) {
          convertedComponent.attributes.push({
            name: "failure_probability",
            value: String(safeGet<number>(failureData, "failureProbability", 0)),
          });
        }
        const timeUnit = safeGet<string | null>(failureData, "timeUnit", null);
        if (timeUnit) {
          convertedComponent.attributes.push({
            name: "time_unit",
            value: timeUnit,
          });
        }
        const ccfRef = safeGet<string | null>(failureData, "ccfGroupReference", null);
        if (ccfRef) {
          convertedComponent.attributes.push({
            name: "ccf_group_ref",
            value: ccfRef,
          });
        }
      }
      const quantAttributes = safeGet<Array<{ name: string; value: string | number | boolean }>>(
        component,
        "quantificationAttributes",
        [],
      );
      if (quantAttributes.length > 0) {
        convertedComponent.attributes = convertedComponent.attributes ?? [];
        quantAttributes.forEach((attr) => {
          convertedComponent.attributes!.push({
            name: safeGet<string>(attr, "name", ""),
            value: String(safeGet<string | number | boolean>(attr, "value", "")),
          });
        });
      }
      return convertedComponent;
    } catch (error) {
      warnings.push(`Error converting component: ${error instanceof Error ? error.message : String(error)}`);
      return {
        name: "ERROR_COMPONENT",
        label: "Error converting component",
      };
    }
  }
  private static convertFormula(
    gate: Gate,
    warnings: string[],
    _idMapping: Record<string, string>,
  ): ConvertedGateFormula {
    try {
      const gateType = safeGet<string>(gate, "type", "").toUpperCase();
      const inputs = safeGet<Array<{ id: string }>>(gate, "inputs", []);
      switch (gateType) {
        case "AND":
          return {
            and: inputs.map((input) => ({
              name: safeGet<string>(input, "id", "UNKNOWN_ID"),
            })),
          };
        case "OR":
          return {
            or: inputs.map((input) => ({
              name: safeGet<string>(input, "id", "UNKNOWN_ID"),
            })),
          };
        case "NOT":
          return {
            not: { name: safeGet<string>(inputs[0] ?? {}, "id", "UNKNOWN_ID") },
          };
        case "XOR":
          return {
            xor: [
              { name: safeGet<string>(inputs[0] ?? {}, "id", "UNKNOWN_ID") },
              { name: safeGet<string>(inputs[1] ?? {}, "id", "UNKNOWN_ID") },
            ],
          };
        case "ATLEAST":
          return {
            atleast: {
              min: safeGet<number>(gate, "k", 2),
              arguments: inputs.map((input) => ({
                name: safeGet<string>(input, "id", "UNKNOWN_ID"),
              })),
            },
          };
        default:
          warnings.push(`Unsupported gate type: ${gateType}`);
          return {
            and: [{ name: "UNSUPPORTED_GATE_TYPE" }],
          };
      }
    } catch (error) {
      warnings.push(`Error converting formula: ${error instanceof Error ? error.message : String(error)}`);
      return {
        and: [{ name: "ERROR_FORMULA" }],
      };
    }
  }
  private static convertEventTrees(
    eventSequenceAnalysis: EventSequenceAnalysis,
    warnings: string[],
    idMapping: Record<string, string>,
  ): ConvertedEventTree[] {
    const eventTrees: ConvertedEventTree[] = [];
    try {
      const eventTreesRecord = safeGet(eventSequenceAnalysis, "eventTrees", {});
      Object.values(eventTreesRecord).forEach((eventTree) => {
        eventTrees.push(this.convertEventTree(eventTree, warnings, idMapping));
      });
      return eventTrees;
    } catch (error) {
      warnings.push(`Error converting event trees: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  private static convertEventTree(
    eventTree: EventTree,
    warnings: string[],
    _idMapping: Record<string, string>,
  ): ConvertedEventTree {
    try {
      const functionalEventsRecord = safeGet<Record<string, FunctionalEvent>>(eventTree, "functionalEvents", {});
      const sequencesRecord = safeGet<Record<string, Sequence>>(eventTree, "sequences", {});
      return {
        name: safeGet<string>(eventTree, "id", "UNKNOWN_ID"),
        label: safeGet<string>(eventTree, "name", ""),
        functionalEvents: Object.values(functionalEventsRecord).map((fe) => ({
          name: safeGet<string>(fe, "id", "UNKNOWN_ID"),
          label: safeGet<string>(fe, "name", ""),
        })),
        sequences: Object.values(sequencesRecord).map((seq) => ({
          name: safeGet<string>(seq, "id", "UNKNOWN_ID"),
          label: safeGet<string>(seq, "name", ""),
        })),
        initialState: {
          branch: {
            instructions: [],
          },
        },
      };
    } catch (error) {
      warnings.push(`Error converting event tree: ${error instanceof Error ? error.message : String(error)}`);
      return {
        name: "ERROR_EVENT_TREE",
        label: "Error converting event tree",
        functionalEvents: [],
        sequences: [],
        initialState: {
          branch: {
            instructions: [],
          },
        },
      };
    }
  }
  private static convertCCFGroups(
    systemsAnalysis: SystemsAnalysis,
    warnings: string[],
    idMapping: Record<string, string>,
  ): ConvertedCCFGroup[] {
    const ccfGroups: ConvertedCCFGroup[] = [];
    try {
      const ccfGroupsRecord = safeGet(systemsAnalysis, "commonCauseFailureGroups", {});
      Object.values(ccfGroupsRecord).forEach((ccfGroup) => {
        const ccfModelType =
          safeGet<string | null>(ccfGroup, "modelType", null) ?? safeGet<string>(ccfGroup, "model", "");
        const predefinedMembers = safeGet<Record<string, unknown> | null>(ccfGroup, "members", null);
        const affectedComponents = safeGet<string[]>(ccfGroup, "affectedComponents", []);
        const members =
          predefinedMembers && safeGet<Array<{ id: string }> | null>(predefinedMembers, "basicEvents", null) ?
            {
              basicEvents: safeGet<Array<{ id: string }>>(predefinedMembers, "basicEvents", []).map((member) => ({
                name: safeGet<string>(member, "id", "UNKNOWN_ID"),
              })),
            }
          : {
              basicEvents: affectedComponents.map((compId) => ({
                name: compId,
              })),
            };
        const probabilityModel = safeGet<Record<string, unknown> | null>(ccfGroup, "probabilityModel", null);
        const distribution: ConvertedCCFDistribution =
          probabilityModel ?
            {
              expression: {
                distribution: safeGet<string>(probabilityModel, "distribution", "point_estimate"),
                parameters: safeGet<Record<string, number>>(probabilityModel, "parameters", {}),
              },
            }
          : {
              expression: {
                value: safeGet<number>(ccfGroup, "totalProbability", 0),
              },
            };
        const predefinedFactors = safeGet<Record<string, unknown> | null>(ccfGroup, "factors", null);
        const factors =
          predefinedFactors && safeGet<unknown>(predefinedFactors, "factor", null) ?
            (predefinedFactors as { factor: ConvertedCCFFactor[] })
          : {
              factor: this.extractCCFFactors(ccfGroup, warnings),
            };
        const convertedGroup: ConvertedCCFGroup = {
          name: safeGet<string>(ccfGroup, "id", "UNKNOWN_ID"),
          label: safeGet<string>(ccfGroup, "name", ""),
          model: this.mapCCFModelType(ccfModelType ?? "", warnings),
          members,
          distribution,
          factors,
        };
        const dataAnalysisRef = safeGet<string | null>(ccfGroup, "dataAnalysisCCFParameterRef", null);
        if (dataAnalysisRef) {
          convertedGroup.attributes = convertedGroup.attributes ?? [];
          convertedGroup.attributes.push({
            name: "data_analysis_ref",
            value: dataAnalysisRef,
          });
        }
        const id = safeGet<string>(ccfGroup, "id", "");
        if (id) {
          idMapping[id] = id;
        }
        ccfGroups.push(convertedGroup);
      });
      return ccfGroups;
    } catch (error) {
      warnings.push(`Error converting CCF groups: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  private static mapCCFModelType(
    modelType: string,
    warnings: string[] = [],
  ): "beta-factor" | "MGL" | "alpha-factor" | "phi-factor" {
    if (!modelType) {
      warnings.push("No CCF model type specified, defaulting to beta-factor");
      return "beta-factor";
    }
    const normalizedType = modelType.toUpperCase().replace(/[- _]/g, "");
    switch (normalizedType) {
      case "BETA":
      case "BETAFACTOR":
      case "BETA_FACTOR":
      case "BETAMETHOD":
        return "beta-factor";
      case "MGL":
      case "MULTIPLEGREEKLETTER":
      case "MULTIPLE_GREEK_LETTER":
        return "MGL";
      case "ALPHA":
      case "ALPHAFACTOR":
      case "ALPHA_FACTOR":
      case "ALPHAMETHOD":
        return "alpha-factor";
      case "PHI":
      case "PHIFACTOR":
      case "PHI_FACTOR":
      case "DIRECT":
      case "DIRECTPARAMETER":
        return "phi-factor";
      case "BFR":
      case "BINOMIAL":
      case "BINOMIALFAILURERATE":
        warnings.push("Binomial Failure Rate model mapped to alpha-factor (closest equivalent)");
        return "alpha-factor";
      case "CLM":
      case "COMMONLOAD":
        warnings.push("Common Load model mapped to beta-factor (closest equivalent)");
        return "beta-factor";
      default:
        warnings.push(`Unknown CCF model type "${modelType}" - defaulting to beta-factor`);
        return "beta-factor";
    }
  }
  private static extractCCFFactors(ccfGroup: CCFGroup, warnings: string[] = []): ConvertedCCFFactor[] {
    const factors: ConvertedCCFFactor[] = [];
    const modelType = safeGet<string>(ccfGroup, "modelType", "").toUpperCase();
    try {
      const modelSpecificParams = safeGet<Record<string, unknown> | null>(ccfGroup, "modelSpecificParameters", null);
      if (modelSpecificParams) {
        const betaParams = safeGet<Record<string, number> | null>(modelSpecificParams, "betaFactorParameters", null);
        const mglParams = safeGet<Record<string, unknown> | null>(modelSpecificParams, "mglParameters", null);
        const alphaParams = safeGet<Record<string, unknown> | null>(modelSpecificParams, "alphaFactorParameters", null);
        const phiParams = safeGet<Record<string, unknown> | null>(modelSpecificParams, "phiFactorParameters", null);
        if (modelType.includes("BETA") && betaParams) {
          const beta = safeGet<number>(betaParams, "beta", 0);
          factors.push({
            level: safeGet<string[]>(ccfGroup, "affectedComponents", []).length,
            expression: { value: beta },
          });
        } else if (modelType === "MGL" && mglParams) {
          const beta = safeGet<number>(mglParams, "beta", 0);
          const gamma = safeGet<number>(mglParams, "gamma", 0);
          const delta = safeGet<number>(mglParams, "delta", 0);
          const additionalFactors = safeGet<Record<string, number>>(mglParams, "additionalFactors", {});
          factors.push({ level: 2, expression: { value: beta } });
          if (gamma > 0) {
            factors.push({ level: 3, expression: { value: gamma } });
          }
          if (delta > 0) {
            factors.push({ level: 4, expression: { value: delta } });
          }
          Object.entries(additionalFactors).forEach(([key, value]) => {
            const level = parseInt(key, 10);
            if (!isNaN(level) && level > 4) {
              factors.push({ level, expression: { value } });
            }
          });
        } else if (modelType.includes("ALPHA") && alphaParams) {
          const alphaFactors = safeGet<Record<string, number>>(alphaParams, "alphaFactors", {});
          Object.entries(alphaFactors).forEach(([key, value]) => {
            const level = parseInt(key, 10);
            if (!isNaN(level)) {
              factors.push({ level, expression: { value } });
            }
          });
        } else if (modelType.includes("PHI") && phiParams) {
          const phiFactors = safeGet<Record<string, number>>(phiParams, "phiFactors", {});
          Object.entries(phiFactors).forEach(([key, value]) => {
            const level = parseInt(key, 10);
            if (!isNaN(level)) {
              factors.push({ level, expression: { value } });
            }
          });
        }
      }
      if (factors.length === 0) {
        const genericParams = safeGet<Record<string, number>>(ccfGroup, "modelParameters", {});
        Object.entries(genericParams).forEach(([key, value]) => {
          const levelMatch = key.match(/(\d+)/);
          const level = levelMatch ? parseInt(levelMatch[1], 10) : 0;
          if (level > 0) {
            factors.push({ level, expression: { value } });
          } else if (key.toLowerCase().includes("beta")) {
            factors.push({ level: 2, expression: { value } });
          } else if (key.toLowerCase().includes("gamma")) {
            factors.push({ level: 3, expression: { value } });
          } else if (key.toLowerCase().includes("delta")) {
            factors.push({ level: 4, expression: { value } });
          }
        });
      }
      factors.sort((a, b) => a.level - b.level);
      if (factors.length === 0) {
        warnings.push(`No factors could be extracted for CCF group ${safeGet<string>(ccfGroup, "id", "unknown")}`);
      }
      return factors;
    } catch (error) {
      warnings.push(`Error extracting CCF factors: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  private static mapUnit(
    unit: string,
  ): "bool" | "int" | "float" | "hours" | "hours-1" | "years" | "years-1" | "fit" | "demands" {
    switch (unit?.toLowerCase()) {
      case "boolean":
      case "bool":
        return "bool";
      case "integer":
      case "int":
        return "int";
      case "float":
      case "double":
      case "real":
        return "float";
      case "hour":
      case "hours":
        return "hours";
      case "per_hour":
      case "hours-1":
      case "1/hour":
      case "1/hours":
        return "hours-1";
      case "year":
      case "years":
        return "years";
      case "per_year":
      case "years-1":
      case "1/year":
      case "1/years":
        return "years-1";
      case "fit":
        return "fit";
      case "demand":
      case "demands":
        return "demands";
      default:
        return "float";
    }
  }
  private static validateQuantificationInput(quantificationInput: QuantificationInput, warnings: string[]): void {
    if (!quantificationInput.name) {
      warnings.push("Missing required field: name");
    }
    const qi = quantificationInput as unknown as {
      faultTrees?: Array<{ name: string; events?: unknown[] }>;
      eventTrees?: Array<{ name: string; functionalEvents?: unknown[]; sequences?: unknown[] }>;
      modelData?: { basicEvents?: unknown[] };
    };
    if (qi.faultTrees?.length && (!qi.modelData?.basicEvents || qi.modelData.basicEvents.length === 0)) {
      warnings.push("Fault trees defined but no basic events found");
    }
    if (qi.faultTrees?.length) {
      qi.faultTrees.forEach((ft) => {
        if (!ft.events || ft.events.length === 0) {
          warnings.push(`Fault tree ${ft.name} has no events defined`);
        }
      });
    }
    if (qi.eventTrees?.length) {
      qi.eventTrees.forEach((et) => {
        if (!et.functionalEvents || et.functionalEvents.length === 0) {
          warnings.push(`Event tree ${et.name} has no functional events defined`);
        }
        if (!et.sequences || et.sequences.length === 0) {
          warnings.push(`Event tree ${et.name} has no sequences defined`);
        }
      });
    }
  }
}
