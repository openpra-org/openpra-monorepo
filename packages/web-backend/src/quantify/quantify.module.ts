import { Module } from "@nestjs/common";
import { QuantifyController } from "./quantify.controller";
import { QuantifyService } from "./quantify.service";

/**
 * Quantification feature module exposing controller and service.
 */
@Module({
  controllers: [QuantifyController],
  providers: [QuantifyService],
})
export class QuantifyModule {}
