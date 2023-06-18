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

/**
* 1. ConfigModule is used to import Environment variables from '*.env' files.
*   a) envFilePath tells from which file the variables need to be imported.
*   b) Instead of manually importing the variables every time, we can set them as Global variables - so that all files can have access to them.
*   c) It takes some time to import the variable each time. To improve the performance of ConfigService, the variables are cached.
* 2. MongooseModule helps the web-app connect to the MongoDB Database. 'MONGO_URL' contains the URI of the MongoDB Client.
* 3. RouterModule can define prefixes for URLs in the Module level. For example: the AuthModule is a children of the ApiModule. Since the path for the
*    ApiModule is 'api' and the path for AuthModule is 'auth', instead of writing an endpoint in AuthModule like 'http://localhost:8000/api/auth/token-obtain',
*    we can simply write 'token-obtain'. RouterModule is going to take care of the rest of the prefixes for the app.
* 4. Zod library is used to validate (type-check) the request body.
*/
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
