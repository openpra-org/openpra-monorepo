import NestedModel, { NestedModelJSON } from "../types/modelTypes/innerModels/nestedModel";
import AuthService from "./AuthService";
import TypedModelApiManager from "./TypedModelApiManager";


//used constants
const API_ENDPOINT = '/api';
const OPTION_CACHE = 'no-cache'; // *default, no-cache, reload, force-cache, only-if-cached
const NESTED_ENDPOINT = `${API_ENDPOINT}/nested-models`;
const INITIATING_EVENTS_ENDPOINT = `${NESTED_ENDPOINT}/initiating-events`
const EVENT_SEQUENCE_DIAGRAMS_ENDPOINT = `${NESTED_ENDPOINT}/event-sequence-diagrams`
const EVENT_TREES_ENDPOINT = `${NESTED_ENDPOINT}/event-trees`
const FUNCTIONAL_EVENTS_ENDPOINT = `${NESTED_ENDPOINT}/functional-events`
const FAULT_TREES_ENDPOINT = `${NESTED_ENDPOINT}/fault-trees`
const BAYESIAN_NETWORKS_ENDPOINT = `${NESTED_ENDPOINT}/bayesian-networks`
const MARKOV_CHAINS_ENDPOINT = `${NESTED_ENDPOINT}/markov-chains`
const BAYESIAN_ESTIMATION_ENDPOINT = `${NESTED_ENDPOINT}/bayesian-estimations`
const WEIBULL_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/weibull-analysis`
const NESTED_MODEL_TYPE_LOCATION = 3;
const NESTED_MODEL_ID_LOCATION = 4


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
          this.callSnackbar('success', res, override);
        }
      } catch {

      }
      return res;
  }

  static defaultFailCallback(res: any, override: any) {
    try {
        const { showFailure } = override;
        if (showFailure) {
        this.callSnackbar('error', res, override);
        }
    } catch {

    }
    return res;
  }

  //method to get past counter value

  static async getPreviousCounterValue(override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback) : Promise<number> {
    return await NestedModelApiManager.get(`${NESTED_ENDPOINT}`, override, onSuccessCallback, onFailCallback)
      .then((response) => {
        return response.json()
      });
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
  static async postInitiatingEvent(data: NestedModelJSON, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback) : Promise<NestedModel> {
    //makes child exist
    const returnResponse = await NestedModelApiManager.post(`${INITIATING_EVENTS_ENDPOINT}/`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: 'initiatingEvents'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
    if(currentModelType === 'internal-events')
      await TypedModelApiManager.addNestedToInternalEvent(body)
    if(currentModelType === 'internal-hazards')
      await TypedModelApiManager.addNestedToInternalHazard(body)
    if(currentModelType === 'external-hazards')
      await TypedModelApiManager.addNestedToExternalHazard(body)
    if(currentModelType === 'full-scope')
      await TypedModelApiManager.addNestedToFullScope(body)
    return returnResponse
  }

  /**
   * posts the type of nested model, and adds its id to its parent
   * @param data a nestedmodelJSON containing a label and a parent id
   * @param override overrides the fucntion
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on failure
   * @returns a promise with the nested model, containing only those features
   */
  static async postEventSequenceDiagram(data: NestedModelJSON, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback) : Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(`${EVENT_SEQUENCE_DIAGRAMS_ENDPOINT}/`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: 'eventSequenceDiagrams'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
    if(currentModelType === 'internal-events')
      await TypedModelApiManager.addNestedToInternalEvent(body)
    if(currentModelType === 'internal-hazards')
      await TypedModelApiManager.addNestedToInternalHazard(body)
    if(currentModelType === 'external-hazards')
      await TypedModelApiManager.addNestedToExternalHazard(body)
    if(currentModelType === 'full-scope')
      await TypedModelApiManager.addNestedToFullScope(body)
    return returnResponse
  }

  /**
   * posts the type of nested model, and adds its id to its parent
   * @param data a nestedmodelJSON containing a label and a parent id
   * @param override overrides the fucntion
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on failure
   * @returns a promise with the nested model, containing only those features
   */
  static async postEventTree(data: NestedModelJSON, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback) : Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(`${EVENT_TREES_ENDPOINT}/`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: 'eventTrees'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
    if(currentModelType === 'internal-events')
      await TypedModelApiManager.addNestedToInternalEvent(body)
    if(currentModelType === 'internal-hazards')
      await TypedModelApiManager.addNestedToInternalHazard(body)
    if(currentModelType === 'external-hazards')
      await TypedModelApiManager.addNestedToExternalHazard(body)
    if(currentModelType === 'full-scope')
      await TypedModelApiManager.addNestedToFullScope(body)
    return returnResponse
  }

  /**
   * posts the type of nested model, and adds its id to its parent
   * @param data a nestedmodelJSON containing a label and a parent id
   * @param override overrides the fucntion
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on failure
   * @returns a promise with the nested model, containing only those features
   */
  static async postFunctionalEvent(data: NestedModelJSON, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback) : Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(`${FUNCTIONAL_EVENTS_ENDPOINT}/`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: 'functionalEvents'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
    if(currentModelType === 'internal-events')
      await TypedModelApiManager.addNestedToInternalEvent(body)
    if(currentModelType === 'internal-hazards')
      await TypedModelApiManager.addNestedToInternalHazard(body)
    if(currentModelType === 'external-hazards')
      await TypedModelApiManager.addNestedToExternalHazard(body)
    if(currentModelType === 'full-scope')
      await TypedModelApiManager.addNestedToFullScope(body)
    return returnResponse
  }

  /**
   * posts the type of nested model, and adds its id to its parent
   * @param data a nestedmodelJSON containing a label and a parent id
   * @param override overrides the fucntion
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on failure
   * @returns a promise with the nested model, containing only those features
   */
  static async postFaultTree(data: NestedModelJSON, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback) : Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(`${FAULT_TREES_ENDPOINT}/`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: 'faultTrees'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
    if(currentModelType === 'internal-events')
      await TypedModelApiManager.addNestedToInternalEvent(body)
    if(currentModelType === 'internal-hazards')
      await TypedModelApiManager.addNestedToInternalHazard(body)
    if(currentModelType === 'external-hazards')
      await TypedModelApiManager.addNestedToExternalHazard(body)
    if(currentModelType === 'full-scope')
      await TypedModelApiManager.addNestedToFullScope(body)
    return returnResponse
  }

  /**
   * posts the type of nested model, and adds its id to its parent
   * @param data a nestedmodelJSON containing a label and a parent id
   * @param override overrides the fucntion
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on failure
   * @returns a promise with the nested model, containing only those features
   */
  static async postBayesianNetwork(data: NestedModelJSON, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback) : Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(`${BAYESIAN_NETWORKS_ENDPOINT}/`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: 'bayesianNetworks'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
    if(currentModelType === 'internal-events')
      await TypedModelApiManager.addNestedToInternalEvent(body)
    if(currentModelType === 'internal-hazards')
      await TypedModelApiManager.addNestedToInternalHazard(body)
    if(currentModelType === 'external-hazards')
      await TypedModelApiManager.addNestedToExternalHazard(body)
    if(currentModelType === 'full-scope')
      await TypedModelApiManager.addNestedToFullScope(body)
    return returnResponse
  }

  /**
   * posts the type of nested model, and adds its id to its parent
   * @param data a nestedmodelJSON containing a label and a parent id
   * @param override overrides the fucntion
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on failure
   * @returns a promise with the nested model, containing only those features
   */
  static async postMarkovChain(data: NestedModelJSON, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback) : Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(`${MARKOV_CHAINS_ENDPOINT}/`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: 'markovChains'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
    if(currentModelType === 'internal-events')
      await TypedModelApiManager.addNestedToInternalEvent(body)
    if(currentModelType === 'internal-hazards')
      await TypedModelApiManager.addNestedToInternalHazard(body)
    if(currentModelType === 'external-hazards')
      await TypedModelApiManager.addNestedToExternalHazard(body)
    if(currentModelType === 'full-scope')
      await TypedModelApiManager.addNestedToFullScope(body)
    return returnResponse
  }

  /**
   * posts the type of nested model, and adds its id to its parent
   * @param data a nestedmodelJSON containing a label and a parent id
   * @param override overrides the fucntion
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on failure
   * @returns a promise with the nested model, containing only those features
   */
  static async postBayesianEstimation(data: NestedModelJSON, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback) : Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(`${BAYESIAN_ESTIMATION_ENDPOINT}/`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: 'bayesianEstimations'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
    if(currentModelType === 'internal-events')
      await TypedModelApiManager.addNestedToInternalEvent(body)
    if(currentModelType === 'internal-hazards')
      await TypedModelApiManager.addNestedToInternalHazard(body)
    if(currentModelType === 'external-hazards')
      await TypedModelApiManager.addNestedToExternalHazard(body)
    if(currentModelType === 'full-scope')
      await TypedModelApiManager.addNestedToFullScope(body)
    return returnResponse
  }

  /**
   * posts the type of nested model, and adds its id to its parent
   * @param data a nestedmodelJSON containing a label and a parent id
   * @param override overrides the fucntion
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on failure
   * @returns a promise with the nested model, containing only those features
   */
  static async postWeibullAnalysis(data: NestedModelJSON, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback) : Promise<NestedModel> {
    const returnResponse = await NestedModelApiManager.post(`${WEIBULL_ANALYSIS_ENDPOINT}/`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
    const body = {
      modelId: await TypedModelApiManager.getCurrentModelId(),
      nestedId: await NestedModelApiManager.getPreviousCounterValue(),
      nestedType: 'WeibullAnalysis'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
    if(currentModelType === 'internal-events')
      await TypedModelApiManager.addNestedToInternalEvent(body)
    if(currentModelType === 'internal-hazards')
      await TypedModelApiManager.addNestedToInternalHazard(body)
    if(currentModelType === 'external-hazards')
      await TypedModelApiManager.addNestedToExternalHazard(body)
    if(currentModelType === 'full-scope')
      await TypedModelApiManager.addNestedToFullScope(body)
    return returnResponse
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
  static post(url: any, data: any, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback) {
    return fetch(url, {
        method: 'POST',
        cache: OPTION_CACHE,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `JWT ${AuthService.getEncodedToken()}`,
        },
        body: data, // body data type must match "Content-Type" header
    }).then(res => (res.ok ? onSuccessCallback(res, override) : onFailCallback(res, override)))
        .catch(err => onFailCallback(err, override));
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
  static getInitiatingEvents(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel[]> {
    return NestedModelApiManager.get(`${INITIATING_EVENTS_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
        .then((response) => {return response.json() as NestedModel[]}) // Parse the response as JSON
        .catch((error) => {
            console.error('Error fetching internal events:', error);
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
  static getEventSequenceDiagrams(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel[]> {
    return NestedModelApiManager.get(`${EVENT_SEQUENCE_DIAGRAMS_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
        .then((response) => {return response.json() as NestedModel[]}) // Parse the response as JSON
        .catch((error) => {
            console.error('Error fetching internal events:', error);
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
  static getEventTrees(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel[]> {
    return NestedModelApiManager.get(`${EVENT_TREES_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
        .then((response) => {return response.json() as NestedModel[]}) // Parse the response as JSON
        .catch((error) => {
            console.error('Error fetching internal events:', error);
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
  static getFunctionalEvents(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel[]> {
    return NestedModelApiManager.get(`${FUNCTIONAL_EVENTS_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
        .then((response) => {return response.json() as NestedModel[]}) // Parse the response as JSON
        .catch((error) => {
            console.error('Error fetching internal events:', error);
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
  static getFaultTrees(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel[]> {
    return NestedModelApiManager.get(`${FAULT_TREES_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
        .then((response) => {return response.json() as NestedModel[]}) // Parse the response as JSON
        .catch((error) => {
            console.error('Error fetching internal events:', error);
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
  static getBayesianNetworks(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel[]> {
    return NestedModelApiManager.get(`${BAYESIAN_NETWORKS_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
        .then((response) => {return response.json() as NestedModel[]}) // Parse the response as JSON
        .catch((error) => {
            console.error('Error fetching internal events:', error);
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
  static getMarkovChains(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel[]> {
    return NestedModelApiManager.get(`${MARKOV_CHAINS_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
        .then((response) => {return response.json() as NestedModel[]}) // Parse the response as JSON
        .catch((error) => {
            console.error('Error fetching internal events:', error);
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
  static getBayesianEstimations(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel[]> {
    return NestedModelApiManager.get(`${BAYESIAN_ESTIMATION_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
        .then((response) => {return response.json() as NestedModel[]}) // Parse the response as JSON
        .catch((error) => {
            console.error('Error fetching internal events:', error);
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
  static getWeibullAnalysis(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel[]> {
    return NestedModelApiManager.get(`${WEIBULL_ANALYSIS_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
        .then((response) => {return response.json() as NestedModel[]}) // Parse the response as JSON
        .catch((error) => {
            console.error('Error fetching internal events:', error);
            throw error; // Re-throw the error to propagate it if needed
        });
  }

  /**
   * get the current typed model give the url on the webpage
   * @param override overrides the function
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the current nested model the user is on
   */
  static getCurrentTypedModel(override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel> {
    //setting up data so get current model doesn't need any parameters, as it will probably be called frequently
    const splitPath = window.location.pathname.split('/'); // Gets the path part of the URL (/internal-events/2) // Splits the path into segments using the '/' character
    const currentModelType = splitPath[NESTED_MODEL_TYPE_LOCATION]; // The second part is "internal-events"
    const modelId = parseInt(splitPath[NESTED_MODEL_ID_LOCATION]); 
    return this.get(`${NESTED_ENDPOINT}/${currentModelType}/${modelId}/`, override, onSuccessCallback, onFailCallback)
        .then((response) => {return response.json()}) // Parse the response as JSON
        .catch((error) => {
            console.error('Error fetching internal events:', error);
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
  static async get(url: any, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback) {
    return await fetch(url, {
          method: 'GET',
          cache: OPTION_CACHE,
          headers: {
              'Content-Type': 'application/json',
              Authorization: `JWT ${AuthService.getEncodedToken()}`,
          },
      }).then(res => (res.ok ? onSuccessCallback(res, override) : onFailCallback(res, override)))
          .catch(err => onFailCallback(err, override));
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
  static async deleteInitiatingEvent(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(`${INITIATING_EVENTS_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
    const modelId = await TypedModelApiManager.getCurrentModelId()
    const body = {
      nestedId: id,
      nestedType: 'initiatingEvents'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body)
    if(currentModelType == 'internal-hazards')
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body)
    if(currentModelType == 'external-hazards')
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body)
    if(currentModelType == 'full-scope')
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body)
    return response  
  }

  /**
   * deletes a model from the endpoint
   * @param id the id of the model to be deleted
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the deleted model
   */
  static async deleteEventSequenceDiagram(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(`${EVENT_SEQUENCE_DIAGRAMS_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
    const modelId = await TypedModelApiManager.getCurrentModelId()
    const body = {
      nestedId: id,
      nestedType: 'eventSequenceDiagrams'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
    if(currentModelType == 'internal-events')
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body)
    if(currentModelType == 'internal-hazards')
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body)
    if(currentModelType == 'external-hazards')
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body)
    if(currentModelType == 'full-scope')
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body)
    return response
  }

  /**
   * deletes a model from the endpoint
   * @param id the id of the model to be deleted
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the deleted model
   */
  static async deleteEventTree(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(`${EVENT_TREES_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
    const modelId = await TypedModelApiManager.getCurrentModelId()
    const body = {
      nestedId: id,
      nestedType: 'eventTrees'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
    if(currentModelType == 'internal-events')
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body)
    if(currentModelType == 'internal-hazards')
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body)
    if(currentModelType == 'external-hazards')
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body)
    if(currentModelType == 'full-scope')
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body)
    return response
  }

  /**
   * deletes a model from the endpoint
   * @param id the id of the model to be deleted
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the deleted model
   */
  static async deleteFunctionalEvent(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(`${FUNCTIONAL_EVENTS_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
    const modelId = await TypedModelApiManager.getCurrentModelId()
    const body = {
      nestedId: id,
      nestedType: 'functionalEvents'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
    if(currentModelType == 'internal-events')
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body)
    if(currentModelType == 'internal-hazards')
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body)
    if(currentModelType == 'external-hazards')
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body)
    if(currentModelType == 'full-scope')
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body)
    return response
  }

  /**
   * deletes a model from the endpoint
   * @param id the id of the model to be deleted
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the deleted model
   */
  static async deleteFaultTree(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(`${FAULT_TREES_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
    const modelId = await TypedModelApiManager.getCurrentModelId()
    const body = {
      nestedId: id,
      nestedType: 'faultTrees'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
    if(currentModelType == 'internal-events')
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body)
    if(currentModelType == 'internal-hazards')
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body)
    if(currentModelType == 'external-hazards')
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body)
    if(currentModelType == 'full-scope')
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body)
    return response
  }

  /**
   * deletes a model from the endpoint
   * @param id the id of the model to be deleted
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the deleted model
   */
  static async deleteBayesianNetwork(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(`${BAYESIAN_NETWORKS_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
    const modelId = await TypedModelApiManager.getCurrentModelId()
    const body = {
      nestedId: id,
      nestedType: 'bayesianNetworks'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
    if(currentModelType == 'internal-events')
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body)
    if(currentModelType == 'internal-hazards')
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body)
    if(currentModelType == 'external-hazards')
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body)
    if(currentModelType == 'full-scope')
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body)
    return response
  }

  /**
   * deletes a model from the endpoint
   * @param id the id of the model to be deleted
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the deleted model
   */
  static async deleteMarkovChain(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(`${MARKOV_CHAINS_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
    const modelId = await TypedModelApiManager.getCurrentModelId()
    const body = {
      nestedId: id,
      nestedType: 'markovChains'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
    if(currentModelType == 'internal-events')
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body)
    if(currentModelType == 'internal-hazards')
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body)
    if(currentModelType == 'external-hazards')
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body)
    if(currentModelType == 'full-scope')
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body)
    return response
  }

  /**
   * deletes a model from the endpoint
   * @param id the id of the model to be deleted
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the deleted model
   */
  static async deleteBayesianEstimation(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(`${BAYESIAN_ESTIMATION_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
    const modelId = await TypedModelApiManager.getCurrentModelId()
    const body = {
      nestedId: id,
      nestedType: 'bayesianEstimations'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
    if(currentModelType == 'internal-events')
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body)
    if(currentModelType == 'internal-hazards')
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body)
    if(currentModelType == 'external-hazards')
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body)
    if(currentModelType == 'full-scope')
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body)
    return response
  }

  /**
   * deletes a model from the endpoint
   * @param id the id of the model to be deleted
   * @param override override
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   * @returns the deleted model
   */
  static async deleteWeibullAnalysis(id = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<NestedModel> {
    const response = await NestedModelApiManager.delete(`${WEIBULL_ANALYSIS_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
    const modelId = await TypedModelApiManager.getCurrentModelId()
    const body = {
      nestedId: id,
      nestedType: 'weibullAnalysis'
    }
    const currentModelType = await TypedModelApiManager.getCurrentModelType()
    if(currentModelType == 'internal-events')
      TypedModelApiManager.deleteNestedFromInternalEvent(modelId, body)
    if(currentModelType == 'internal-hazards')
      TypedModelApiManager.deleteNestedFromInternalHazard(modelId, body)
    if(currentModelType == 'external-hazards')
      TypedModelApiManager.deleteNestedFromExternalHazard(modelId, body)
    if(currentModelType == 'full-scope')
      TypedModelApiManager.deleteNestedFromFullScope(modelId, body)
    return response
  }

  //delete for parent ids
  /**
   * removes all instanced of the parent ids, and deleted the models with nothing left
   * @param parentId parent id to be removed from nested models
   * @param override overrides the function
   * @param onSuccessCallback does something on success
   * @param onFailCallback does something on fail
   */
  static async removeParentIds(parentId = -1, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback): Promise<number> {
    console.log('in api')
    return await NestedModelApiManager.delete(`${NESTED_ENDPOINT}/?modelId=${Number(parentId)}`, override, onSuccessCallback, onFailCallback)
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
  static delete(url: any, override: any = null, onSuccessCallback = NestedModelApiManager.defaultSuccessCallback, onFailCallback = NestedModelApiManager.defaultFailCallback) {
    return fetch(url, {
        method: 'DELETE',
        cache: OPTION_CACHE,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `JWT ${AuthService.getEncodedToken()}`,
        },
    }).then(res => (res.ok ? onSuccessCallback(res, override) : onFailCallback(res, override)))
        .catch(err => onFailCallback(err, override));
  }

  //simple helpful function

  static getCurrentModelId(): number{
    const splitPath = window.location.pathname.split('/'); // Gets the path part of the URL (/internal-events/2) // Splits the path into segments using the '/' character
    const modelId = parseInt(splitPath[NESTED_MODEL_ID_LOCATION]);
    if(modelId){
      return modelId
    }
    return -1
  }
}
