import { APP_PIPE, RouterModule } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { SentryModule } from '@ntegral/nestjs-sentry';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './auth/auth.module';
import { CollabModule } from './collab/collab.module';
import { UserCounter, UserCounterSchema } from './collab/schemas/user-counter.schema';
import { User, UserSchema } from './collab/schemas/user.schema';
import { TypedModelModule } from './typedModel/typedModel.module';
import { ModelCounter, ModelCounterSchema } from './schemas/model-counter.schema';
import { NestedModelModule } from './nestedModels/nestedModel.module';
import { NestedCounter, NestedCounterSchema } from './schemas/tree-counter.schema';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';

@Module({
  imports: [
    AuthModule,
    CollabModule,
    TypedModelModule,
    NestedModelModule,
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      cache: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URL')
      })
    }),
    SentryModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        dsn: config.get<string>('SENTRY_DSN'),
        debug: config.get<boolean>('DEBUG', true),
        environment: config.get<string>('SENTRY_ENV', 'dev'),
        logLevels: ['verbose']
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
