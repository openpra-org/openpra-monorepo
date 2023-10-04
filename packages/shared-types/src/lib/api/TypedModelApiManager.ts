import InternalEventsModel from "../types/modelTypes/largeModels/internalEventsModel";
import InternalHazardsModel from "../types/modelTypes/largeModels/internalHazardsModel";
import ExternalHazardsModel from "../types/modelTypes/largeModels/externalHazardsModel";
import FullScopeModel from "../types/modelTypes/largeModels/fullScopeModel";
import AuthService from "./AuthService";
import TypedModel, { TypedModelJSON } from "../types/modelTypes/largeModels/typedModel";
import ApiManager from "./ApiManager";
import NestedModelApiManager from "./NestedModelApiManager";

const API_ENDPOINT = '/api';
const OPTION_CACHE = 'no-cache'; // *default, no-cache, reload, force-cache, only-if-cached
const TYPED_ENDPOINT = `${API_ENDPOINT}/typed-models`;
const DELETE_NESTED_END = '/delete-nested';
const INTERNAL_EVENTS_ENDPOINT = `${TYPED_ENDPOINT}/internal-events`;
const EXTERNAL_HAZARDS_ENDPOINT = `${TYPED_ENDPOINT}/external-hazards`;
const INTERNAL_HAZARDS_ENDPOINT = `${TYPED_ENDPOINT}/internal-hazards`;
const FULL_SCOPE_ENDPOINT = `${TYPED_ENDPOINT}/full-scope`;
const TYPED_MODEL_TYPE_LOCATION = 1;
const TYPED_MODEL_ID_LOCATION = 2


export default class TypedModelApiManager {

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

    //get methods

