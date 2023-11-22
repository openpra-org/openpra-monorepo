import { LabelJSON } from "../types/Label";
import NestedModel, {
  NestedModelJSON,
} from "../types/modelTypes/innerModels/nestedModel";
import AuthService from "./AuthService";
import TypedModelApiManager from "./TypedModelApiManager";

//used constants
const API_ENDPOINT = "/api";
const OPTION_CACHE = "no-cache"; // *default, no-cache, reload, force-cache, only-if-cached
const NESTED_ENDPOINT = `${API_ENDPOINT}/nested-models`;
const INITIATING_EVENTS_ENDPOINT = `${NESTED_ENDPOINT}/initiating-events`;
const EVENT_SEQUENCE_DIAGRAMS_ENDPOINT = `${NESTED_ENDPOINT}/event-sequence-diagrams`;
const EVENT_TREES_ENDPOINT = `${NESTED_ENDPOINT}/event-trees`;
const FUNCTIONAL_EVENTS_ENDPOINT = `${NESTED_ENDPOINT}/functional-events`;
const FAULT_TREES_ENDPOINT = `${NESTED_ENDPOINT}/fault-trees`;
const BAYESIAN_NETWORKS_ENDPOINT = `${NESTED_ENDPOINT}/bayesian-networks`;
const MARKOV_CHAINS_ENDPOINT = `${NESTED_ENDPOINT}/markov-chains`;
const BAYESIAN_ESTIMATION_ENDPOINT = `${NESTED_ENDPOINT}/bayesian-estimations`;
const WEIBULL_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/weibull-analysis`;
const RISK_INTEGRATION_ENDPOINT = `${NESTED_ENDPOINT}/risk-integration`;
const RADIOLOGICAL_CONSEQUENCE_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/radiological-consequence-analysis`;
const MECHANISTIC_SOURCE_TERM_ENDPOINT = `${NESTED_ENDPOINT}/mechanistic-source-term`;
const EVENT_SEQUENCE_QUANTIFICATION_DIAGRAM_ENDPOINT = `${NESTED_ENDPOINT}/event-sequence-quantification-diagram`;
const DATA_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/data-analysis`;
const HUMAN_RELIABILITY_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/human-reliability-analysis`;
const SYSTEMS_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/systems-analysis`;
const SUCCESS_CRITERIA_ENDPOINT = `${NESTED_ENDPOINT}/success-criteria`;
const EVENT_SEQUENCE_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/event-sequence-analysis`;
const OPERATING_STATE_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/operating-state-analysis`;
const NESTED_MODEL_TYPE_LOCATION = 3;
const NESTED_MODEL_ID_LOCATION = 4;

//Dont use 'this' keyword, dynamically passing functions hates it on the frontend
export default class NestedModelApiManager {
  static SNACKBAR_PROVIDER = null;

  static callSnackbar(status: any, res: any, override: any) {
    //TODO::
  }

  static defaultSuccessCallback(res: any, override: any) {
    try {
      const { showSuccess } = override;
      if (showSuccess) {
        this.callSnackbar("success", res, override);
      }
    } catch {}
    return res;
  }

  static defaultFailCallback(res: any, override: any) {
    try {
      const { showFailure } = override;
      if (showFailure) {
        this.callSnackbar("error", res, override);
      }
    } catch {}
    return res;
  }

  //method to get past counter value

  static async getPreviousCounterValue(
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<number> {
    return await NestedModelApiManager.get(
      `${NESTED_ENDPOINT}`,
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  //post methods

  /**
   * posts the type of nested model, and adds its id to its parent
   * @param data a nestedmodelJSON containing a label and a parent id
   * @param override overrides the fucntion
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on failure
   * @returns a promise with the nested model, containing only those features
   */
  static async postInitiatingEvent(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    //makes child exist
    const returnResponse = await NestedModelApiManager.post(
      `${INITIATING_EVENTS_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "initiatingEvents",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    if (currentModelType === "internal-events")
      await TypedModelApiManager.addNestedToInternalEvent(body);
    if (currentModelType === "internal-hazards")
      await TypedModelApiManager.addNestedToInternalHazard(body);
    if (currentModelType === "external-hazards")
      await TypedModelApiManager.addNestedToExternalHazard(body);
    if (currentModelType === "full-scope")
      await TypedModelApiManager.addNestedToFullScope(body);
    return returnResponse;
  }

  /**
   * posts the type of nested model, and adds its id to its parent
   * @param data a nestedmodelJSON containing a label and a parent id
   * @param override overrides the fucntion
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on failure
   * @returns a promise with the nested model, containing only those features
   */
  static async postEventSequenceDiagram(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${EVENT_SEQUENCE_DIAGRAMS_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "eventSequenceDiagrams",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    if (currentModelType === "internal-events")
      await TypedModelApiManager.addNestedToInternalEvent(body);
    if (currentModelType === "internal-hazards")
      await TypedModelApiManager.addNestedToInternalHazard(body);
    if (currentModelType === "external-hazards")
      await TypedModelApiManager.addNestedToExternalHazard(body);
    if (currentModelType === "full-scope")
      await TypedModelApiManager.addNestedToFullScope(body);
    return returnResponse;
  }

  /**
   * posts the type of nested model, and adds its id to its parent
   * @param data a nestedmodelJSON containing a label and a parent id
   * @param override overrides the fucntion
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on failure
   * @returns a promise with the nested model, containing only those features
   */
  static async postEventTree(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${EVENT_TREES_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "eventTrees",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    if (currentModelType === "internal-events")
      await TypedModelApiManager.addNestedToInternalEvent(body);
    if (currentModelType === "internal-hazards")
      await TypedModelApiManager.addNestedToInternalHazard(body);
    if (currentModelType === "external-hazards")
      await TypedModelApiManager.addNestedToExternalHazard(body);
    if (currentModelType === "full-scope")
      await TypedModelApiManager.addNestedToFullScope(body);
    return returnResponse;
  }

  /**
   * posts the type of nested model, and adds its id to its parent
   * @param data a nestedmodelJSON containing a label and a parent id
   * @param override overrides the fucntion
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on failure
   * @returns a promise with the nested model, containing only those features
   */
  static async postFunctionalEvent(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${FUNCTIONAL_EVENTS_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "functionalEvents",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    if (currentModelType === "internal-events")
      await TypedModelApiManager.addNestedToInternalEvent(body);
    if (currentModelType === "internal-hazards")
      await TypedModelApiManager.addNestedToInternalHazard(body);
    if (currentModelType === "external-hazards")
      await TypedModelApiManager.addNestedToExternalHazard(body);
    if (currentModelType === "full-scope")
      await TypedModelApiManager.addNestedToFullScope(body);
    return returnResponse;
  }

  /**
   * posts the type of nested model, and adds its id to its parent
   * @param data a nestedmodelJSON containing a label and a parent id
   * @param override overrides the fucntion
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on failure
   * @returns a promise with the nested model, containing only those features
   */
  static async postFaultTree(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${FAULT_TREES_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "faultTrees",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    if (currentModelType === "internal-events")
      await TypedModelApiManager.addNestedToInternalEvent(body);
    if (currentModelType === "internal-hazards")
      await TypedModelApiManager.addNestedToInternalHazard(body);
    if (currentModelType === "external-hazards")
      await TypedModelApiManager.addNestedToExternalHazard(body);
    if (currentModelType === "full-scope")
      await TypedModelApiManager.addNestedToFullScope(body);
    return returnResponse;
  }

  /**
   * posts the type of nested model, and adds its id to its parent
   * @param data a nestedmodelJSON containing a label and a parent id
   * @param override overrides the fucntion
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on failure
   * @returns a promise with the nested model, containing only those features
   */
  static async postBayesianNetwork(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${BAYESIAN_NETWORKS_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "bayesianNetworks",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    if (currentModelType === "internal-events")
      await TypedModelApiManager.addNestedToInternalEvent(body);
    if (currentModelType === "internal-hazards")
      await TypedModelApiManager.addNestedToInternalHazard(body);
    if (currentModelType === "external-hazards")
      await TypedModelApiManager.addNestedToExternalHazard(body);
    if (currentModelType === "full-scope")
      await TypedModelApiManager.addNestedToFullScope(body);
    return returnResponse;
  }

  /**
   * posts the type of nested model, and adds its id to its parent
   * @param data a nestedmodelJSON containing a label and a parent id
   * @param override overrides the fucntion
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on failure
   * @returns a promise with the nested model, containing only those features
   */
  static async postMarkovChain(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${MARKOV_CHAINS_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "markovChains",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    if (currentModelType === "internal-events")
      await TypedModelApiManager.addNestedToInternalEvent(body);
    if (currentModelType === "internal-hazards")
      await TypedModelApiManager.addNestedToInternalHazard(body);
    if (currentModelType === "external-hazards")
      await TypedModelApiManager.addNestedToExternalHazard(body);
    if (currentModelType === "full-scope")
      await TypedModelApiManager.addNestedToFullScope(body);
    return returnResponse;
  }

  /**
   * posts the type of nested model, and adds its id to its parent
   * @param data a nestedmodelJSON containing a label and a parent id
   * @param override overrides the fucntion
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on failure
   * @returns a promise with the nested model, containing only those features
   */
  static async postBayesianEstimation(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${BAYESIAN_ESTIMATION_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "bayesianEstimations",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    if (currentModelType === "internal-events")
      await TypedModelApiManager.addNestedToInternalEvent(body);
    if (currentModelType === "internal-hazards")
      await TypedModelApiManager.addNestedToInternalHazard(body);
    if (currentModelType === "external-hazards")
      await TypedModelApiManager.addNestedToExternalHazard(body);
    if (currentModelType === "full-scope")
      await TypedModelApiManager.addNestedToFullScope(body);
    return returnResponse;
  }

  /**
   * posts the type of nested model, and adds its id to its parent
   * @param data a nestedmodelJSON containing a label and a parent id
   * @param override overrides the fucntion
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on failure
   * @returns a promise with the nested model, containing only those features
   */
  static async postWeibullAnalysis(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${WEIBULL_ANALYSIS_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "weibullAnalysis",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    if (currentModelType === "internal-events")
      await TypedModelApiManager.addNestedToInternalEvent(body);
    if (currentModelType === "internal-hazards")
      await TypedModelApiManager.addNestedToInternalHazard(body);
    if (currentModelType === "external-hazards")
      await TypedModelApiManager.addNestedToExternalHazard(body);
    if (currentModelType === "full-scope")
      await TypedModelApiManager.addNestedToFullScope(body);
    return returnResponse;
  }

  // Risk Integration
  static async postRiskIntegration(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${RISK_INTEGRATION_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "riskIntegration",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Add the nested analysis to the appropriate parent type
    if (currentModelType === "internal-events") {
      await TypedModelApiManager.addNestedToInternalEvent(body);
    } else if (currentModelType === "internal-hazards") {
      await TypedModelApiManager.addNestedToInternalHazard(body);
    } else if (currentModelType === "external-hazards") {
      await TypedModelApiManager.addNestedToExternalHazard(body);
    } else if (currentModelType === "full-scope") {
      await TypedModelApiManager.addNestedToFullScope(body);
    }

    return returnResponse;
  }

  // Radiological Consequence Analysis
  static async postRadiologicalConsequenceAnalysis(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${RADIOLOGICAL_CONSEQUENCE_ANALYSIS_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "radiologicalConsequenceAnalysis",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Add the nested analysis to the appropriate parent type
    if (currentModelType === "internal-events") {
      await TypedModelApiManager.addNestedToInternalEvent(body);
    } else if (currentModelType === "internal-hazards") {
      await TypedModelApiManager.addNestedToInternalHazard(body);
    } else if (currentModelType === "external-hazards") {
      await TypedModelApiManager.addNestedToExternalHazard(body);
    } else if (currentModelType === "full-scope") {
      await TypedModelApiManager.addNestedToFullScope(body);
    }

    return returnResponse;
  }

  // Mechanistic Source Term
  static async postMechanisticSourceTerm(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${MECHANISTIC_SOURCE_TERM_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "mechanisticSourceTerm",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Add the nested analysis to the appropriate parent type
    if (currentModelType === "internal-events") {
      await TypedModelApiManager.addNestedToInternalEvent(body);
    } else if (currentModelType === "internal-hazards") {
      await TypedModelApiManager.addNestedToInternalHazard(body);
    } else if (currentModelType === "external-hazards") {
      await TypedModelApiManager.addNestedToExternalHazard(body);
    } else if (currentModelType === "full-scope") {
      await TypedModelApiManager.addNestedToFullScope(body);
    }

    return returnResponse;
  }

  // Event Sequence Quantification Diagram
  static async postEventSequenceQuantificationDiagram(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${EVENT_SEQUENCE_QUANTIFICATION_DIAGRAM_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "eventSequenceQuantificationDiagram",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Add the nested analysis to the appropriate parent type
    if (currentModelType === "internal-events") {
      await TypedModelApiManager.addNestedToInternalEvent(body);
    } else if (currentModelType === "internal-hazards") {
      await TypedModelApiManager.addNestedToInternalHazard(body);
    } else if (currentModelType === "external-hazards") {
      await TypedModelApiManager.addNestedToExternalHazard(body);
    } else if (currentModelType === "full-scope") {
      await TypedModelApiManager.addNestedToFullScope(body);
    }

    return returnResponse;
  }

  // Data Analysis
  static async postDataAnalysis(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${DATA_ANALYSIS_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "dataAnalysis",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Add the nested analysis to the appropriate parent type
    if (currentModelType === "internal-events") {
      await TypedModelApiManager.addNestedToInternalEvent(body);
    } else if (currentModelType === "internal-hazards") {
      await TypedModelApiManager.addNestedToInternalHazard(body);
    } else if (currentModelType === "external-hazards") {
      await TypedModelApiManager.addNestedToExternalHazard(body);
    } else if (currentModelType === "full-scope") {
      await TypedModelApiManager.addNestedToFullScope(body);
    }

    return returnResponse;
  }

  // Human Reliability Analysis
  static async postHumanReliabilityAnalysis(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${HUMAN_RELIABILITY_ANALYSIS_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "humanReliabilityAnalysis",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Add the nested analysis to the appropriate parent type
    if (currentModelType === "internal-events") {
      await TypedModelApiManager.addNestedToInternalEvent(body);
    } else if (currentModelType === "internal-hazards") {
      await TypedModelApiManager.addNestedToInternalHazard(body);
    } else if (currentModelType === "external-hazards") {
      await TypedModelApiManager.addNestedToExternalHazard(body);
    } else if (currentModelType === "full-scope") {
      await TypedModelApiManager.addNestedToFullScope(body);
    }

    return returnResponse;
  }

  // Systems Analysis
  static async postSystemsAnalysis(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${SYSTEMS_ANALYSIS_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "systemsAnalysis",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Add the nested analysis to the appropriate parent type
    if (currentModelType === "internal-events") {
      await TypedModelApiManager.addNestedToInternalEvent(body);
    } else if (currentModelType === "internal-hazards") {
      await TypedModelApiManager.addNestedToInternalHazard(body);
    } else if (currentModelType === "external-hazards") {
      await TypedModelApiManager.addNestedToExternalHazard(body);
    } else if (currentModelType === "full-scope") {
      await TypedModelApiManager.addNestedToFullScope(body);
    }

    return returnResponse;
  }

  // Success Criteria
  static async postSuccessCriteria(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${SUCCESS_CRITERIA_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "successCriteria",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Add the nested analysis to the appropriate parent type
    if (currentModelType === "internal-events") {
      await TypedModelApiManager.addNestedToInternalEvent(body);
    } else if (currentModelType === "internal-hazards") {
      await TypedModelApiManager.addNestedToInternalHazard(body);
    } else if (currentModelType === "external-hazards") {
      await TypedModelApiManager.addNestedToExternalHazard(body);
    } else if (currentModelType === "full-scope") {
      await TypedModelApiManager.addNestedToFullScope(body);
    }

    return returnResponse;
  }

  // Event Sequence Analysis
  static async postEventSequenceAnalysis(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${EVENT_SEQUENCE_ANALYSIS_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "eventSequenceAnalysis",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Add the nested analysis to the appropriate parent type
    if (currentModelType === "internal-events") {
      await TypedModelApiManager.addNestedToInternalEvent(body);
    } else if (currentModelType === "internal-hazards") {
      await TypedModelApiManager.addNestedToInternalHazard(body);
    } else if (currentModelType === "external-hazards") {
      await TypedModelApiManager.addNestedToExternalHazard(body);
    } else if (currentModelType === "full-scope") {
      await TypedModelApiManager.addNestedToFullScope(body);
    }

    return returnResponse;
  }

  // Operating State Analysis
  static async postOperatingStateAnalysis(
    data: NestedModelJSON,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(
      `${OPERATING_STATE_ANALYSIS_ENDPOINT}/`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: "operatingStateAnalysis",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Add the nested analysis to the appropriate parent type
    if (currentModelType === "internal-events") {
      await TypedModelApiManager.addNestedToInternalEvent(body);
    } else if (currentModelType === "internal-hazards") {
      await TypedModelApiManager.addNestedToInternalHazard(body);
    } else if (currentModelType === "external-hazards") {
      await TypedModelApiManager.addNestedToExternalHazard(body);
    } else if (currentModelType === "full-scope") {
      await TypedModelApiManager.addNestedToFullScope(body);
    }

    return returnResponse;
  }

  /**
   * generic post for all the types of methods
   * @param url the url we are posting to
   * @param data the nested model we are using to post
   * @param override overrides the function
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the nested model promise after posting
   */
  static post(
    url: any,
    data: any,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ) {
    return fetch(url, {
      method: "POST",
      cache: OPTION_CACHE,
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
      body: data, // body data type must match "Content-Type" header
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res, override)
          : onFailCallback(res, override),
      )
      .catch((err) => onFailCallback(err, override));
  }

  //get methods

  /**
   * gets the list of the type of nested model
   * @param id the parent model id, the parent who's list is to be retrieved
   * @param override overrides the function
   * @param onSuccessCallback on success does this
   * @param onFailCallback on fail does this
   * @returns a list of the nested models at this endpoint in a promise
   */
  static getInitiatingEvents(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${INITIATING_EVENTS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[]) // Parse the response as JSON
      .catch((error) => {
        console.error("Error fetching internal events:", error);
        throw error; // Re-throw the error to propagate it if needed
      });
  }

  /**
   * gets the list of the type of nested model
   * @param id the parent model id, the parent who's list is to be retrieved
   * @param override overrides the function
   * @param onSuccessCallback on success does this
   * @param onFailCallback on fail does this
   * @returns a list of the nested models at this endpoint in a promise
   */
  static getEventSequenceDiagrams(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${EVENT_SEQUENCE_DIAGRAMS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[]) // Parse the response as JSON
      .catch((error) => {
        console.error("Error fetching internal events:", error);
        throw error; // Re-throw the error to propagate it if needed
      });
  }

  /**
   * gets the list of the type of nested model
   * @param id the parent model id, the parent who's list is to be retrieved
   * @param override overrides the function
   * @param onSuccessCallback on success does this
   * @param onFailCallback on fail does this
   * @returns a list of the nested models at this endpoint in a promise
   */
  static getEventTrees(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${EVENT_TREES_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[]) // Parse the response as JSON
      .catch((error) => {
        console.error("Error fetching internal events:", error);
        throw error; // Re-throw the error to propagate it if needed
      });
  }

  /**
   * gets the list of the type of nested model
   * @param id the parent model id, the parent who's list is to be retrieved
   * @param override overrides the function
   * @param onSuccessCallback on success does this
   * @param onFailCallback on fail does this
   * @returns a list of the nested models at this endpoint in a promise
   */
  static getFunctionalEvents(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${FUNCTIONAL_EVENTS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[]) // Parse the response as JSON
      .catch((error) => {
        console.error("Error fetching internal events:", error);
        throw error; // Re-throw the error to propagate it if needed
      });
  }

  /**
   * gets the list of the type of nested model
   * @param id the parent model id, the parent who's list is to be retrieved
   * @param override overrides the function
   * @param onSuccessCallback on success does this
   * @param onFailCallback on fail does this
   * @returns a list of the nested models at this endpoint in a promise
   */
  static getFaultTrees(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${FAULT_TREES_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[]) // Parse the response as JSON
      .catch((error) => {
        console.error("Error fetching internal events:", error);
        throw error; // Re-throw the error to propagate it if needed
      });
  }

  /**
   * gets the list of the type of nested model
   * @param id the parent model id, the parent who's list is to be retrieved
   * @param override overrides the function
   * @param onSuccessCallback on success does this
   * @param onFailCallback on fail does this
   * @returns a list of the nested models at this endpoint in a promise
   */
  static getBayesianNetworks(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${BAYESIAN_NETWORKS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[]) // Parse the response as JSON
      .catch((error) => {
        console.error("Error fetching internal events:", error);
        throw error; // Re-throw the error to propagate it if needed
      });
  }

  /**
   * gets the list of the type of nested model
   * @param id the parent model id, the parent who's list is to be retrieved
   * @param override overrides the function
   * @param onSuccessCallback on success does this
   * @param onFailCallback on fail does this
   * @returns a list of the nested models at this endpoint in a promise
   */
  static getMarkovChains(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${MARKOV_CHAINS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[]) // Parse the response as JSON
      .catch((error) => {
        console.error("Error fetching internal events:", error);
        throw error; // Re-throw the error to propagate it if needed
      });
  }

  /**
   * gets the list of the type of nested model
   * @param id the parent model id, the parent who's list is to be retrieved
   * @param override overrides the function
   * @param onSuccessCallback on success does this
   * @param onFailCallback on fail does this
   * @returns a list of the nested models at this endpoint in a promise
   */
  static getBayesianEstimations(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${BAYESIAN_ESTIMATION_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[]) // Parse the response as JSON
      .catch((error) => {
        console.error("Error fetching internal events:", error);
        throw error; // Re-throw the error to propagate it if needed
      });
  }

  /**
   * gets the list of the type of nested model
   * @param id the parent model id, the parent who's list is to be retrieved
   * @param override overrides the function
   * @param onSuccessCallback on success does this
   * @param onFailCallback on fail does this
   * @returns a list of the nested models at this endpoint in a promise
   */
  static getWeibullAnalysis(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${WEIBULL_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[]) // Parse the response as JSON
      .catch((error) => {
        console.error("Error fetching internal events:", error);
        throw error; // Re-throw the error to propagate it if needed
      });
  }

  // Risk Integration
  static getRiskIntegration(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${RISK_INTEGRATION_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[])
      .catch((error) => {
        console.error("Error fetching Risk Integration analysis:", error);
        throw error;
      });
  }

  // Radiological Consequence Analysis
  static getRadiologicalConsequenceAnalysis(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${RADIOLOGICAL_CONSEQUENCE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[])
      .catch((error) => {
        console.error(
          "Error fetching Radiological Consequence Analysis:",
          error,
        );
        throw error;
      });
  }

  // Mechanistic Source Term
  static getMechanisticSourceTerm(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${MECHANISTIC_SOURCE_TERM_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[])
      .catch((error) => {
        console.error(
          "Error fetching Mechanistic Source Term analysis:",
          error,
        );
        throw error;
      });
  }

  // Event Sequence Quantification Diagram
  static getEventSequenceQuantificationDiagram(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${EVENT_SEQUENCE_QUANTIFICATION_DIAGRAM_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[])
      .catch((error) => {
        console.error(
          "Error fetching Event Sequence Quantification Diagram analysis:",
          error,
        );
        throw error;
      });
  }

  // Data Analysis
  static getDataAnalysis(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${DATA_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[])
      .catch((error) => {
        console.error("Error fetching Data Analysis:", error);
        throw error;
      });
  }

  // Human Reliability Analysis
  static getHumanReliabilityAnalysis(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${HUMAN_RELIABILITY_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[])
      .catch((error) => {
        console.error("Error fetching Human Reliability Analysis:", error);
        throw error;
      });
  }

  // Systems Analysis
  static getSystemsAnalysis(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${SYSTEMS_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[])
      .catch((error) => {
        console.error("Error fetching Systems Analysis:", error);
        throw error;
      });
  }

  // Success Criteria
  static getSuccessCriteria(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${SUCCESS_CRITERIA_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[])
      .catch((error) => {
        console.error("Error fetching Success Criteria analysis:", error);
        throw error;
      });
  }

  // Event Sequence Analysis
  static getEventSequenceAnalysis(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${EVENT_SEQUENCE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[])
      .catch((error) => {
        console.error("Error fetching Event Sequence Analysis:", error);
        throw error;
      });
  }

  // Operating State Analysis
  static getOperatingStateAnalysis(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel[]> {
    return NestedModelApiManager.get(
      `${OPERATING_STATE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json() as NestedModel[])
      .catch((error) => {
        console.error("Error fetching Operating State Analysis:", error);
        throw error;
      });
  }

  /**
   * get the current typed model give the url on the webpage
   * @param override overrides the function
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the current nested model the user is on
   */
  static getCurrentTypedModel(
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    //setting up data so get current model doesn't need any parameters, as it will probably be called frequently
    const splitPath = window.location.pathname.split("/"); // Gets the path part of the URL (/internal-events/2) // Splits the path into segments using the '/' character
    const currentModelType = splitPath[NESTED_MODEL_TYPE_LOCATION]; // The second part is "internal-events"
    const modelId = parseInt(splitPath[NESTED_MODEL_ID_LOCATION]);
    return this.get(
      `${NESTED_ENDPOINT}/${currentModelType}/${modelId}/`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((response) => response.json()) // Parse the response as JSON
      .catch((error) => {
        console.error("Error fetching internal events:", error);
        throw error; // Re-throw the error to propagate it if needed
      });
  }

  /**
   * generic get for nested
   * @param url the url we get from
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns a promise with a nested model or nested model list
   */
  static async get(
    url: any,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ) {
    return await fetch(url, {
      method: "GET",
      cache: OPTION_CACHE,
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res, override)
          : onFailCallback(res, override),
      )
      .catch((err) => onFailCallback(err, override));
  }

  //patch methods

  /**
   * updates the label for the type of nested model
   * @param id the id of the nested model
   * @param data a labelJSON with a name and optional description
   * @param override overrides the funciton
   * @param onSuccessCallback does something of success
   * @param onFailCallback does something on fail
   * @returns a promise with the new updated model, with its label
   */
  static patchBayesianEstimationLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${BAYESIAN_ESTIMATION_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  /**
   * updates the label for the type of nested model
   * @param id the id of the nested model
   * @param data a labelJSON with a name and optional description
   * @param override overrides the funciton
   * @param onSuccessCallback does something of success
   * @param onFailCallback does something on fail
   * @returns a promise with the new updated model, with its label
   */
  static patchBayesianNetworkLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${BAYESIAN_NETWORKS_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  /**
   * updates the label for the type of nested model
   * @param id the id of the nested model
   * @param data a labelJSON with a name and optional description
   * @param override overrides the funciton
   * @param onSuccessCallback does something of success
   * @param onFailCallback does something on fail
   * @returns a promise with the new updated model, with its label
   */
  static patchEventSequenceDiagramLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${EVENT_SEQUENCE_DIAGRAMS_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  /**
   * updates the label for the type of nested model
   * @param id the id of the nested model
   * @param data a labelJSON with a name and optional description
   * @param override overrides the funciton
   * @param onSuccessCallback does something of success
   * @param onFailCallback does something on fail
   * @returns a promise with the new updated model, with its label
   */
  static patchEventTreeLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${EVENT_TREES_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  /**
   * updates the label for the type of nested model
   * @param id the id of the nested model
   * @param data a labelJSON with a name and optional description
   * @param override overrides the funciton
   * @param onSuccessCallback does something of success
   * @param onFailCallback does something on fail
   * @returns a promise with the new updated model, with its label
   */
  static patchFaultTreeLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${FAULT_TREES_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  /**
   * updates the label for the type of nested model
   * @param id the id of the nested model
   * @param data a labelJSON with a name and optional description
   * @param override overrides the funciton
   * @param onSuccessCallback does something of success
   * @param onFailCallback does something on fail
   * @returns a promise with the new updated model, with its label
   */
  static patchFunctionalEventLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${FUNCTIONAL_EVENTS_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  /**
   * updates the label for the type of nested model
   * @param id the id of the nested model
   * @param data a labelJSON with a name and optional description
   * @param override overrides the funciton
   * @param onSuccessCallback does something of success
   * @param onFailCallback does something on fail
   * @returns a promise with the new updated model, with its label
   */
  static patchInitiatingEventLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${INITIATING_EVENTS_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  /**
   * updates the label for the type of nested model
   * @param id the id of the nested model
   * @param data a labelJSON with a name and optional description
   * @param override overrides the funciton
   * @param onSuccessCallback does something of success
   * @param onFailCallback does something on fail
   * @returns a promise with the new updated model, with its label
   */
  static patchMakovChaionLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${MARKOV_CHAINS_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  /**
   * updates the label for the type of nested model
   * @param id the id of the nested model
   * @param data a labelJSON with a name and optional description
   * @param override overrides the funciton
   * @param onSuccessCallback does something of success
   * @param onFailCallback does something on fail
   * @returns a promise with the new updated model, with its label
   */
  static patchWeibullAnalysisLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${WEIBULL_ANALYSIS_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  // Risk Integration
  static patchRiskIntegrationLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${RISK_INTEGRATION_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  // Radiological Consequence Analysis
  static patchRadiologicalConsequenceLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${RADIOLOGICAL_CONSEQUENCE_ANALYSIS_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  // Mechanistic Source Term
  static patchMechanisticSourceTermLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${MECHANISTIC_SOURCE_TERM_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  // Event Sequence Quantification Diagram
  static patchEventSequenceQuantificationDiagramLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${EVENT_SEQUENCE_QUANTIFICATION_DIAGRAM_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  // Data Analysis
  static patchDataAnalysisLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${DATA_ANALYSIS_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  // Human Reliability Analysis
  static patchHumanReliabilityLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${HUMAN_RELIABILITY_ANALYSIS_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  // Systems Analysis
  static patchSystemsAnalysisLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${SYSTEMS_ANALYSIS_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  // Success Criteria
  static patchSuccessCriteriaLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${SUCCESS_CRITERIA_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  // Event Sequence Analysis
  static patchEventSequenceAnalysisLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${EVENT_SEQUENCE_ANALYSIS_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  // Operating State Analysis
  static patchOperatingStateLabel(
    id: number,
    data: LabelJSON,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    return TypedModelApiManager.patch(
      `${OPERATING_STATE_ANALYSIS_ENDPOINT}/${id}`,
      JSON.stringify(data),
      override,
      onSuccessCallback,
      onFailCallback,
    ).then((response) => response.json());
  }

  /**
   * Patches a nested model
   * @param url the url we grab the data from, passed by the other methods
   * @param data the a prtial of a model that at least contains a label and users list
   * @param override overrides the function
   * @param onSuccessCallback preforms this on success
   * @param onFailCallback preforms this on failure
   * @returns the newly patched model in a promise
   */
  static patch(
    url: any,
    data: any,
    override: any = null,
    onSuccessCallback = TypedModelApiManager.defaultSuccessCallback,
    onFailCallback = TypedModelApiManager.defaultFailCallback,
  ) {
    return fetch(url, {
      method: "PATCH",
      cache: OPTION_CACHE,
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
      body: data, // body data type must match "Content-Type" header
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res, override)
          : onFailCallback(res, override),
      )
      .catch((err) => onFailCallback(err, override));
  }

  //delete methods

  /**
   * deletes a model from the endpoint
   * @param id the id of the model to be deleted
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the deleted model
   */
  static async deleteInitiatingEvent(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${INITIATING_EVENTS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "initiatingEvents",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    if (currentModelType == "internal-hazards")
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    if (currentModelType == "external-hazards")
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    if (currentModelType == "full-scope")
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    return response;
  }

  /**
   * deletes a model from the endpoint
   * @param id the id of the model to be deleted
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the deleted model
   */
  static async deleteEventSequenceDiagram(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${EVENT_SEQUENCE_DIAGRAMS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "eventSequenceDiagrams",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    if (currentModelType == "internal-events")
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    if (currentModelType == "internal-hazards")
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    if (currentModelType == "external-hazards")
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    if (currentModelType == "full-scope")
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    return response;
  }

  /**
   * deletes a model from the endpoint
   * @param id the id of the model to be deleted
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the deleted model
   */
  static async deleteEventTree(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${EVENT_TREES_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "eventTrees",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    if (currentModelType == "internal-events")
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    if (currentModelType == "internal-hazards")
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    if (currentModelType == "external-hazards")
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    if (currentModelType == "full-scope")
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    return response;
  }

  /**
   * deletes a model from the endpoint
   * @param id the id of the model to be deleted
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the deleted model
   */
  static async deleteFunctionalEvent(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${FUNCTIONAL_EVENTS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "functionalEvents",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    if (currentModelType == "internal-events")
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    if (currentModelType == "internal-hazards")
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    if (currentModelType == "external-hazards")
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    if (currentModelType == "full-scope")
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    return response;
  }

  /**
   * deletes a model from the endpoint
   * @param id the id of the model to be deleted
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the deleted model
   */
  static async deleteFaultTree(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${FAULT_TREES_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "faultTrees",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    if (currentModelType == "internal-events")
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    if (currentModelType == "internal-hazards")
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    if (currentModelType == "external-hazards")
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    if (currentModelType == "full-scope")
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    return response;
  }

  /**
   * deletes a model from the endpoint
   * @param id the id of the model to be deleted
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the deleted model
   */
  static async deleteBayesianNetwork(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${BAYESIAN_NETWORKS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "bayesianNetworks",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    if (currentModelType == "internal-events")
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    if (currentModelType == "internal-hazards")
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    if (currentModelType == "external-hazards")
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    if (currentModelType == "full-scope")
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    return response;
  }

  /**
   * deletes a model from the endpoint
   * @param id the id of the model to be deleted
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the deleted model
   */
  static async deleteMarkovChain(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${MARKOV_CHAINS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "markovChains",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    if (currentModelType == "internal-events")
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    if (currentModelType == "internal-hazards")
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    if (currentModelType == "external-hazards")
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    if (currentModelType == "full-scope")
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    return response;
  }

  /**
   * deletes a model from the endpoint
   * @param id the id of the model to be deleted
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the deleted model
   */
  static async deleteBayesianEstimation(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${BAYESIAN_ESTIMATION_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "bayesianEstimations",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    if (currentModelType == "internal-events")
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    if (currentModelType == "internal-hazards")
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    if (currentModelType == "external-hazards")
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    if (currentModelType == "full-scope")
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    return response;
  }

  /**
   * deletes a model from the endpoint
   * @param id the id of the model to be deleted
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the deleted model
   */
  static async deleteWeibullAnalysis(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${WEIBULL_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "weibullAnalysis",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();
    if (currentModelType == "internal-events")
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    if (currentModelType == "internal-hazards")
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    if (currentModelType == "external-hazards")
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    if (currentModelType == "full-scope")
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    return response;
  }

  // Risk Integration
  static async deleteRiskIntegration(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${RISK_INTEGRATION_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "riskIntegration",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Delete the nested analysis from the appropriate parent type
    if (currentModelType === "internal-events") {
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    } else if (currentModelType === "internal-hazards") {
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    } else if (currentModelType === "external-hazards") {
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    } else if (currentModelType === "full-scope") {
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    }

    return response;
  }

  // Radiological Consequence Analysis
  static async deleteRadiologicalConsequenceAnalysis(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${RADIOLOGICAL_CONSEQUENCE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "radiologicalConsequence",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Delete the nested analysis from the appropriate parent type
    if (currentModelType === "internal-events") {
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    } else if (currentModelType === "internal-hazards") {
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    } else if (currentModelType === "external-hazards") {
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    } else if (currentModelType === "full-scope") {
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    }

    return response;
  }

  // Mechanistic Source Term
  static async deleteMechanisticSourceTerm(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${MECHANISTIC_SOURCE_TERM_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "mechanisticSourceTerm",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Delete the nested analysis from the appropriate parent type
    if (currentModelType === "internal-events") {
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    } else if (currentModelType === "internal-hazards") {
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    } else if (currentModelType === "external-hazards") {
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    } else if (currentModelType === "full-scope") {
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    }

    return response;
  }

  // Event Sequence Quantification Diagram
  static async deleteEventSequenceQuantificationDiagram(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${EVENT_SEQUENCE_QUANTIFICATION_DIAGRAM_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "eventSequenceQuantificationDiagram",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Delete the nested analysis from the appropriate parent type
    if (currentModelType === "internal-events") {
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    } else if (currentModelType === "internal-hazards") {
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    } else if (currentModelType === "external-hazards") {
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    } else if (currentModelType === "full-scope") {
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    }

    return response;
  }

  // Data Analysis
  static async deleteDataAnalysis(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${DATA_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "dataAnalysis",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Delete the nested analysis from the appropriate parent type
    if (currentModelType === "internal-events") {
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    } else if (currentModelType === "internal-hazards") {
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    } else if (currentModelType === "external-hazards") {
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    } else if (currentModelType === "full-scope") {
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    }

    return response;
  }

  // Human Reliability Analysis
  static async deleteHumanReliabilityAnalysis(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${HUMAN_RELIABILITY_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "humanReliabilityAnalysis",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Delete the nested analysis from the appropriate parent type
    if (currentModelType === "internal-events") {
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    } else if (currentModelType === "internal-hazards") {
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    } else if (currentModelType === "external-hazards") {
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    } else if (currentModelType === "full-scope") {
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    }

    return response;
  }

  // Systems Analysis
  static async deleteSystemsAnalysis(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${SYSTEMS_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "systemsAnalysis",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Delete the nested analysis from the appropriate parent type
    if (currentModelType === "internal-events") {
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    } else if (currentModelType === "internal-hazards") {
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    } else if (currentModelType === "external-hazards") {
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    } else if (currentModelType === "full-scope") {
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    }

    return response;
  }

  // Success Criteria
  static async deleteSuccessCriteria(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${SUCCESS_CRITERIA_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "successCriteria",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Delete the nested analysis from the appropriate parent type
    if (currentModelType === "internal-events") {
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    } else if (currentModelType === "internal-hazards") {
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    } else if (currentModelType === "external-hazards") {
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    } else if (currentModelType === "full-scope") {
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    }

    return response;
  }

  // Event Sequence Analysis
  static async deleteEventSequenceAnalysis(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${EVENT_SEQUENCE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "eventSequenceAnalysis",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Delete the nested analysis from the appropriate parent type
    if (currentModelType === "internal-events") {
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    } else if (currentModelType === "internal-hazards") {
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    } else if (currentModelType === "external-hazards") {
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    } else if (currentModelType === "full-scope") {
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    }

    return response;
  }

  // Operating State Analysis
  static async deleteOperatingStateAnalysis(
    id = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(
      `${OPERATING_STATE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
    const modelId = await TypedModelApiManager.getCurrentModelId();
    const body = {
      nestedId: id,
      nestedType: "operatingStateAnalysis",
    };
    const currentModelType = await TypedModelApiManager.getCurrentModelType();

    // Delete the nested analysis from the appropriate parent type
    if (currentModelType === "internal-events") {
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body);
    } else if (currentModelType === "internal-hazards") {
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body);
    } else if (currentModelType === "external-hazards") {
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body);
    } else if (currentModelType === "full-scope") {
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body);
    }

    return response;
  }

  //delete for parent ids
  /**
   * removes all instanced of the parent ids, and deleted the models with nothing left
   * @param parentId parent id to be removed from nested models
   * @param override overrides the function
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   */
  static async removeParentIds(
    parentId = -1,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ): Promise<number> {
    console.log("in api");
    return await NestedModelApiManager.delete(
      `${NESTED_ENDPOINT}/?modelId=${Number(parentId)}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
  }

  /**
   * deletes something from one of the 9 nested models
   * @param url the url of where we are deleting things from
   * @param id id of model
   * @param override overrides function
   * @param onSuccessCallback run this on success, optional
   * @param onFailCallback run this on fail, optional
   * @returns a promise with the deleted model
   */
  static delete(
    url: any,
    override: any = null,
    onSuccessCallback = NestedModelApiManager.defaultSuccessCallback,
    onFailCallback = NestedModelApiManager.defaultFailCallback,
  ) {
    return fetch(url, {
      method: "DELETE",
      cache: OPTION_CACHE,
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res, override)
          : onFailCallback(res, override),
      )
      .catch((err) => onFailCallback(err, override));
  }

  //simple helpful function

  static getCurrentModelId(): number {
    const splitPath = window.location.pathname.split("/"); // Gets the path part of the URL (/internal-events/2) // Splits the path into segments using the '/' character
    const modelId = parseInt(splitPath[NESTED_MODEL_ID_LOCATION]);
    if (modelId) {
      return modelId;
    }
    return -1;
  }
}
