import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RouterModule } from "@nestjs/core";
import { JobBrokerController } from "./job-broker.controller";
import { JobBrokerService } from "./job-broker.service";
import { QuantificationModule } from "./quantification/quantification.module";
import { ValidationModule } from "./validation/validation.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ".development.env",
      isGlobal: true,
      cache: true,
      ignoreEnvFile: !!process.env.DEPLOYMENT,
    }),
    QuantificationModule,
    ValidationModule,
    RouterModule.register([
      {
        path: "api",
        module: JobBrokerModule,
        children: [
          {
            path: "quantification",
            module: QuantificationModule,
          },
          {
            path: "validation",
            module: ValidationModule,
          },
        ],
      },
    ]),
  ],
  controllers: [JobBrokerController],
  providers: [JobBrokerService],
})
export class JobBrokerModule {}