    /**
     * gets a list of internal events based on a users id
     * @param id the id of the user who's events we want to load
     * @param override overrides the function
     * @param onSuccessCallback function to be called on success
     * @param onFailCallback function to be called on failure
     * @returns a promise with an internal event list
     */
    static getInternalEvents(id = -1, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback): Promise<InternalEventsModel[]> {
        return this.get(`${INTERNAL_EVENTS_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
            .then((response) => {return response.json() as InternalEventsModel[]}) // Parse the response as JSON
            .catch((error) => {
                console.error('Error fetching internal events:', error);
                throw error; // Re-throw the error to propagate it if needed
            });
    }

    /**
     * gets a list of external hazards based on a users id
     * @param id the id of the user who's events we want to load
     * @param override overrides the function
     * @param onSuccessCallback function to be called on success
     * @param onFailCallback function to be called on failure
     * @returns a promise with an external hazards list
     */
    static getExternalHazards(id = -1, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback): Promise<ExternalHazardsModel[]> {
        return this.get(`${EXTERNAL_HAZARDS_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
            .then((response) => {return response.json() as ExternalHazardsModel[]}) // Parse the response as JSON
            .catch((error) => {
                console.error('Error fetching internal events:', error);
                throw error; // Re-throw the error to propagate it if needed
            });
    }

    /**
     * gets a list of internal hazards based on a users id
     * @param id the id of the user who's models we want to load
     * @param override overrides the function
     * @param onSuccessCallback function to be called on success
     * @param onFailCallback function to be called on failure
     * @returns a promise with an internal ahzards list
     */
    static getInternalHazards(id = -1, override: any = null, onSuccessCallback = this.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback): Promise<InternalHazardsModel[]> {
        return this.get(`${INTERNAL_HAZARDS_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
            .then((response) => {return response.json() as InternalEventsModel[]}) // Parse the response as JSON
            .catch((error) => {
                console.error('Error fetching internal events:', error);
                throw error; // Re-throw the error to propagate it if needed
            });
    }

    /**
     * gets a list of full scope based on a users id
     * @param id the id of the user who's models we want to load
     * @param override overrides the function
     * @param onSuccessCallback function to be called on success
     * @param onFailCallback function to be called on failure
     * @returns a promise with an full scope list
     */
    static getFullScopeModels(id = -1, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback): Promise<FullScopeModel[]> {
        return this.get(`${FULL_SCOPE_ENDPOINT}/?id=${Number(id)}`, override, onSuccessCallback, onFailCallback)
            .then((response) => {return response.json() as FullScopeModel[]}) // Parse the response as JSON
            .catch((error) => {
                console.error('Error fetching internal events:', error);
                throw error; // Re-throw the error to propagate it if needed
            });
    }

    //singular get current function

    /**
     * this function takes in nothing and gives the current model the user is on based on their page
     * useful for getting data, or possibly using this to add things to later down the line
     * @param override overrides the function
     * @param onSuccessCallback does something on success
     * @param onFailCallback does something on fail 
     * @returns the model the user is currently viewing
     */
    static getCurrentTypedModel(override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback): Promise<TypedModel> {
        //setting up data so get current model doesn't need any parameters, as it will probably be called frequently
        const userId = ApiManager.getCurrentUser().user_id
        const splitPath = window.location.pathname.split('/'); // Gets the path part of the URL (/internal-events/2) // Splits the path into segments using the '/' character
        const currentModelType = splitPath[TYPED_MODEL_TYPE_LOCATION]; // The second part is "internal-events"
        const modelId = parseInt(splitPath[TYPED_MODEL_ID_LOCATION]); 
        return this.get(`${TYPED_ENDPOINT}/${currentModelType}/${modelId}/?userId=${Number(userId)}`, override, onSuccessCallback, onFailCallback)
            .then((response) => {return response.json()}) // Parse the response as JSON
            .catch((error) => {
                console.error('Error fetching internal events:', error);
                throw error; // Re-throw the error to propagate it if needed
            });
    }

    //adding a method to grab just the id so there isnt an await

    static getCurrentModelId(): number {
        //setting up data so get current model doesn't need any parameters, as it will probably be called frequently
        const splitPath = window.location.pathname.split('/'); // Gets the path part of the URL (/internal-events/2) // Splits the path into segments using the '/' character // The second part is "internal-events"
        return parseInt(splitPath[TYPED_MODEL_ID_LOCATION]); 
    }

    static getCurrentModelType(): string {
        //setting up data so get current model doesn't need any parameters, as it will probably be called frequently
        const splitPath = window.location.pathname.split('/'); // Gets the path part of the URL (/internal-events/2) // Splits the path into segments using the '/' character // The second part is "internal-events"
        return (splitPath[TYPED_MODEL_TYPE_LOCATION]); 
    }

    /**
     * gets a list of internal events based on a users id
     * @param url the url where we are grabbing a data list from
     * @param id the id of the user who's events we want to load
     * @param override overrides the function
     * @param onSuccessCallback function to be called on success
     * @param onFailCallback function to be called on failure
     * @returns a promise with an list of a type of models
     */
    static get(url: any, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) {
        return fetch(url, {
            method: 'GET',
            cache: OPTION_CACHE,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `JWT ${AuthService.getEncodedToken()}`,
            },
        }).then(res => (res.ok ? onSuccessCallback(res, override) : onFailCallback(res, override)))
            .catch(err => onFailCallback(err, override));
    }

    //post Methods

    /**
     * this is the function thats posts a new internal event
     * @param data the new internal Event Model
     * @param override overrides the function
     * @param onSuccessCallback function that does something on success
     * @param onFailCallback function that does something on fail
     * @returns a promise with an typed model
     */
    static postInternalEvent(data: Partial<TypedModelJSON>, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) : Promise<TypedModel> {
        return TypedModelApiManager.post(`${INTERNAL_EVENTS_ENDPOINT}/`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
            // .then((response) => {
            //     return response.JSON()
            // });
    }

    /**
     * this is the function thats posts a new internal hazard
     * @param data the new internal hazard
     * @param override overrides the function
     * @param onSuccessCallback function that does something on success
     * @param onFailCallback function that does something on fail
     * @returns a promise with an typed model
     */
    static postInternalHazard(data: Partial<TypedModelJSON>, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) : Promise<TypedModel> {
        return TypedModelApiManager.post(`${INTERNAL_HAZARDS_ENDPOINT}/`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
            // .then((response) => {
            //     return response.JSON()
            // });
    }

    /**
     * this is the function thats posts a new external hazard
     * @param data the new external hazard model
     * @param override overrides the function
     * @param onSuccessCallback function that does something on success
     * @param onFailCallback function that does something on fail
     * @returns a promise with an typed model
     */
    static postExternalHazard(data: Partial<TypedModelJSON>, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) : Promise<TypedModel> {
        return TypedModelApiManager.post(`${EXTERNAL_HAZARDS_ENDPOINT}/`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
            // .then((response) => {
            //     return response.JSON()
            // });
    }

    /**
     * this is the function thats posts a new full scope
     * @param data the new full scope model
     * @param override overrides the function
     * @param onSuccessCallback function that does something on success
     * @param onFailCallback function that does something on fail
     * @returns a promise with an typed model
     */
    static postFullScope(data: Partial<TypedModelJSON>, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) : Promise<TypedModel> {
        return TypedModelApiManager.post(`${FULL_SCOPE_ENDPOINT}/`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
            // .then((response) => {
            //     return response.JSON()
            // });
    }

    /**
     * this is the function thats posts one of the model types
     * @param url the endpoint we are going to
     * @param data the new model
     * @param override overrides the function
     * @param onSuccessCallback function that does something on success
     * @param onFailCallback function that does something on fail
     * @returns a promise, left untyped right now as this is a generlist method
     */
    static post(url: any, data: any, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) {
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

    //patch methods

    /**
     * Patches an internal event by updating its users list, and label
     * @param modelId the model id of the model to be patched
     * @param userId the id of the user who is patching the model
     * @param data the aprtial of an internal events model that at least contains a label and users list
     * @param override overrides the function
     * @param onSuccessCallback preforms this on success
     * @param onFailCallback preforms this on failure
     * @returns the newly patched model in a promise
     */
    static patchInternalEvent(modelId: number, userId: number, data: Partial<TypedModelJSON>, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) : Promise<InternalEventsModel> {
        return TypedModelApiManager.patch(`${INTERNAL_EVENTS_ENDPOINT}/${modelId}/?userId=${Number(userId)}`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
            .then((response) => {
                return response.json()
            });
    }

    /**
     * Patches an external hazard by updating its users list, and label
     * @param modelId the model id of the model to be patched
     * @param userId the id of the user who is patching the model
     * @param data the aprtial of an external hazards model that at least contains a label and users list
     * @param override overrides the function
     * @param onSuccessCallback preforms this on success
     * @param onFailCallback preforms this on failure
     * @returns the newly patched model in a promise
     */
    static patchExternalHazard(modelId: number, userId: number, data: Partial<TypedModelJSON>, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) : Promise<ExternalHazardsModel> {
        return TypedModelApiManager.patch(`${EXTERNAL_HAZARDS_ENDPOINT}/${modelId}/?userId=${Number(userId)}`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
            .then((response) => {
                return response.json()
            });
    }

    /**
     * Patches an internal hazard by updating its users list, and label
     * @param modelId the model id of the model to be patched
     * @param userId the id of the user who is patching the model
     * @param data the aprtial of an internal hazards model that at least contains a label and users list
     * @param override overrides the function
     * @param onSuccessCallback preforms this on success
     * @param onFailCallback preforms this on failure
     * @returns the newly patched model in a promise
     */
    static patchInternalHazard(modelId: number, userId: number, data: Partial<TypedModelJSON>, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) : Promise<InternalHazardsModel> {
        return TypedModelApiManager.patch(`${INTERNAL_HAZARDS_ENDPOINT}/${modelId}/?userId=${Number(userId)}`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
        .then((response) => {
            return response.json()
        });
    }

    /**
     * Patches an full scope by updating its users list, and label
     * @param modelId the model id of the model to be patched
     * @param userId the id of the user who is patching the model
     * @param data the a prtial of a full scope model that at least contains a label and users list
     * @param override overrides the function
     * @param onSuccessCallback preforms this on success
     * @param onFailCallback preforms this on failure
     * @returns the newly patched model in a promise
     */
    static patchFullScope(modelId: number, userId: number, data: Partial<TypedModelJSON>, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) : Promise<FullScopeModel> {
        return TypedModelApiManager.patch(`${FULL_SCOPE_ENDPOINT}/${modelId}/?userId=${Number(userId)}`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
            .then((response) => {
                return response.json()
            });
    }

    /**
     * Patches a typed model
     * @param url the url we grab the data from, passed by the other methods
     * @param data the a prtial of a model that at least contains a label and users list
     * @param override overrides the function
     * @param onSuccessCallback preforms this on success
     * @param onFailCallback preforms this on failure
     * @returns the newly patched model in a promise
     */
    static patch(url: any, data: any, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) {
        return fetch(url, {
            method: 'PATCH',
            cache: OPTION_CACHE,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `JWT ${AuthService.getEncodedToken()}`,
            },
            body: data, // body data type must match "Content-Type" header
        }).then(res => (res.ok ? onSuccessCallback(res, override) : onFailCallback(res, override)))
            .catch(err => onFailCallback(err, override));
    }

    //delete methods

    /**
     * deletes an internal event with a given model id
     * @param id id of model
     * @param override overrides function  
     * @param onSuccessCallback run this on success, optional
     * @param onFailCallback run this on fail, optional
     * @returns a promise with the deleted internal event
     */
    static async deleteInternalEvent(id = -1, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback): Promise<InternalEventsModel[]> {
        await NestedModelApiManager.removeParentIds(id)
        return await TypedModelApiManager.delete(`${INTERNAL_EVENTS_ENDPOINT}/?modelId=${Number(id)}`, override, onSuccessCallback, onFailCallback)
            .then((response) => { return response.json()}) // Parse the response as JSON
            .catch((error) => {
                console.error('Error fetching internal events:', error);
                throw error; // Re-throw the error to propagate it if needed
            });
    }

    /**
     * deletes an external hazard with a given model id
     * @param id id of model
     * @param override overrides function  
     * @param onSuccessCallback run this on success, optional
     * @param onFailCallback run this on fail, optional
     * @returns a promise with the deleted external hazard
     */
    static async deleteExternalHazard(id = -1, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback): Promise<InternalEventsModel[]> {
        await NestedModelApiManager.removeParentIds(id)
        return await TypedModelApiManager.delete(`${EXTERNAL_HAZARDS_ENDPOINT}/?modelId=${Number(id)}`, override, onSuccessCallback, onFailCallback)
            .then((response) => {return response.json()}) // Parse the response as JSON
            .catch((error) => {
                console.error('Error fetching internal events:', error);
                throw error; // Re-throw the error to propagate it if needed
            });
    }

    /**
     * deletes an internal hazard with a given model id
     * @param id id of model
     * @param override overrides function  
     * @param onSuccessCallback run this on success, optional
     * @param onFailCallback run this on fail, optional
     * @returns a promise with the deleted internal hazard
     */
    static async deleteInternalHazard(id = -1, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback): Promise<InternalEventsModel[]> {
        await NestedModelApiManager.removeParentIds(id)
        return await TypedModelApiManager.delete(`${INTERNAL_HAZARDS_ENDPOINT}/?modelId=${Number(id)}`, override, onSuccessCallback, onFailCallback)
            .then((response) => {return response.json()}) // Parse the response as JSON
            .catch((error) => {
                console.error('Error fetching internal events:', error);
                throw error; // Re-throw the error to propagate it if needed
            });
    }

    /**
     * deletes a full scope with a given model id
     * @param id id of model
     * @param override overrides function  
     * @param onSuccessCallback run this on success, optional
     * @param onFailCallback run this on fail, optional
     * @returns a promise with the deleted full scope
     */
    static async deleteFullScope(id = -1, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback): Promise<InternalEventsModel[]> {
        await NestedModelApiManager.removeParentIds(id)
        return await TypedModelApiManager.delete(`${FULL_SCOPE_ENDPOINT}/?modelId=${Number(id)}`, override, onSuccessCallback, onFailCallback)
            .then((response) => {return response.json()}) // Parse the response as JSON
            .catch((error) => {
                console.error('Error fetching internal events:', error);
                throw error; // Re-throw the error to propagate it if needed
            });
    }

    /**
     * deletes something, one fo the 4 model types
     * @param url the url of where we are deleting things from
     * @param id id of model
     * @param override overrides function  
     * @param onSuccessCallback run this on success, optional
     * @param onFailCallback run this on fail, optional
     * @returns a promise with the deleted model
     */
    static delete(url: any, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) {
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

    /**
     * deletes something, one fo the 4 model types
     * @param url the url of where we are deleting things from
     * @param id id of model
     * @param override overrides function  
     * @param onSuccessCallback run this on success, optional
     * @param onFailCallback run this on fail, optional
     * @returns a promise with the deleted model
     */
    static deleteWithData(url: any, data: any, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) {
        return fetch(url, {
            method: 'DELETE',
            cache: OPTION_CACHE,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `JWT ${AuthService.getEncodedToken()}`,
            },
            body: data
        }).then(res => (res.ok ? onSuccessCallback(res, override) : onFailCallback(res, override)))
            .catch(err => onFailCallback(err, override));
    }

    /**
     * puts the nested model's id at the appropriate endpoint
     * @param body contains a model id number, a nested id number, and a nested type that is a string of the camel case of the nested model type
     * @param override 
     * @param onSuccessCallback 
     * @param onFailCallback 
     * @returns a promise with the updated model
     */
    static addNestedToInternalEvent(body:{modelId: number, nestedId: number, nestedType: string}, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) : Promise<InternalEventsModel> {
        return TypedModelApiManager.patch(`${INTERNAL_EVENTS_ENDPOINT}`, JSON.stringify(body), override, onSuccessCallback, onFailCallback)
            .then((response) => {
                return response.json()
            });
    }

    /**
     * puts the nested model's id at the appropriate endpoint
     * @param body contains a model id number, a nested id number, and a nested type that is a string of the camel case of the nested model type
     * @param override 
     * @param onSuccessCallback 
     * @param onFailCallback 
     * @returns a promise with the updated model
     */
    static addNestedToInternalHazard(body:{modelId: number, nestedId: number, nestedType: string}, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) : Promise<InternalHazardsModel> {
        return TypedModelApiManager.patch(`${INTERNAL_HAZARDS_ENDPOINT}`, JSON.stringify(body), override, onSuccessCallback, onFailCallback)
            .then((response) => {
                return response.json()
            });
    }

    /**
     * puts the nested model's id at the appropriate endpoint
     * @param body contains a model id number, a nested id number, and a nested type that is a string of the camel case of the nested model type
     * @param override 
     * @param onSuccessCallback 
     * @param onFailCallback 
     * @returns a promise with the updated model
     */
    static addNestedToExternalHazard(body:{modelId: number, nestedId: number, nestedType: string}, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) : Promise<ExternalHazardsModel> {
        return TypedModelApiManager.patch(`${EXTERNAL_HAZARDS_ENDPOINT}`, JSON.stringify(body), override, onSuccessCallback, onFailCallback)
            .then((response) => {
                return response.json()
            });
    }

    /**
     * puts the nested model's id at the appropriate endpoint
     * @param body contains a model id number, a nested id number, and a nested type that is a string of the camel case of the nested model type
     * @param override 
     * @param onSuccessCallback 
     * @param onFailCallback 
     * @returns a promise with the updated model
     */
    static addNestedToFullScope(body:{modelId: number, nestedId: number, nestedType: string}, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) : Promise<FullScopeModel> {
        return TypedModelApiManager.patch(`${FULL_SCOPE_ENDPOINT}`, JSON.stringify(body), override, onSuccessCallback, onFailCallback)
            .then((response) => {
                return response.json()
            });
    }

    //deleting nested models

    /**
     * removes the nested model's id at the appropriate endpoint
     * @param body contains a model id number, a nested id number, and a nested type that is a string of the camel case of the nested model type
     * @param override 
     * @param onSuccessCallback 
     * @param onFailCallback 
     * @returns a promise with the updated model
     */
    static deleteNestedFromInternalEvent(modelId: number, body:{nestedId: number, nestedType: string}, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) : Promise<InternalEventsModel> {
        return TypedModelApiManager.patch(`${INTERNAL_EVENTS_ENDPOINT}/${modelId}/${DELETE_NESTED_END}`, JSON.stringify(body), override, onSuccessCallback, onFailCallback)
            // .then((response) => {
            //     return response.json()
            // });
    }

    /**
     * removes the nested model's id at the appropriate endpoint
     * @param body contains a model id number, a nested id number, and a nested type that is a string of the camel case of the nested model type
     * @param override 
     * @param onSuccessCallback 
     * @param onFailCallback 
     * @returns a promise with the updated model
     */
    static deleteNestedFromInternalHazard(modelId: number, body:{nestedId: number, nestedType: string}, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) : Promise<InternalHazardsModel> {
        return TypedModelApiManager.patch(`${INTERNAL_HAZARDS_ENDPOINT}/${modelId}/${DELETE_NESTED_END}`, JSON.stringify(body), override, onSuccessCallback, onFailCallback)
            .then((response) => {
                return response.json()
            });
    }

    /**
     * removes the nested model's id at the appropriate endpoint
     * @param body contains a model id number, a nested id number, and a nested type that is a string of the camel case of the nested model type
     * @param override 
     * @param onSuccessCallback 
     * @param onFailCallback 
     * @returns a promise with the updated model
     */
    static deleteNestedFromExternalHazard(modelId: number, body:{nestedId: number, nestedType: string}, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) : Promise<ExternalHazardsModel> {
        return TypedModelApiManager.patch(`${EXTERNAL_HAZARDS_ENDPOINT}/${modelId}/${DELETE_NESTED_END}`, JSON.stringify(body), override, onSuccessCallback, onFailCallback)
            .then((response) => {
                return response.json()
            });
    }

    /**
     * removes the nested model's id at the appropriate endpoint
     * @param body contains a model id number, a nested id number, and a nested type that is a string of the camel case of the nested model type
     * @param override 
     * @param onSuccessCallback 
     * @param onFailCallback 
     * @returns a promise with the updated model
     */
    static deleteNestedFromFullScope(modelId: number, body:{nestedId: number, nestedType: string}, override: any = null, onSuccessCallback = TypedModelApiManager.defaultSuccessCallback, onFailCallback = TypedModelApiManager.defaultFailCallback) : Promise<FullScopeModel> {
        return TypedModelApiManager.patch(`${FULL_SCOPE_ENDPOINT}/${modelId}/${DELETE_NESTED_END}`, JSON.stringify(body), override, onSuccessCallback, onFailCallback)
            .then((response) => {
                return response.json()
            });
    }
}
