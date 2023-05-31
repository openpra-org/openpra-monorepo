import { IsNumber, IsString } from 'class-validator';

export class HclModelDto {
    @IsString()
    title: string;

    @IsString()
    description: string;

    @IsNumber({}, { each: true })
    assigned_users: number[];
}