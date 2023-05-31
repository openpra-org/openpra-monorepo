import { Module } from '@nestjs/common';
import { APP_PIPE, RouterModule } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './auth/auth.module';
import { CollabModule } from './collab/collab.module';
import { HclModule } from './hcl/hcl.module';

@Module({
  imports: [
    AuthModule,
    CollabModule,
    HclModule,
    MongooseModule.forRoot(process.env.MONGO_URL),
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      cache: true,
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
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class ApiModule {}
