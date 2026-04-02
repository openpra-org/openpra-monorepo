import { Module } from "@nestjs/common";
import { MinioStorageService } from "../storage/minio-storage.service";
import { PraModelService } from "./pra-model.service";
import { PosService } from "./pos/pos.service";
import { PosController } from "./pos/pos.controller";

@Module({
  providers: [MinioStorageService, PraModelService, PosService],
  controllers: [PosController],
})
export class PraModelModule {}
