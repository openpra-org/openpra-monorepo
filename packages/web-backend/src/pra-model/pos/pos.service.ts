import { Injectable } from "@nestjs/common";
import { plant_operating_states_analysis, TechnicalElementTypes } from "mef-types";
import { MinioStorageService } from "../../storage/minio-storage.service";

type PlantOperatingStatesAnalysis = plant_operating_states_analysis.PlantOperatingStatesAnalysis;
const TE_TYPE = TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS;

@Injectable()
export class PosService {
  constructor(private readonly storage: MinioStorageService) {}

  async create(modelId: string, data: PlantOperatingStatesAnalysis): Promise<PlantOperatingStatesAnalysis> {
    await this.storage.putObject(modelId, TE_TYPE, String(data.uuid), data);
    return data;
  }

  async findAll(modelId: string): Promise<PlantOperatingStatesAnalysis[]> {
    const keys = await this.storage.listObjects(modelId, TE_TYPE);
    return Promise.all(keys.map((key) => this.storage.getObject<PlantOperatingStatesAnalysis>(modelId, TE_TYPE, key)));
  }
}
