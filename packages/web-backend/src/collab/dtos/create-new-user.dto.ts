import { IsEmail, IsString } from 'class-validator';

export class CreateNewUserDto {
    @IsString()
    first_name: string;

    @IsString()
    last_name: string;

    @IsString()
    username: string;

    @IsEmail()
    @IsString()
    email: string;

    @IsString()
    password: string;
}