import fs from 'fs';
import { Module } from '@nestjs/common';
import { APP_FILTER, RouterModule } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { HttpExceptionFilter } from './http-exception.filter';
import { QuantificationModule } from './quantification/quantification.module';
import { ExecutionModule } from './execution/execution.module';
@Module({
    imports: [
        QuantificationModule,
        ExecutionModule,
        ConfigModule.forRoot({
            envFilePath: '.env',
            isGlobal: true,
            cache: true,
            ignoreEnvFile: !fs.existsSync('.env'),
        }),
        RouterModule.register([
            {
                path: 'q',
                module: PraetorManagerModule,
                children: [
                    {
                        path: 'quantify',
                        module: QuantificationModule,
                    },
                ],
            },
            {
                path: 'q',
                module: ExecutionModule,
            },
        ]),
    ],
    providers: [
        {
            provide: APP_FILTER,
            useClass: HttpExceptionFilter,
        },
    ],
})
export class PraetorManagerModule {
}
