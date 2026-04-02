import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { MinioStorageService } from "../storage/minio-storage.service";
import { PraModelMeta, PraModelType } from "../schemas/pra-model.schema";

export interface CreatePraModelDto {
  name: string;
  type: PraModelType;
  ownerId: string;
}

const MODELS_PREFIX = "pra-models";

@Injectable()
export class PraModelService {
  constructor(private readonly storage: MinioStorageService) {}

  async create(dto: CreatePraModelDto): Promise<PraModelMeta> {
    const meta: PraModelMeta = {
      uuid: randomUUID(),
      name: dto.name,
      type: dto.type,
      ownerId: dto.ownerId,
      createdAt: new Date().toISOString(),
    };
    await this.storage.putObject(MODELS_PREFIX, meta.type, meta.uuid, meta);
    return meta;
  }
}
