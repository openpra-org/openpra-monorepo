import { Injectable } from '@nestjs/common';
import { StorageService } from './quantification/services/storage.service';
import { JobMetadata } from './shared/minio.service';
@Injectable()
export class PraetorManagerService {
    constructor(private readonly storageService: StorageService) { }
    public getJobTypes(): { services: Array<{ name: string; endpoint: string }> } {
        return {
            services: [
                { name: 'SCRAM Quantify', endpoint: '/q/scram' },
                { name: 'SaphSolve Quantify', endpoint: '/q/saphsolve/quantify' },
                { name: 'SaphSolve Execute', endpoint: '/q/saphsolve/execute' },
                { name: 'FTREX Quantify', endpoint: '/q/ftrex/quantify' },
                { name: 'FTREX Execute', endpoint: '/q/ftrex/execute' },
            ],
        };
    }
    public async getJobs(status: string): Promise<{ jobs: JobMetadata[] }> {
        const allJobs = await this.storageService.getQuantifiedReports();
        return { jobs: allJobs.filter((job) => job.status === status) };
    }
    public async getPendingJobs(): Promise<{ jobs: JobMetadata[] }> {
        return this.getJobs('pending');
    }
    public async getRunningJobs(): Promise<{ jobs: JobMetadata[] }> {
        return this.getJobs('running');
    }
    public async getCompletedJobs(): Promise<{ jobs: JobMetadata[] }> {
        return this.getJobs('completed');
    }
    public async getFailedJobs(): Promise<{ jobs: JobMetadata[] }> {
        return this.getJobs('failed');
    }
}
