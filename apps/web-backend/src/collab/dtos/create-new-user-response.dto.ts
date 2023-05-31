import { Expose } from "class-transformer";

export class CreateNewUserResponseDto {
    @Expose()
    id: number;

    @Expose()
    username: string;

    @Expose()
    name: string;

    @Expose()
    email: string;

    @Expose()
    last_login: string;

    @Expose()
    recently_accessed: any;

    @Expose()
    preferences: any;

    @Expose()
    permissions: any;
}