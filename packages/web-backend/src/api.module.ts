import { APP_FILTER, RouterModule } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ApiController } from "./api.controller";
import { ApiService } from "./api.service";
import { AuthModule } from "./auth/auth.module";
import { CollabModule } from "./collab/collab.module";
import { FmeaModule } from "./fmea/fmea.module";
import { GraphModelModule } from "./graphModels/graphModel.module";
import { InviteModule } from "./invite/invite.module";
import { NestedModelModule } from "./nestedModels/nestedModel.module";
import { QuantifyModule } from "./quantify/quantify.module";
import { TypedModelModule } from "./typedModel/typedModel.module";
import { HttpExceptionFilter } from "./filters/http-exception.filter";

@Module({
  imports: [
    AuthModule,
    CollabModule,
    FmeaModule,
    GraphModelModule,
    InviteModule,
    NestedModelModule,
    QuantifyModule,
    TypedModelModule,
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
            path: "fmea",
            module: FmeaModule,
          },
          {
            path: "graph-models",
            module: GraphModelModule,
          },
          {
            path: "invite-user",
            module: InviteModule,
          },
          {
            path: "nested-models",
            module: NestedModelModule,
          },
          {
            path: "quantify",
            module: QuantifyModule,
          },
          {
            path: "typed-models",
            module: TypedModelModule,
          },
        ],
      },
    ]),
  ],
  controllers: [ApiController],
  providers: [
    ApiService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class ApiModule {}
