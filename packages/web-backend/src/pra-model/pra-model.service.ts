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
const MODELS_COLLECTION = "meta";
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
    await this.storage.putObject(MODELS_PREFIX, MODELS_COLLECTION, meta.uuid, meta);
    return meta;
  }
  async findAll(): Promise<PraModelMeta[]> {
    const keys = await this.storage.listObjects(MODELS_PREFIX, MODELS_COLLECTION);
    return Promise.all(keys.map((key) => this.storage.getObject<PraModelMeta>(MODELS_PREFIX, MODELS_COLLECTION, key)));
  }
  async findOne(uuid: string): Promise<PraModelMeta> {
    return this.storage.getObject<PraModelMeta>(MODELS_PREFIX, MODELS_COLLECTION, uuid);
  }
  async delete(uuid: string): Promise<void> {
    await this.storage.deleteObject(MODELS_PREFIX, MODELS_COLLECTION, uuid);
  }
}
