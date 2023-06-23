import { Controller, Options } from '@nestjs/common';

/**
* 'Preflighted' requests are sent to the server via OPTIONS request method to find out:
*   1. Which 'origin' is permitted to make request to these URLs.
*   2. What kind of 'request methods' (e.g. GET, POST, PATCH, PUT, DELETE request methods) are permitted on these URLs.
*   3. Which 'request headers' are permitted.
*   4. How long these permissions can be cached.
* To find out more about OPTIONS request methods, visit: {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/OPTIONS}
* and go through the 'Preflighted requests in CORS' section.
* All the configurations for the Preflighted requests for this project are available in 'src/main.ts' file under app.enableCors() method.
*/
@Controller()
export class OptionsController {
    @Options('/auth/token-obtain/')
    async loginUser_Options() {}

    @Options('/collab/model/')
    async getCollabModelList_Options() {}

    @Options('/collab/model/search/')
    async searchCollabModel_Options() {}

    @Options('/collab/model/:model_id/')
    async getCollabModelById_deleteCollabModelById_Options() {}

    @Options('/collab/user/')
    async getUsersList_createNewUser_Options() {}

    @Options('/collab/user/:user_id/preferences/')
    async getUserPreferences_updateUserPreferences_Options() {}

    @Options('/hcl/data/')
    async getHclModelData_Options() {}

    @Options('/hcl/data/gates/')
    async getHclModelGatesData_Options() {}

    @Options('/hcl/model/')
    async getHclModelList_createHclModel_Options() {}

    @Options('/hcl/model/:model_id/')
    async getHclModelById_updateHclModelById_deleteHclModelById_Options() {}

    @Options('/hcl/model/:model_id/copy/')
    async copyHclModelById_Options() {}

    @Options('/hcl/model/:model_id/overview_tree/')
    async getHclModelOverviewTreeByModelId_Options() {}

    @Options('/hcl/model/:model_id/parameter/')
    async getGlobalParameterListByModelId_createGlobalParameterByModelId_Options() {}

    @Options('/hcl/model/:model_id/parameter/:parameter_id/')
    async partialUpdateGlobalParameterByModelAndParameterId_DeleteGlobalParameterByModelAndParameterId_Options() {}

    @Options('/hcl/model/:model_id/quantification/')
    async hclModelQuantificationById_Options() {}

    @Options('/hcl/model/:model_id/tree/')
    async getHclModelTreeListByModelId_createHclModelTreeByModelId_Options() {}

    @Options('/hcl/tree/')
    async getHclTreeList_Options() {}

    @Options('/hcl/tree/:tree_id/')
    async getHclTreeById_updateHclTreeById_deleteHclTreeById_Options() {}

    @Options('/hcl/tree/:tree_id/copy/')
    async copyHclTreeById_Options() {}
}