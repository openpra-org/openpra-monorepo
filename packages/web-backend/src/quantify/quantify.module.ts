import { Module } from "@nestjs/common";
import { QuantifyController } from "./quantify.controller";
import { QuantifyService } from "./quantify.service";
import { MinioService } from "./minio.service";

@Module({
  controllers: [QuantifyController],
  providers: [QuantifyService, MinioService],
})
export class QuantifyModule {}