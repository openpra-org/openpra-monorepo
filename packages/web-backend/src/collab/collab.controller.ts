import { HttpStatus, Controller, Options, Get, Post, Put, Delete, Request, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
// import { ApiTags } from '@nestjs/swagger';
import { CollabService } from './collab.service';
import { CreateNewUserDto } from './dtos/create-new-user.dto';
import { PaginationDto } from './dtos/pagination.dto';
import { UserPreferencesDto } from './dtos/user-preferences.dto';
import { User } from './schemas/user.schema';

// @ApiTags('Collab Endpoints')
@Controller()
export class CollabController {
    constructor(private collabService: CollabService) {}

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

    @Options('/model/')
    async getCollabModelList_Options() {}

    @Options('/model/:model_id/')
    async getCollabModelById_deleteCollabModelById_Options() {}

    @Options('/user/')
    async getUsersList_createNewUser_Options() {}

    @Options('/user/:user_id/preferences/')
    async getUserPreferences_updateUserPreferences_Options() {}

    /*
        GET Request -> https://staging.app.openpra.org/api/collab/model/?type=hcl
        GET Request -> https://staging.app.openpra.org/api/collab/model/?type=hcl&limit=10&offset=0
        Retrieves the Model list created by or assigned to the current user. The request can take up to 3 Query parameters:
            1. type: The type of the Model. The web-app is supposed to support 8 types of Models: bayesian, circsim, expert, gsn, hcl, omf, phoenix, and pf.
                     Currently the web-app supports only the HCL (Hybrid Causal Logic) Models.
            2. Limit: Indicates how many Models can be showed per page.
            3. Offset: Indicates how many Models should be skipped initially.
            For example - if the limit is 10 and the offset is 5, then the web-app will show a list of Models with the ID of 6 to 15.
    */
    @UseGuards(AuthGuard('jwt'))
    @Get('/model/')
    async getCollabModelList(@Request() req, @Query() query: { type: string, limit?: any, offset?: any }): Promise<PaginationDto> {
        if(query.type === 'hcl' && !query.limit && !query.offset) {
            return this.collabService.getHclModelList(req.user.user_id, req.originalUrl, query.type, undefined, undefined);
        } else if(query.type === 'hcl' && query.limit && query.offset) {
            return this.collabService.getHclModelList(req.user.user_id, req.originalUrl, query.type, query.limit, query.offset);
        }
    }

    /*
        GET Request -> https://staging.app.openpra.org/api/collab/model/1/
        GET Request -> https://staging.app.openpra.org/api/collab/model/1/?id=1
        Retrieves the Model from the database using the Model ID. The request has 1 Path parameter: model_id, and 1 Query parameter: id.
        Both of these IDs are identical. The UserID of the current user is extracted from the request header as well through the @Request() decorator.
    */
    @UseGuards(AuthGuard('jwt'))
    @Get('/model/:model_id/')
    async getCollabModelById(@Request() req, @Param('model_id') model_id: string, @Query('id') id?: string) {
        if(id) {
            return this.collabService.getCollabModelById(req.user.user_id, id);
        }
        return this.collabService.getCollabModelById(req.user.user_id, model_id);
    }

    /*
        DELETE Request -> https://staging.app.openpra.org/api/collab/model/1/
        Deletes a model from the database using the Model ID. The request has 1 Path parameter: model_id.
        The UserID of the current user is also extracted from the 'user' object of the request header using the @Request() decorator.
    */
    @UseGuards(AuthGuard('jwt'))
    @Delete('/model/:model_id/')
    async deleteCollabModelById(@Request() req, @Param('model_id') model_id: string): Promise<HttpStatus> {
        return this.collabService.deleteCollabModelById(req.user.user_id, model_id);
    }

    /*
        GET Request -> https://staging.app.openpra.org/api/collab/user/
        GET Request -> https://staging.app.openpra.org/api/collab/user/?limit=10&offset=0
        Retrieves the User list from the database. The request can have up to 2 Query parameters: limit and offset.
    */
    @UseGuards(AuthGuard('jwt'))
    @Get('/user/')
    async getUsersList(@Request() req, @Query() query: { limit?: any, offset?: any }): Promise<PaginationDto> {
        if(query.limit && query.offset) {
            return this.collabService.getUsersList(req.originalUrl, query.limit, query.offset);
        }
        return this.collabService.getUsersList(req.originalUrl, undefined, undefined);
    }

    /*
        POST Request -> https://staging.app.openpra.org/api/collab/user/
        No authentication is required for creating a user. An example of the request body for creating a user:
        {
            "first_name":"Edward",
            "last_name":"Elric",
            "email":"fullmetal_alchemist@gmail.com",
            "username":"Ed",
            "password":"WinryRockbell"
        }
    */
    @Post('/user/')
    async createNewUser(@Body() body: CreateNewUserDto): Promise<User> {
        return this.collabService.createNewUser(body);
    }


    /*
        GET Request -> https://staging.app.openpra.org/api/collab/user/1/preferences/
        Retrieves the preferred settings of the user for the tree editor.
    */
    @UseGuards(AuthGuard('jwt'))
    @Get('/user/:user_id/preferences/')
    async getUserPreferences(@Param('user_id') user_id: string) {
        return this.collabService.getUserPreferences(user_id);
    }

    /*
        PUT Request -> https://staging.app.openpra.org/api/collab/user/1/preferences/
        Updates the user preferences for the tree editor settings. An example of the request body for updating the user preferences:
        {
            "preferences":
                {
                    "theme": "Light",
                    "nodeIdsVisible": false,
                    "outlineVisible": false,
                    "node_value_visible": true,
                    "nodeDescriptionEnabled": true,
                    "pageBreaksVisible": false
                }
        }
    */
    @UseGuards(AuthGuard('jwt'))
    @Put('/user/:user_id/preferences/')
    async updateUserPreferences(@Param('user_id') user_id: string, @Body() body: UserPreferencesDto) {
        return this.collabService.updateUserPreferences(user_id, body);
    }
}
