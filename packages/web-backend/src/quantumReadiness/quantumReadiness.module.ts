import { Module } from "@nestjs/common";
import { GraphModelModule } from "../graphModels/graphModel.module";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

/**
 * Backend module for quantum readiness integration.
 */
@Module({
  imports: [GraphModelModule],
  controllers: [QuantumReadinessController],
  providers: [QuantumReadinessService],
  exports: [QuantumReadinessService]
})
export class QuantumReadinessModule {}
