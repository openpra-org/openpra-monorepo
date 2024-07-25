import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ValidationService } from "./validation.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ".development.env",
      isGlobal: true,
      cache: true,
      ignoreEnvFile: !!process.env.DEPLOYMENT,
    }),
  ],
  providers: [ValidationService],
})
export class ValidationModule {}
