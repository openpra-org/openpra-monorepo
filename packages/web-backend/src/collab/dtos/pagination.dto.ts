import { IsArray, IsNumber, IsString, ValidateIf } from 'class-validator';

export class PaginationDto {
    @IsNumber()
    count: number;

    @IsString()
    @ValidateIf((object, value) => value !== null)
    next: string | null;

    @IsString()
    @ValidateIf((object, value) => value !== null)
    previous: string | null;

    @IsArray()
    results: any[];
}