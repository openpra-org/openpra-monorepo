import { Injectable, Logger } from '@nestjs/common';
import { MinioService } from '../../shared/minio.service';
import type { ScramResult } from '../../common/types/scram-result';
@Injectable()
export class StorageService {
    private readonly logger = new Logger(StorageService.name);
    constructor(private readonly minioService: MinioService) { }
    public async getInputData(inputId: string): Promise<string> {
        return this.minioService.getInputData(inputId);
    }
    public async getOutput(outputId: string): Promise<ScramResult | string | undefined> {
        try {
            const raw = await this.minioService.getOutputData(outputId);
            try {
                return JSON.parse(raw) as ScramResult;
            }
            catch {
                return raw;
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to load output for ID ${outputId}: ${message}`);
            return undefined;
        }
    }
}
