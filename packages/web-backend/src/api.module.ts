import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_PIPE, RouterModule } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";
import { ZodValidationPipe } from "nestjs-zod";
import { ApiController } from "./api.controller";
import { ApiService } from "./api.service";
import { AuthModule } from "./auth/auth.module";
import { CollabModule } from "./collab/collab.module";
import { FmeaModule } from "./fmea/fmea.module";
import { GraphModelModule } from "./graphModels/graphModel.module";
import { InviteModule } from "./invite/invite.module";
import { NestedModelModule } from "./nestedModels/nestedModel.module";
import { OperatingStateModule } from "./operatingState/operatingState.module"; // Make sure this path matches your file structure
import { TypedModelModule } from "./typedModel/typedModel.module";

@Module({
  imports: [
    AuthModule,
    CollabModule,
    TypedModelModule,
    NestedModelModule,
    FmeaModule,
    GraphModelModule,
    InviteModule,
    OperatingStateModule,
    ConfigModule.forRoot({
      envFilePath: ".development.env",
      isGlobal: true,
      cache: true,
      ignoreEnvFile: !!process.env.DEPLOYMENT,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
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
            path: "operating-state-analysis",
            module: OperatingStateModule,
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
      useClass: ZodValidationPipe,
    },
  ],
})
export class ApiModule {}
