import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { RouterModule } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";
import { JobBrokerController } from "./job-broker.controller";
import { JobBrokerService } from "./job-broker.service";
import { QuantificationModule } from "./quantification/quantification.module";
import { ValidationModule } from "./validation/validation.module";
import { ExecutableModule } from "./executable/executable.module";

@Module({
  imports: [
    QuantificationModule,
    ValidationModule,
    ExecutableModule,
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
          {
            path: "executable",
            module: ExecutableModule,
          },
        ],
      },
    ]),
  ],
  controllers: [JobBrokerController],
  providers: [JobBrokerService],
})
export class JobBrokerModule {}
