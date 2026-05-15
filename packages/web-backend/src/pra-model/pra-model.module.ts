import { Module } from "@nestjs/common";
import { MinioStorageService } from "../storage/minio-storage.service";
import { PraModelService } from "./pra-model.service";
import { PraModelController } from "./pra-model.controller";
import { PosService } from "./pos/pos.service";
import { PosController } from "./pos/pos.controller";
@Module({
  providers: [MinioStorageService, PraModelService, PosService],
  controllers: [PraModelController, PosController],
})
export class PraModelModule {}
