import fs from 'fs';
import { Module } from '@nestjs/common';
import { APP_FILTER, RouterModule } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { HttpExceptionFilter } from './http-exception.filter';
import { RaptorManagerController } from './raptor-manager.controller';
import { RaptorManagerService } from './raptor-manager.service';
import { QuantificationModule } from './quantification/quantification.module';

@Module({
  // Define the modules to import, including configuration, database connection, and submodules.
  imports: [
    QuantificationModule,
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      cache: true,
      ignoreEnvFile: !fs.existsSync('.env'),
    }),
    RouterModule.register([
      {
        path: 'q', // Define the base path for the API.
        module: RaptorManagerModule,
        children: [
          // Define child modules for specific endpoint prefixes.
          {
            path: 'quantify',
            module: QuantificationModule,
          },
        ],
      },
    ]),
  ],
  controllers: [RaptorManagerController], // Register the controller for this module.
  providers: [
    RaptorManagerService, // Register the service for dependency injection.
    {
      provide: APP_FILTER, // Register the global exception filter.
      useClass: HttpExceptionFilter,
    },
  ],
})
export class RaptorManagerModule {}
