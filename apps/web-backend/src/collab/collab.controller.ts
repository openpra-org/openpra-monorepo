import { Controller, Post, Body } from '@nestjs/common';
import { CollabService } from './collab.service';
import { CreateNewUserDto } from './dtos/create-new-user.dto';
import { CreateNewUserResponseDto } from './dtos/create-new-user-response.dto';
import { User } from './schemas/user.schema';
import { Serialize } from './interceptors/serialize.interceptor';

@Controller()
export class CollabController {
    constructor(private collabService: CollabService) {}

    @Serialize(CreateNewUserResponseDto)
    @Post('/user/')
    async createNewUser(@Body() body: CreateNewUserDto) : Promise<User> {
        return this.collabService.createNewUser(body);
    }
}