import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ConsumerService } from "./services/consumer.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ".development.env", // Specify the environment file path.
      isGlobal: true, // Make configuration globally available.
      cache: true, // Enable caching of environment variables.
      ignoreEnvFile: !!process.env.DEPLOYMENT, // Conditionally ignore the environment file based on deployment status.
    }),
  ],
  // Register services to provide business logic for quantification operations.
  providers: [ConsumerService],
})
export class QuantificationConsumerModule {}
