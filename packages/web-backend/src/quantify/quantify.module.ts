import { Module } from "@nestjs/common";
import { QuantifyController } from "./quantify.controller";
import { QuantifyService } from "./quantify.service";

@Module({
  controllers: [QuantifyController],
  providers: [QuantifyService],
})
export class QuantifyModule {}
