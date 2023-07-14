import { HttpStatus, Controller, Get, Put, Delete, Request, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CollabService } from './collab.service';
import { PaginationDto } from './dtos/pagination.dto';
import { UserPreferencesDto } from './dtos/user-preferences.dto';
import { HclModel } from '../hcl/schemas/hcl-model.schema';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class CollabController {
    constructor(private collabService: CollabService) {}
    
    /**
    * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
    * @param query Query string parameters
    * @returns List of models
    * @example GET request -> https://staging.app.openpra.org/api/collab/model/?type=hcl
    * @example GET request -> https://staging.app.openpra.org/api/collab/model/?type=hcl&limit=10&offset=0
    */
    @Get('/model/')
    async getCollabModelList(@Request() req, @Query() query: { type: string, limit?: string, offset?: string }): Promise<PaginationDto> {
        if(query.type === 'hcl' && !query.limit && !query.offset) {
            return this.collabService.getHclModelList(req.user.user_id, req.originalUrl, query.type, undefined, undefined);
        } else if(query.type === 'hcl' && query.limit && query.offset) {
            return this.collabService.getHclModelList(req.user.user_id, req.originalUrl, query.type, query.limit, query.offset);
        }
    }

    /**
    * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
    * @param {string} model_id ID of the model
    * @param {string} id ID of the model
    * @returns Model that matches with the provided ID
    * @example GET request -> https://staging.app.openpra.org/api/collab/model/1/
    * @example GET request -> https://staging.app.openpra.org/api/collab/model/1/?id=1
    */
    @Get('/model/:model_id/')
    async getCollabModelById(@Request() req, @Param('model_id') model_id: string, @Query('id') id?: string): Promise<HclModel> {
        if(id) {
            return this.collabService.getCollabModelById(req.user.user_id, id);
        }
        return this.collabService.getCollabModelById(req.user.user_id, model_id);
    }

    /**
    * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
    * @param {string} model_id ID of the model
    * @returns 204 HTTP status @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/204}
    * @example DELETE request -> https://staging.app.openpra.org/api/collab/model/1/
    */
    @Delete('/model/:model_id/')
    async deleteCollabModelById(@Request() req, @Param('model_id') model_id: string): Promise<HttpStatus> {
        return this.collabService.deleteCollabModelById(req.user.user_id, model_id);
    }

    /**
    * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
    * @param query Query string parameters
    * @returns List of all users
    * @example GET request -> https://staging.app.openpra.org/api/collab/user/
    * @example GET request -> https://staging.app.openpra.org/api/collab/user/?limit=10&offset=0
    */
    @Get('/user/')
    async getUsersList(@Request() req, @Query() query: { limit?: any, offset?: any }): Promise<PaginationDto> {
        if(query.limit && query.offset) {
            return this.collabService.getUsersList(req.originalUrl, query.limit, query.offset);
        }
        return this.collabService.getUsersList(req.originalUrl, undefined, undefined);
    }

    /**
    * @param {string} user_id ID of the user
    * @returns {Type} Preferences of the user
    * @example GET request -> https://staging.app.openpra.org/api/collab/user/1/preferences/
    */
    @Get('/user/:user_id/preferences/')
    async getUserPreferences(@Param('user_id') user_id: string) {
        return this.collabService.getUserPreferences(user_id);
    }

    /**
    * @param {string} user_id ID of the user
    * @param body Request body
    * @example Request body sample:
    * {
    *   "preferences":
    *     {
    *       "theme": "Light",
    *       "nodeIdsVisible": false,
    *       "outlineVisible": false,
    *       "node_value_visible": true,
    *       "nodeDescriptionEnabled": true,
    *       "pageBreaksVisible": false
    *     }
    * }
    * @returns Updated preferences of the user
    * @example PUT Request -> https://staging.app.openpra.org/api/collab/user/1/preferences/
    */
    @Put('/user/:user_id/preferences/')
    async updateUserPreferences(@Param('user_id') user_id: string, @Body() body: UserPreferencesDto) {
        return this.collabService.updateUserPreferences(user_id, body);
    }
}
