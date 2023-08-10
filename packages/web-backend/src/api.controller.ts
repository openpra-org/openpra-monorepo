import { Controller, Get, Options, Query, UseGuards } from '@nestjs/common';
import { ApiService } from './api.service';
import { AuthGuard } from '@nestjs/passport';

@Controller()
export class ApiController {
    constructor(private apiService: ApiService) {}

    // /**
    // * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
    // * @param query Query string parameters
    // * @returns List of models that match with the provided keyword in the search bar
    // * @example GET request -> https://staging.app.openpra.org/api/collab/model/search/?key=Model%201&type=hcl
    // * @example GET request -> https://staging.app.openpra.org/api/collab/model/search/?key=Model%201&type=hcl&limit=10&offset=0
    // */
    // @UseGuards(AuthGuard('jwt'))
    // @Get('/collab/model/search/')
    // async searchCollabModel(@Request() req, @Query() query: { key: string, type: string, limit?: string, offset?: string }): Promise<PaginationDto> {
    //     if(query.limit && query.offset) {
    //         return this.apiService.searchCollabModel(req.user.user_id, query.key, query.type, req.originalUrl, query.limit, query.offset);
    //     } else {
    //         return this.apiService.searchCollabModel(req.user.user_id, query.key, query.type, req.originalUrl, undefined, undefined);
    //     }
    }
