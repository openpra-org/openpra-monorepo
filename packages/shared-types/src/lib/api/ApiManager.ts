import Axios, {AxiosResponse} from "axios";

import AuthService from './AuthService';
import Accounts from "./Accounts";
import Admin from "./Admin";
import {SignUpCredentials} from "./AuthTypes";
import AuthToken from "../types/AuthToken";
import Preferences from "./user/Preferences";

const API_ENDPOINT = '/api';

const collabEndpoint = `${API_ENDPOINT}/collab`;
const instanceEndPoint = `${collabEndpoint}/instance`;
const hclEndpoint = `${API_ENDPOINT}/hcl`;
const beEndpoint = `${API_ENDPOINT}/bayesian`;
const csEndpoint = `${API_ENDPOINT}/circsim`;
const esEndpoint = `${API_ENDPOINT}/expert`;
const pfEndpoint = `${API_ENDPOINT}/pf`;
const componentEndpoint = `${API_ENDPOINT}/components`;
const authEndpoint = `${API_ENDPOINT}/auth`;
const userPreferencesEndpoint = `${collabEndpoint}/user`;

const OPTION_CACHE = 'no-cache'; // *default, no-cache, reload, force-cache, only-if-cached

export default class ApiManager {

  getTreeWithMetaData(treeId: number, onSuccess: (response: AxiosResponse) => void): void {
    throw new Error("getTreeWithMetaData not implemented in class ApiManager");
  }

  /**
   * GET with authorization token
   * @param url
   * @param onSuccess
   * @param onFailure
   */
  get(url: string, onSuccess: (response: AxiosResponse) => void, onFailure: (e: any) => void = (e: any) => {}) {
    Axios.get(url, {
      headers: {
        Authorization: `JWT ${AuthService.getEncodedToken()}`
      }
    }).then(onSuccess).catch(onFailure);
  }

  // TODO: remove all static keywords
  static API_ENDPOINT = API_ENDPOINT;

  static MODEL_PATH = '/model';

  static COMPONENT_PATH = '/components';

  static PROJECT_PATH = '/project';

  static SUBSYSTEM_PATH = '/subsystem';

  static TREE_PATH = '/tree';

  static LOGIN_URL = `${authEndpoint}/token-obtain/`;

  static REFRESH_URL = `${authEndpoint}/token-refresh/`;

  static TAG_CHOICES = {
    project: 'PR',
    component: 'CO',
    mission: 'MI',
    subsystem: 'SU',
  };

  static SNACKBAR_PROVIDER = null;

  public get accountsApi(): Accounts { return new Accounts(collabEndpoint); }

  public get adminApi(): Admin { // @ts-ignore
    return new Admin(API_ENDPOINT); }

  /**
   * @param {Response} res - response object from API call
   * @param {Object} override - ordinary object with the following (optional) properties:
   *    successText: string,
   *    failText: string,
   *    snackbarProps: {
   *        persist: bool - prevent auto dismissal
   *        preventDuplicate: bool - prevent multiple snackbars w/ same message (DOES NOT WORK)
   *        autoHideDuration: int - how long snackbar should display for
   *    },
   *    showSuccess: bool (default: false) - enable success snackbar messages,
   *    showFailure: bool (default: true) - enable failure snackbar messages,
   */
  static callSnackbar(status: any, res: any, override: any) {
    //TODO::
  }

  static defaultSuccessCallback(res: any, override: any) {
    try {
      const { showSuccess } = override;
      if (ApiManager.SNACKBAR_PROVIDER && showSuccess) {
        ApiManager.callSnackbar('success', res, override);
      }
    } catch {

    }
    return res;
  }

  static defaultFailCallback(res: any, override: any) {
    try {
      const { showFailure } = override;
      if (ApiManager.SNACKBAR_PROVIDER && showFailure) {
        ApiManager.callSnackbar('error', res, override);
      }
    } catch {

    }
    return res;
  }

  /* base GET request */
  static getWithOptions(url: any, override: any = null, onSuccessCallback = ApiManager.defaultSuccessCallback, onFailCallback = ApiManager.defaultFailCallback) {
    return fetch(url, {
      method: 'GET', // *GET, POST, PUT, DELETE, etc.
      headers: {
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
    }).then(res => (res.ok ? onSuccessCallback(res, override) : onFailCallback(res, override)))
      .catch(err => onFailCallback(err, override));
  }

  static logout() {
    return AuthService.logout();
  }

  static login(creds: any) {
    return fetch(ApiManager.LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(creds),
    }).then(res => res.json())
      .then((data) => { AuthService.setEncodedToken(data.token); });
  }

