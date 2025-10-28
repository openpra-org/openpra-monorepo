import { Module } from "@nestjs/common";
import { QuantifyController } from "./quantify.controller";
import { QuantifyService } from "./quantify.service";

@Module({
  controllers: [QuantifyController],
  providers: [QuantifyService],
})
/**
 * Quantification feature module exposing controller and service.
 */
export class QuantifyModule {}
