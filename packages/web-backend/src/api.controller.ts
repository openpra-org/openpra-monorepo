import { Controller, Options, Get, Request, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
// import { ApiTags } from '@nestjs/swagger';
import { ApiService } from './api.service';

// @ApiTags('Search Collab Model')
@Controller()
export class ApiController {
    constructor(private apiService: ApiService) {}

    /*
        'Preflighted' requests are sent to the server via OPTIONS request method to find out:
            1. Which 'origin' is permitted to make request to these URLs.
            2. What kind of 'request methods' (e.g. GET, POST, PATCH, PUT, DELETE request methods) are permitted on these URLs.
            3. Which 'request headers' are permitted.
            4. How long these permissions can be cached.
        To find out more about OPTIONS request methods, visit:
            https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/OPTIONS and go through the 'Preflighted requests in CORS' section.
        All the configurations for the Preflighted requests for this project are available in 'src/main.ts' file under app.enableCors() method.
    */

    @Options('/collab/model/search/')
    async searchCollabModel_Options() {}

    /*
        GET Request -> https://staging.app.openpra.org/api/collab/model/search/?key=Model%201&type=hcl
        GET Request -> https://staging.app.openpra.org/api/collab/model/search/?key=Model%201&type=hcl&limit=10&offset=0
        Retrieves the Model / list of Models based on the keywords (key) provided by the user in the search bar. If there's a blank space in the keyword, that's
        replaced by '%20' automatically by the browser. So in case of the above url, the key 'Model%201' actually is 'Model 1'. The url can have up to 4 Query
        parameters:
            1. key: The name of the Model the user is looking for; short term for 'keywords'.
            2. type: Type of the Model. There should be 8 types of Models available on the app. Right now, only the HCL Model type is available.
            3. limit: Indicates how many Models can be showed per page.
            4. Offset: Indicates how many Models should be skipped initially.
    */
    @UseGuards(AuthGuard('jwt'))
    @Get('/collab/model/search/')
    async searchCollabModel(@Request() req, @Query() query: { key: string, type: string, limit?: any, offset?: any }) {
        if(query.limit && query.offset) {
            return this.apiService.searchCollabModel(req.user.user_id, query.key, query.type, req.originalUrl, query.limit, query.offset);
        } else {
            return this.apiService.searchCollabModel(req.user.user_id, query.key, query.type, req.originalUrl, undefined, undefined);
        }
    }
}
