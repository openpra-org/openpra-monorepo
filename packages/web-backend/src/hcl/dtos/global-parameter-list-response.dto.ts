import { Expose, Type } from 'class-transformer';

class Results {
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

export class GlobalParameterListResponseDto {
    @Expose()
    count: number;

    @Expose()
    next: string | null;

    @Expose()
    previous: string | null;

    @Expose()
    @Type(() => Results)
    results: Results[];
}