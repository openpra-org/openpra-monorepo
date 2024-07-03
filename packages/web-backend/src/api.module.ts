import { join } from "path";
import { APP_PIPE, RouterModule } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ZodValidationPipe } from "nestjs-zod";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver } from "@nestjs/apollo";
import { AuthModule } from "./auth/auth.module";
import { CollabModule } from "./collab/collab.module";
import { TypedModelModule } from "./typedModel/typedModel.module";
import { NestedModelModule } from "./nestedModels/nestedModel.module";
import { ApiController } from "./api.controller";
import { ApiService } from "./api.service";
import { FmeaModule } from "./fmea/fmea.module";
import { GraphModelModule } from "./graphModels/graphModel.module";
import { InviteModule } from "./invite/invite.module";
import { RolesModule } from "./roles/roles.module";
import { AuthGqlModule } from "./authGql/auth-gql.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    // AuthModule,
    AuthGqlModule,
    CollabModule,
    TypedModelModule,
    NestedModelModule,
    FmeaModule,
    GraphModelModule,
    InviteModule,
    RolesModule,
    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), "/packages/web-backend/schema.gql"),
      sortSchema: true,
    }),
    ConfigModule.forRoot({
      envFilePath: ".development.env",
      isGlobal: true,
      cache: true,
      ignoreEnvFile: !!process.env.DEPLOYMENT,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>("MONGO_URL"),
      }),
    }),
    RouterModule.register([
      {
        path: "api",
        module: ApiModule,
        children: [
          {
            path: "auth",
            module: AuthModule,
          },
          {
            path: "collab",
            module: CollabModule,
          },
          {
            path: "invite-user",
            module: InviteModule,
          },
          {
            path: "typed-models",
            module: TypedModelModule,
          },
          {
            path: "nested-models",
            module: NestedModelModule,
          },
          {
            path: "fmea",
            module: FmeaModule,
          },
          {
            path: "graph-models",
            module: GraphModelModule,
          },
          {
            path: "roles",
            module: RolesModule,
          },
        ],
      },
    ]),
    UsersModule,
  ],
  controllers: [ApiController],
  providers: [
    ApiService,
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class ApiModule {}
