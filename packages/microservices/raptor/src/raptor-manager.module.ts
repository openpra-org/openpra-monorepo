import fs from "fs";
import { Module } from "@nestjs/common";
import { APP_FILTER, RouterModule } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { HttpExceptionFilter } from "./http-exception.filter";
import { RaptorManagerController } from "./raptor-manager.controller";
import { RaptorManagerService } from "./raptor-manager.service";
import { QuantificationModule } from "./quantification/quantification.module";
@Module({
  imports: [
    QuantificationModule,
    ConfigModule.forRoot({
      envFilePath: ".env",
      isGlobal: true,
      cache: true,
      ignoreEnvFile: !fs.existsSync(".env"),
    }),
    RouterModule.register([
      {
        path: "q",
        module: RaptorManagerModule,
        children: [
          {
            path: "quantify",
            module: QuantificationModule,
          },
        ],
      },
    ]),
  ],
  controllers: [RaptorManagerController],
  providers: [
    RaptorManagerService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class RaptorManagerModule {}
