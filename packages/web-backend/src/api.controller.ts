import { Controller, Get, Post, Request, Query, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiService } from './api.service';
import { CreateNewUserDto } from './collab/dtos/create-new-user.dto';
import { PaginationDto } from './collab/dtos/pagination.dto';
import { User } from './collab/schemas/user.schema';

@Controller()
export class ApiController {
    constructor(private apiService: ApiService) {}

    /**
    * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
    * @param query Query string parameters
    * @returns List of models that match with the provided keyword in the search bar
    * @example GET request -> https://staging.app.openpra.org/api/collab/model/search/?key=Model%201&type=hcl
    * @example GET request -> https://staging.app.openpra.org/api/collab/model/search/?key=Model%201&type=hcl&limit=10&offset=0
    */
    @UseGuards(AuthGuard('jwt'))
    @Get('/collab/model/search/')
    async searchCollabModel(@Request() req, @Query() query: { key: string, type: string, limit?: string, offset?: string }): Promise<PaginationDto> {
        if(query.limit && query.offset) {
            return this.apiService.searchCollabModel(req.user.user_id, query.key, query.type, req.originalUrl, query.limit, query.offset);
        } else {
            return this.apiService.searchCollabModel(req.user.user_id, query.key, query.type, req.originalUrl, undefined, undefined);
        }
    }

    /**
    * @param body Request body
    * @example Request body sample:
    * {
    *   "first_name":"Edward",
    *   "last_name":"Elric",
    *   "email":"fullmetal_alchemist@gmail.com",
    *   "username":"Ed",
    *   "password":"WinryRockbell"
    * }
    * @returns A mongoose document of the new user
    * @example POST request -> https://staging.app.openpra.org/api/collab/user/
    */
    @Post('/collab/user/')
    async createNewUser(@Body() body: CreateNewUserDto): Promise<User> {
        return this.apiService.createNewUser(body);
    }
}