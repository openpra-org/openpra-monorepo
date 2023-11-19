import { APP_PIPE, RouterModule } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './auth/auth.module';
import { CollabModule } from './collab/collab.module';
import { TypedModelModule } from './typedModel/typedModel.module';
import { NestedModelModule } from './nestedModels/nestedModel.module';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';

@Module({
  imports: [
    AuthModule,
    CollabModule,
    TypedModelModule,
    NestedModelModule,
    ConfigModule.forRoot({
      envFilePath: '.development.env',
      isGlobal: true,
      cache: true,
      ignoreEnvFile: !!process.env.DEPLOYMENT,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URL')
      })
    }),
    RouterModule.register([
      {
        path: 'api',
        module: ApiModule,
        children: [
          {
            path: 'auth',
            module: AuthModule,
          },
          {
            path: 'collab',
            module: CollabModule,
          },
          {
            path: 'typed-models',
            module: TypedModelModule,
          },
          {
            path: 'nested-models',
            module: NestedModelModule,
          },
        ],
      },
    ]),
  ],
  controllers: [ApiController],
  providers: [
    ApiService,
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe
    }
  ]
})

export class ApiModule {}
