import fs from "fs";
import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, RouterModule } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { HttpExceptionFilter } from "./http-exception.filter";
import { RaptorManagerController } from "./raptor-manager.controller";
import { RaptorManagerService } from "./raptor-manager.service";
import { QuantificationModule } from "./quantification/quantification.module";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { JwtStrategy, ParseJwtSecret } from "@web-backend/auth/strategies/jwt.strategy";
import { JwtAuthGuard } from "@web-backend/guards/jwt-auth.guard";

@Module({
  // Define the modules to import, including configuration, database connection, and submodules.
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
        path: "q", // Define the base path for the API.
        module: RaptorManagerModule,
        children: [
          // Define child modules for specific endpoint prefixes.
          {
            path: "quantify",
            module: QuantificationModule,
          },
        ],
      },
    ]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: ParseJwtSecret(config),
        signOptions: { expiresIn: "24h" },
      }),
    }),
  ],
  controllers: [RaptorManagerController], // Register the controller for this module.
  providers: [
    RaptorManagerService, // Register the service for dependency injection.
    {
      provide: APP_FILTER, // Register the global exception filter.
      useClass: HttpExceptionFilter,
    },
    JwtStrategy,
    {
      provide: APP_GUARD, // Register the global authentication guard.
      useClass: JwtAuthGuard,
    },
  ],
})
export class RaptorManagerModule {}
