import { Injectable } from '@nestjs/common';
import { MinioService } from '../../shared';

@Injectable()
export class ExecuteStorageService {
    constructor(private readonly minioService: MinioService) {}
    public async getInputData(inputId: string): Promise<string> {
        return this.minioService.getInputData(inputId);
    }
    public async getOutputData(outputId: string): Promise<string> {
        return this.minioService.getOutputData(outputId);
    }
}
