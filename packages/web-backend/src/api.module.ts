import { APP_PIPE, RouterModule } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ZodValidationPipe } from 'nestjs-zod';
import { ApiController } from './api.controller';
import { OptionsController } from './options.controller';
import { ApiService } from './api.service';
import { AuthModule } from './auth/auth.module';
import { CollabModule } from './collab/collab.module';
import { HclModule } from './hcl/hcl.module';
import { UserCounter, UserCounterSchema } from './collab/schemas/user-counter.schema';
import { User, UserSchema } from './collab/schemas/user.schema';

@Module({
  imports: [
    AuthModule,
    CollabModule,
    HclModule,
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      cache: true,
    }),
    MongooseModule.forFeature([
      { name: UserCounter.name, schema: UserCounterSchema },
      { name: User.name, schema: UserSchema }
    ]),
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
            path: 'hcl',
            module: HclModule,
          },
        ],
      },
    ]),
  ],
  controllers: [ApiController, OptionsController],
  providers: [
    ApiService,
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe
    }
  ]
})

export class ApiModule {}