  /**
   * Attempts to sign a user in using username and password.
   *
   * @method signInWithUsernameAndPassword
   * @param {string} username - The user's username
   * @param {string} password - The user's password
   * @param {function} onFailCallback - Asynchronous exception handler
   * @return {Promise} Promise of a non-null User object (newly signed in)
   * @throws {Error} - A possible authentication error
   */
  static signInWithUsernameAndPassword(username: any, password: any, onFailCallback: any = ApiManager.defaultFailCallback) {
    return fetch(ApiManager.LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
      }),
    }).then((response) => {
      if (response.ok) {
        return response;
      }
      throw new Error(response.statusText);
    }).then(res => res.json())
      .then((data) => { AuthService.setEncodedToken(data.token); })
      .catch(onFailCallback);
  }

  signInWithUsernameAndPassword(username: any, password: any, onFailCallback: any) {
    return ApiManager.signInWithUsernameAndPassword(username, password, onFailCallback);
  }

  static signup(data: SignUpCredentials, override: any = null, onSuccessCallback: any = ApiManager.defaultSuccessCallback, onFailCallback: any = ApiManager.defaultFailCallback) {
    return ApiManager.post(`${userPreferencesEndpoint}/`, JSON.stringify(data), override, onSuccessCallback, onFailCallback)
      .then((response) => {
        if (response.ok) {
          return ApiManager.signInWithUsernameAndPassword(data.username, data.password, onFailCallback);
        }
        throw new Error(response.statusText);
      });
  }

  signup(username: string, email: string, firstName: string, lastName: string, password: string, override: any = null, onSuccessCallback: any = ApiManager.defaultSuccessCallback, onFailCallback: any = ApiManager.defaultFailCallback) {
    const data: SignUpCredentials = {
      username,
      email,
      firstName,
      lastName,
      password
    }
    return ApiManager.signup(data, override, onSuccessCallback, onFailCallback);
  }

  static checkStatus(response: any) {
    // raises an error in case response status is not a success
    if (response.status >= 200 && response.status < 300) { // Success status lies between 200 to 300
      return response;
    }
    throw new Error(response.statusText);
  }

  static isLoggedIn() {
    // Checks if there is a saved token and it's still valid
    const token = AuthService.getEncodedToken(); // Getting token from localstorage
    if (AuthService.hasTokenExpired(token)) this.logout();
    return (token != null) && !AuthService.hasTokenExpired(token);
  }

  isLoggedIn() {
    return ApiManager.isLoggedIn();
  }

  static getCurrentUser(): AuthToken {
    return AuthService.getProfile();
  }

  static get(endpoint: any, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    return ApiManager.getWithOptions(API_ENDPOINT + endpoint, override, onSuccessCallback, onFailCallback);
  }

  static getFromHost(endpoint: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(API_ENDPOINT + endpoint, override, onSuccessCallback, onFailCallback);
  }

  static getCollab(endpoint: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(collabEndpoint + endpoint, override, onSuccessCallback, onFailCallback);
  }

  static searchCollab(keyword: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${collabEndpoint}/search/?key=${keyword}`, override, onSuccessCallback, onFailCallback);
  }

  static searchCollabModels(keyword: any, limit: any, offset: any, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    if (limit) {
      return ApiManager.getWithOptions(`${collabEndpoint}/model/search/?key=${keyword}&limit=${limit}&offset=${offset}`, override, onSuccessCallback, onFailCallback);
    }
    return ApiManager.getWithOptions(`${collabEndpoint}/model/search/?key=${keyword}`, override, onSuccessCallback, onFailCallback);
  }

  static searchCollabModelsForType(keyword: any, type: any, limit: any, offset: any, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    if (limit) {
      return ApiManager.getWithOptions(`${collabEndpoint}/model/search/?key=${keyword}&type=${type}&limit=${limit}&offset=${offset}`, override, onSuccessCallback, onFailCallback);
    }
    return ApiManager.getWithOptions(`${collabEndpoint}/model/search/?key=${keyword}&type=${type}`, override, onSuccessCallback, onFailCallback);
  }

  static searchCollabSubsystems(keyword: any, limit: any, offset: any, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    if (limit) {
      return ApiManager.getWithOptions(`${collabEndpoint}/subsystem/search/?key=${keyword}&limit=${limit}&offset=${offset}`, override, onSuccessCallback, onFailCallback);
    }
    return ApiManager.getWithOptions(`${collabEndpoint}/subsystem/search/?key=${keyword}`, override, onSuccessCallback, onFailCallback);
  }

  static searchCollabProjects(keyword: any, limit: any, offset: any, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    if (limit) {
      return ApiManager.getWithOptions(`${collabEndpoint}/project/search/?key=${keyword}&limit=${limit}&offset=${offset}`, override, onSuccessCallback, onFailCallback);
    }
    return ApiManager.getWithOptions(`${collabEndpoint}/project/search/?key=${keyword}`, override, onSuccessCallback, onFailCallback);
  }

  static getComponents(limit: any, offset: any, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    if (limit) {
      return ApiManager.getWithOptions(`${componentEndpoint}/model/?limit=${limit}&offset=${offset}`, override, onSuccessCallback, onFailCallback);
    }
    return ApiManager.getWithOptions(`${componentEndpoint}/model/`, override, onSuccessCallback, onFailCallback);
  }

  static getComponentTypes(override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${componentEndpoint}/type/`, override, onSuccessCallback, onFailCallback);
  }

  static getComponent(endpoint: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(componentEndpoint + endpoint, override, onSuccessCallback, onFailCallback);
  }

  static getComponentById(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${componentEndpoint}/model/${id}/`, override, onSuccessCallback, onFailCallback);
  }

  static getComponentArticleById(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${componentEndpoint}/model/${id}/article/`, override, onSuccessCallback, onFailCallback);
  }

  static getComponentArticleByType(type: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${componentEndpoint}/type/${type}/article/`, override, onSuccessCallback, onFailCallback);
  }

  static quantifyComponent(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.emptyPost(`${componentEndpoint}${ApiManager.MODEL_PATH}/${id}/quantification/`, override, onSuccessCallback, onFailCallback);
  }

  static patchComponent(id: any, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.patch(`${componentEndpoint}${ApiManager.MODEL_PATH}/${id}/`, data, override, onSuccessCallback, onFailCallback);
  }

  static deleteComponent(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.delete(`${componentEndpoint}${ApiManager.MODEL_PATH}/${id}/`, override, onSuccessCallback, onFailCallback);
  }

  static reQuantifyComponent(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.emptyPut(`${componentEndpoint}${ApiManager.MODEL_PATH}/${id}/quantification/`, override, onSuccessCallback, onFailCallback);
  }

  static getUsers(limit: any, offset: any, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    if (limit) {
      return ApiManager.getWithOptions(`${collabEndpoint}/user/?limit=${limit}&offset=${offset}`, override, onSuccessCallback, onFailCallback);
    }
    return ApiManager.getWithOptions(`${collabEndpoint}/user/`, override, onSuccessCallback, onFailCallback);
  }

  static getProjects(limit: any, offset: any, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    if (limit) {
      return ApiManager.getWithOptions(`${collabEndpoint}${ApiManager.PROJECT_PATH}/?limit=${limit}&offset=${offset}`, override, onSuccessCallback, onFailCallback);
    }
    return ApiManager.getWithOptions(`${collabEndpoint}${ApiManager.PROJECT_PATH}/`, override, onSuccessCallback, onFailCallback);
  }

  static getSubsystems(limit: any, offset: any, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    if (limit) {
      return ApiManager.getWithOptions(`${collabEndpoint}${ApiManager.SUBSYSTEM_PATH}/?limit=${limit}&offset=${offset}`, override, onSuccessCallback, onFailCallback);
    }
    return ApiManager.getWithOptions(`${collabEndpoint}${ApiManager.SUBSYSTEM_PATH}/`, override, onSuccessCallback, onFailCallback);
  }

  static getModels(limit: any, offset: any, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    if (limit) {
      return ApiManager.getWithOptions(`${collabEndpoint}${ApiManager.MODEL_PATH}/?limit=${limit}&offset=${offset}`, override, onSuccessCallback, onFailCallback);
    }
    return ApiManager.getWithOptions(`${collabEndpoint}${ApiManager.MODEL_PATH}/`, override, onSuccessCallback, onFailCallback);
  }

  static getTrees(limit: any, offset: any, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    if (limit) {
      return ApiManager.getWithOptions(`${hclEndpoint}${ApiManager.TREE_PATH}/?limit=${limit}&offset=${offset}`, override, onSuccessCallback, onFailCallback);
    }
    return ApiManager.getWithOptions(`${hclEndpoint}${ApiManager.TREE_PATH}/`, override, onSuccessCallback, onFailCallback);
  }

  static getModelTypes(override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${collabEndpoint}${ApiManager.MODEL_PATH}/types/`, override, onSuccessCallback, onFailCallback);
  }

  static getModelsForType(type: any, limit: any, offset: any, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    if (limit) {
      return ApiManager.getWithOptions(`${collabEndpoint}${ApiManager.MODEL_PATH}/?type=${type}&limit=${limit}&offset=${offset}`, override, onSuccessCallback, onFailCallback);
    }
    return ApiManager.getWithOptions(`${collabEndpoint}${ApiManager.MODEL_PATH}/?type=${type}`, override, onSuccessCallback, onFailCallback);
  }

  static getQuantificationResultsForModelType(type: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.get(`/${type}/quantification/`, override, onSuccessCallback, onFailCallback);
  }

  static getBayesianModelQuantificationResults(override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getQuantificationResultsForModelType('bayesian', override, onSuccessCallback, onFailCallback);
  }

  static getExpertSystemModelQuantificationResults(override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getQuantificationResultsForModelType('expert', override, onSuccessCallback, onFailCallback);
  }

  static getCircsimModelQuantificationResults(override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getQuantificationResultsForModelType('circsim', override, onSuccessCallback, onFailCallback);
  }

  static getProcessFactorModelQuantificationResults(override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getQuantificationResultsForModelType('pf', override, onSuccessCallback, onFailCallback);
  }

  static getComponentModelQuantificationResults(override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getQuantificationResultsForModelType('components', override, onSuccessCallback, onFailCallback);
  }

  static getModelData(path: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${API_ENDPOINT}${path}`, override, onSuccessCallback, onFailCallback);
  }

  static getProjectsGraphData(projectId: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${collabEndpoint}${ApiManager.PROJECT_PATH}/${projectId}/overview_graph/`, override, onSuccessCallback, onFailCallback);
  }

  static getSubsystemGraphData(subsystemId: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${collabEndpoint}${ApiManager.SUBSYSTEM_PATH}/${subsystemId}/overview_graph/`, override, onSuccessCallback, onFailCallback);
  }

  static getModelGraphData(modelId: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${collabEndpoint}${ApiManager.MODEL_PATH}/${modelId}/overview_graph/`, override, onSuccessCallback, onFailCallback);
  }

  static getSubsystemsByProjectId(projectId: any, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    return ApiManager.getWithOptions(`${collabEndpoint}${ApiManager.PROJECT_PATH}/${projectId}/subsystems/`, override, onSuccessCallback, onFailCallback);
  }

  static getModelsBySubsystemId(subsystemId: any, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    return ApiManager.getWithOptions(`${collabEndpoint}${ApiManager.SUBSYSTEM_PATH}/${subsystemId}/models/`, override, onSuccessCallback, onFailCallback);
  }

  static post(url: any, data: any, override: any = null, onSuccessCallback = ApiManager.defaultSuccessCallback, onFailCallback = ApiManager.defaultFailCallback) {
    console.log(url, data)
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

  static emptyPost(url: any, data: any, override: any = null, onSuccessCallback: any = ApiManager.defaultSuccessCallback, onFailCallback = ApiManager.defaultFailCallback) {
    return fetch(url, {
      method: 'POST',
      cache: OPTION_CACHE,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
      body: data, // body data type must match "Content-Type" header
      // @ts-ignore
    }).then(res => (res.ok ? onSuccessCallback(res) : onFailCallback(res)))
      .catch(err => onFailCallback(err, override));
  }

  static emptyPut(url: any, override: any = null, onSuccessCallback = ApiManager.defaultSuccessCallback, onFailCallback = ApiManager.defaultFailCallback) {
    return fetch(url, {
      method: 'PUT',
      cache: OPTION_CACHE,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
    }).then(res => (res.ok ? onSuccessCallback(res, override) : onFailCallback(res, override)))
      .catch(err => onFailCallback(err, override));
  }

  static put(url: any, data: any, override: any = null, onSuccessCallback = ApiManager.defaultSuccessCallback, onFailCallback = ApiManager.defaultFailCallback) {
    return fetch(url, {
      method: 'PUT',
      cache: OPTION_CACHE,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
      body: data, // body data type must match "Content-Type" header
      // @ts-ignore
    }).then(res => (res.ok ? onSuccessCallback(res) : onFailCallback(res)))
      .catch(err => onFailCallback(err, override));
  }


  static patch(url: any, data: any, override: any = null, onSuccessCallback = ApiManager.defaultSuccessCallback, onFailCallback = ApiManager.defaultFailCallback) {
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

  static delete(url: any, override: any = null, onSuccessCallback = ApiManager.defaultSuccessCallback, onFailCallback = ApiManager.defaultFailCallback) {
    return fetch(url, {
      method: 'DELETE',
      cache: OPTION_CACHE,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
      // @ts-ignore
    }).then(res => (res.ok ? onSuccessCallback(res) : onFailCallback(res)))
      .catch(err => onFailCallback(err, override));
  }

  static postNewProject(data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.post(`${collabEndpoint}${ApiManager.PROJECT_PATH}/`, data, override, onSuccessCallback, onFailCallback);
  }

  // static postGenericModel(url: string, title: string, description: string, override: any = null, onSuccessCallback = ApiManager.defaultSuccessCallback, onFailCallback = ApiManager.defaultFailCallback) {
  //   console.log(url, title, description)
  //   return fetch(url, {
  //     method: 'POST',
  //     cache: OPTION_CACHE,
  //     headers: {
  //       'Content-Type': 'application/json',
  //       Authorization: `JWT ${AuthService.getEncodedToken()}`,
  //     },
  //     body: JSON.stringify({
  //       title,
  //       description,
  //     }), // body data type must match "Content-Type" header
  //   }).then(res => (res.ok ? onSuccessCallback(res, override) : onFailCallback(res, override)))
  //     .catch(err => onFailCallback(err, override));
  // }

  static postNewModel(type: string, title: string, description: string, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    //const modelLabel = new Label(title, description)
    const modelInfo = {
      title,
      description
    }
    return ApiManager.post(`${collabEndpoint}${ApiManager.MODEL_PATH}/`, JSON.stringify(modelInfo), override, onSuccessCallback, onFailCallback);
  }

  static postNewComponent(data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.post(`${componentEndpoint}/model/`, data, override, onSuccessCallback, onFailCallback);
  }

  static postNewSubsystem(data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.post(`${collabEndpoint}${ApiManager.SUBSYSTEM_PATH}/`, data, override, onSuccessCallback, onFailCallback);
  }

  static getHCLModel(endpoint: any, limit: any, offset: any, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    if (limit) {
      return ApiManager.getWithOptions(`${hclEndpoint}${ApiManager.MODEL_PATH}${endpoint}/?limit=${limit}&offset=${offset}`, override, onSuccessCallback, onFailCallback);
    }
    return ApiManager.getWithOptions(`${hclEndpoint}${ApiManager.MODEL_PATH}${endpoint}`, override, onSuccessCallback, onFailCallback);
  }

  static patchHCLModel(id: any, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.patch(`${hclEndpoint}${ApiManager.MODEL_PATH}/${id}/`, data, override, onSuccessCallback, onFailCallback);
  }

  static getHCLTreeTypes(override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${hclEndpoint}/tree/types/`, override, onSuccessCallback, onFailCallback);
  }

  static getHCLTreeData(tID: any, mID: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${hclEndpoint}${ApiManager.MODEL_PATH}/${mID}/tree/${tID}/data/`, override, onSuccessCallback, onFailCallback);
  }

  static patchHCLTreeData(tID: any, mID: any, type: any, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    const jsonObject = {
      tree_type: type,
      tree_data: data,
    };
    const payload = JSON.stringify(jsonObject);
    return ApiManager.patch(`${hclEndpoint}${ApiManager.MODEL_PATH}/${mID}/tree/${tID}/`, payload, override, onSuccessCallback, onFailCallback);
  }

  static postHCLTree(modelId: any, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.post(`${hclEndpoint}${ApiManager.MODEL_PATH}/${modelId}/tree/`, data, override, onSuccessCallback, onFailCallback);
  }

  static quantifyHCLTree(modelId: any, treeId: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    const params = {
      configuration: {
        constructor: {
          tree_id: treeId,
        },
        quantify: {
          targets: '__all__',
          importance: {
            events: 'all',
            measures: [
              'all'
            ]
          }
        },
      },
    };
    const qp = JSON.stringify(params);
    return ApiManager.post(`${hclEndpoint}${ApiManager.MODEL_PATH}/${modelId}/quantification/`, qp, override, onSuccessCallback, onFailCallback);
  }

  static quantifyHCLTreeWithSettings(modelId: any, treeId: any, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    data.configuration.constructor = {
      // @ts-ignore
      tree_id: treeId,
    };
    const qp = JSON.stringify(data);
    return ApiManager.post(`${hclEndpoint}${ApiManager.MODEL_PATH}/${modelId}/quantification/`, qp, override, onSuccessCallback, onFailCallback);
  }

  static deleteHCLTree(modelId: any, treeId: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.delete(`${hclEndpoint}${ApiManager.MODEL_PATH}/${modelId}/tree/${treeId}/`, override, onSuccessCallback, onFailCallback);
  }

  static getHCLTreesWithType(type: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${hclEndpoint}/tree/?type=${type}`, override, onSuccessCallback, onFailCallback);
  }

  static getHCLFaultTrees(override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getHCLTreesWithType('f', override, onSuccessCallback, onFailCallback);
  }

  static getHCLEventTrees(override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getHCLTreesWithType('e', override, onSuccessCallback, onFailCallback);
  }

  static getHCLModelJson(endpoint: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${hclEndpoint}${ApiManager.MODEL_PATH}${endpoint}`, override, onSuccessCallback, onFailCallback);
  }

  static getHCLModelXml(endpoint: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getModelXml(`${hclEndpoint}${ApiManager.MODEL_PATH}${endpoint}`, override, onSuccessCallback, onFailCallback);
  }

  static searchTI(keyword: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getComponent(`/ti/?partNumber=${keyword}`, override, onSuccessCallback, onFailCallback)
      .then((response) => {
        if (response.ok) {
          return response;
        }
        const error = new Error();
        // @ts-ignore
        error.code = response.status;
        error.message = response.statusText;
        throw error;
      });
  }

  static getComponentTI(keyword: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getComponent(`/ti/${keyword}`, override, onSuccessCallback, onFailCallback);
  }

  static getComponentByName(keyword: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getComponent(`/?name=${keyword}`, override, onSuccessCallback, onFailCallback);
  }

  static getModelXml(endpoint: any, override: any = null, onSuccessCallback = ApiManager.defaultSuccessCallback, onFailCallback = ApiManager.defaultFailCallback) {
    return fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/xml',
        'Content-Type': 'application/json',
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
    }).then(response => response.text())
      // @ts-ignore
      .then(res => (res.ok ? onSuccessCallback(res) : onFailCallback(res)))
      .then((data) => {
        return (new DOMParser()).parseFromString(data, 'text/xml');
      })
      .catch(err => onFailCallback(err, override));
  }

  static getModelJson(endpoint: any, override: any = null, onSuccessCallback = ApiManager.defaultSuccessCallback, onFailCallback = ApiManager.defaultFailCallback) {
    return fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
      // @ts-ignore
    }).then(res => (res.ok ? onSuccessCallback(res) : onFailCallback(res)))
      .then(response => response.text())
      // @ts-ignore
      .catch(onFailCallback, override);
  }

  static getUser(id: any, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    return ApiManager.getWithOptions(`${collabEndpoint}/user/${id}/`, override, onSuccessCallback, onFailCallback);
  }

  static getUserByEmail(email: string, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    return ApiManager.getWithOptions(`${collabEndpoint}/user/${email}/`, override, onSuccessCallback, onFailCallback);
  }

  //change pass
  //body
  //new_passsword
  //old_password
  //double check new

  static updateUser(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.put(`${collabEndpoint}/user/${id}/`, override, onSuccessCallback, onFailCallback);
  }

  static patchUser(id: any, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.patch(`${collabEndpoint}/user/${id}/`, data, override, onSuccessCallback, onFailCallback);
  }

  static getProject(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${collabEndpoint}${ApiManager.PROJECT_PATH}/${id}/`, override, onSuccessCallback, onFailCallback);
  }

  static patchProject(id: any, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.patch(`${collabEndpoint}${ApiManager.PROJECT_PATH}/${id}/`, data, override, onSuccessCallback, onFailCallback);
  }

  static deleteProject(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.delete(`${collabEndpoint}${ApiManager.PROJECT_PATH}/${id}/`, override, onSuccessCallback, onFailCallback);
  }

  static getSubsystem(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${collabEndpoint}${ApiManager.SUBSYSTEM_PATH}/${id}/`, override, onSuccessCallback, onFailCallback);
  }

  static patchSubsystem(id: any, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.patch(`${collabEndpoint}${ApiManager.SUBSYSTEM_PATH}/${id}/`, data, override, onSuccessCallback, onFailCallback);
  }

  static deleteSubsystem(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.delete(`${collabEndpoint}${ApiManager.SUBSYSTEM_PATH}/${id}/`, override, onSuccessCallback, onFailCallback);
  }

  static getModel(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${collabEndpoint}${ApiManager.MODEL_PATH}/${id}/`, override, onSuccessCallback, onFailCallback);
  }

  static getModelOfTypeWithId(id: any, type: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${API_ENDPOINT}/${type}${ApiManager.MODEL_PATH}/${id}/`, override, onSuccessCallback, onFailCallback);
  }

  static patchModel(id: any, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.patch(`${collabEndpoint}${ApiManager.MODEL_PATH}/${id}/`, data, override, onSuccessCallback, onFailCallback);
  }

  static deleteModel(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.delete(`${collabEndpoint}${ApiManager.MODEL_PATH}/${id}/`, override, onSuccessCallback, onFailCallback);
  }

  static patchCSModel(id: any, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.patch(`${csEndpoint}${ApiManager.MODEL_PATH}/${id}/`, data, override, onSuccessCallback, onFailCallback);
  }

  static quantifyCSModel(id: any, stage: any, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.post(`${csEndpoint}${ApiManager.MODEL_PATH}/${id}/quantification/?stage=${stage}`, data, override, onSuccessCallback, onFailCallback);
  }

  static reQuantifyCSModel(id: any, stage: any, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.patch(`${csEndpoint}${ApiManager.MODEL_PATH}/${id}/quantification/${id}/?stage=${stage}`, data, override, onSuccessCallback, onFailCallback);
  }

  static patchESModel(id: any, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.patch(`${esEndpoint}${ApiManager.MODEL_PATH}/${id}/`, data, override, onSuccessCallback, onFailCallback);
  }

  static quantifyESModel(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.emptyPost(`${esEndpoint}${ApiManager.MODEL_PATH}/${id}/quantification/`, override, onSuccessCallback, onFailCallback);
  }

  static reQuantifyESModel(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.emptyPut(`${esEndpoint}${ApiManager.MODEL_PATH}/${id}/quantification/${id}/`, override, onSuccessCallback, onFailCallback);
  }

  static patchBEModel(id: any, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.patch(`${beEndpoint}${ApiManager.MODEL_PATH}/${id}/`, data, override, onSuccessCallback, onFailCallback);
  }

  static quantifyBEModel(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.emptyPost(`${beEndpoint}${ApiManager.MODEL_PATH}/${id}/quantification/`, override, onSuccessCallback, onFailCallback);
  }

  static reQuantifyBEModel(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.emptyPut(`${beEndpoint}${ApiManager.MODEL_PATH}/${id}/quantification/${id}/`, override, onSuccessCallback, onFailCallback);
  }

  static patchPFModel(id: any, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.patch(`${pfEndpoint}${ApiManager.MODEL_PATH}/${id}/`, data, override, onSuccessCallback, onFailCallback);
  }

  static quantifyPFModel(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.emptyPost(`${pfEndpoint}${ApiManager.MODEL_PATH}/${id}/quantification/`, override, onSuccessCallback, onFailCallback);
  }

  static reQuantifyPFModel(id: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.emptyPut(`${pfEndpoint}${ApiManager.MODEL_PATH}/${id}/quantification/${id}/`, override, onSuccessCallback, onFailCallback);
  }

  static getUserPreferences(userId: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${userPreferencesEndpoint}/${userId}/preferences/`, override, onSuccessCallback, onFailCallback);
  }

  getUserPreferences(userId: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.getWithOptions(`${userPreferencesEndpoint}/${userId}/preferences/`, override, onSuccessCallback, onFailCallback);
  }

  getCurrentUserPreferences(override: any, onSuccessCallback: any, onFailCallback: any) {
    const { user_id } = AuthService.getProfile();
    return this.getUserPreferences(user_id, override, onSuccessCallback, onFailCallback);
  }

  static updateUserPreferences(userId: any, data: Preferences, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.put(`${userPreferencesEndpoint}/${userId}/preferences/`, data, override, onSuccessCallback, onFailCallback);
  }

  updateUserPreferences(userId: any, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.put(`${userPreferencesEndpoint}/${userId}/preferences/`, data, override, onSuccessCallback, onFailCallback);
  }

  updateCurrentUserPreferences(data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    const { user_id } = AuthService.getProfile();
    return this.updateUserPreferences(user_id, data, override, onSuccessCallback, onFailCallback);
  }

  static copyModel(type: any, id: any, params: any, payload: any) {
    let modelTypeEndpoint = '';
    switch(type){
      case 'hcl':
        modelTypeEndpoint = hclEndpoint;
        break;
      case 'bayesian':
        modelTypeEndpoint = beEndpoint;
        break;
      case 'components':
        modelTypeEndpoint = componentEndpoint;
        break;
      case 'circsim':
        modelTypeEndpoint = csEndpoint;
        break;
      case 'expert':
        modelTypeEndpoint = esEndpoint;
        break;
      case 'pf':
        modelTypeEndpoint = pfEndpoint;
        break;
      default:
        return;
    }
    const modelParams = params !== null ? `?${params}` : "";
    return ApiManager.post(`${modelTypeEndpoint}/model/${id}/copy/${modelParams}`, JSON.stringify(payload));
  }

  static getHCLModelsByTag(tag: string, limit?: number, offset?: number, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    if (limit) {
      return ApiManager.getWithOptions(`${hclEndpoint}/model/?tag=${tag}&limit=${limit}&offset=${offset}`, override, onSuccessCallback, onFailCallback);
    }
    return ApiManager.getWithOptions(`${hclEndpoint}/model/?tag=${tag}`, override, onSuccessCallback, onFailCallback);
  }

  static searchHCLModelsWithTagByKeyword(key: string, tag: string, limit?: number, offset?: number, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    if (limit) {
      return ApiManager.getWithOptions(`${hclEndpoint}/model/search/?key=${key}&tag=${tag}&limit=${limit}&offset=${offset}`, override, onSuccessCallback, onFailCallback);
    }
    return ApiManager.getWithOptions(`${hclEndpoint}/model/search/?key=${key}&tag=${tag}`, override, onSuccessCallback, onFailCallback);
  }

  static getHCLProjects(limit?: number, offset?: number, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    return ApiManager.getHCLModelsByTag(ApiManager.TAG_CHOICES.project, limit, offset, override, onSuccessCallback, onFailCallback);
  }

  static getHCLComponents(limit?: number, offset?: number, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    return ApiManager.getHCLModelsByTag(ApiManager.TAG_CHOICES.component, limit, offset, override, onSuccessCallback, onFailCallback);
  }

  static getHCLSubsystems(limit?: number, offset?: number, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    return ApiManager.getHCLModelsByTag(ApiManager.TAG_CHOICES.subsystem, limit, offset, override, onSuccessCallback, onFailCallback);
  }

  static searchHCLProjectsByKeyword(key: string, limit?: number, offset?: number, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    const tag = ApiManager.TAG_CHOICES.project;
    return ApiManager.searchHCLModelsWithTagByKeyword(key, tag, limit, offset, override, onSuccessCallback, onFailCallback);
  }

  static searchHCLMissionsByKeyword(key: string, limit?: number, offset?: number, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    const tag = ApiManager.TAG_CHOICES.mission;
    return ApiManager.searchHCLModelsWithTagByKeyword(key, tag, limit, offset, override, onSuccessCallback, onFailCallback);
  }

  static searchHCLSubsystemsByKeyword(key: string, limit?: number, offset?: number, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    const tag = ApiManager.TAG_CHOICES.subsystem;
    return ApiManager.searchHCLModelsWithTagByKeyword(key, tag, limit, offset, override, onSuccessCallback, onFailCallback);
  }

  static searchHCLComponentsByKeyword(key: string, limit?: number, offset?: number, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    const tag = ApiManager.TAG_CHOICES.component;
    return ApiManager.searchHCLModelsWithTagByKeyword(key, tag, limit, offset, override, onSuccessCallback, onFailCallback);
  }

  static getTreesByModelId(id: number, limit?: number, offset?: number, override?: any, onSuccessCallback?: any, onFailCallback?: any) {
    if (limit) {
      return ApiManager.getWithOptions(`${hclEndpoint}/model/${id}/tree/?limit=${limit}&offset=${offset}`, override, onSuccessCallback, onFailCallback);
    }
    return ApiManager.getWithOptions(`${hclEndpoint}/model/${id}/tree/`, override, onSuccessCallback, onFailCallback);
  }

  static createNewInstanceForModelWithId(modelId: number, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    data.source = modelId;
    data = JSON.stringify(data);
    return ApiManager.post(`${instanceEndPoint}/`, data, override, onSuccessCallback, onFailCallback);
  }

  static deleteInstance(id: number, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.delete(`${instanceEndPoint}/${id}`, override, onSuccessCallback, onFailCallback);
  }

  static patchInstance(id: number, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.patch(`${instanceEndPoint}/${id}`, data, override, onSuccessCallback, onFailCallback);
  }

  static putInstance(id: number, data: any, override: any, onSuccessCallback: any, onFailCallback: any) {
    return ApiManager.put(`${instanceEndPoint}/${id}`, data, override, onSuccessCallback, onFailCallback);
  }
}

