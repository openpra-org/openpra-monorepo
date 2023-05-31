import { UseInterceptors, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { plainToInstance } from 'class-transformer';

export class SerializeInterceptor implements NestInterceptor {
    constructor(private dto: any) {}
    intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
        return next.handle().pipe(
            map((data: any) => {
                return plainToInstance(this.dto, data, {
                    excludeExtraneousValues: true
                })
            })
        )
    }
}

export function Serialize(dto: any) {
    return UseInterceptors(new SerializeInterceptor(dto));
}