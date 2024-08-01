import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RouterModule } from "@nestjs/core";
import { ExecutableController } from "./executable.controller";
import { ExecutableService } from "./executable.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ".development.env",
      isGlobal: true,
      cache: true,
      ignoreEnvFile: !!process.env.DEPLOYMENT,
    }),
    RouterModule.register([
      {
        path: "executable",
        module: ExecutableModule,
      },
    ]),
  ],
  controllers: [ExecutableController],
  providers: [ExecutableService],
})
export class ExecutableModule {}
