import { IsOptional, IsString, ValidateIf } from 'class-validator';

export class GlobalParameterDto {
    @IsString()
    parameter_name: string;

    @IsOptional()
    @IsString()
    @ValidateIf((object, value) => typeof value !== 'number')
    double_value: number;

    @IsOptional()
    @IsString()
    string_value: string;
}
