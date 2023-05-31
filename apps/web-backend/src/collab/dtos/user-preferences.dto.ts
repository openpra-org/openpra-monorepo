import { IsBoolean, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UserPreferencesDto {
    @IsOptional()
    @IsString()
    theme: string;

    @IsOptional()
    @IsBoolean()
    @ValidateIf((object, value) => typeof value !== 'string')
    nodeIdsVisible: boolean;

    @IsOptional()
    @IsBoolean()
    @ValidateIf((object, value) => typeof value !== 'string')
    outlineVisible: boolean;

    @IsOptional()
    @IsBoolean()
    @ValidateIf((object, value) => typeof value !== 'string')
    nodeDescriptionEnabled: boolean;

    @IsOptional()
    @IsBoolean()
    @ValidateIf((object, value) => typeof value !== 'string')
    node_value_visible: boolean;

    @IsOptional()
    @IsBoolean()
    @ValidateIf((object, value) => typeof value !== 'string')
    pageBreaksVisible: boolean;
}