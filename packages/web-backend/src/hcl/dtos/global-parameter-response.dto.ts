import { Expose } from 'class-transformer';

export class GlobalParameterResponseDto {
    @Expose()
    pk: number;

    @Expose()
    parameter_name: string;

    @Expose()
    parameter_type: string;

    @Expose()
    double_value: number;

    @Expose()
    string_value: string;
}