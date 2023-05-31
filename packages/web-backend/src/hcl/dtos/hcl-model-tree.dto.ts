import { IsObject, IsOptional, IsString } from 'class-validator';

export class HclModelTreeDto {
    @IsString()
    title: string;

    @IsString()
    description: string;

    @IsString()
    tree_type: string;

    @IsOptional()
    @IsObject()
    tree_data: object;
}