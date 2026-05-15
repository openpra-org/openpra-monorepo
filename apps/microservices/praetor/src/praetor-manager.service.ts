import { Injectable } from '@nestjs/common';
import { JobResponse } from './praetor-manager.controller';
import { StorageService } from './quantification/services/storage.service';
import { JobMetadata } from './shared/minio.service';
@Injectable()
export class PraetorManagerService {
    constructor(private readonly storageService: StorageService) { }
    public getJobTypes(): JobResponse {
        return { message: 'return the types of jobs' };
    }
    public async getJobs(status: string): Promise<{
        jobs: JobMetadata[];
    }> {
        const allJobs = await this.storageService.getQuantifiedReports();
        const filteredJobs = allJobs.filter((job) => job.status === status);
        return {
            jobs: filteredJobs,
        };
    }
    public async getPendingJobs(): Promise<{
        jobs: JobMetadata[];
    }> {
        return this.getJobs('pending');
    }
    public async getRunningJobs(): Promise<{
        jobs: JobMetadata[];
    }> {
        return this.getJobs('running');
    }
    public async getCompletedJobs(): Promise<{
        jobs: JobMetadata[];
    }> {
        return this.getJobs('completed');
    }
    public createJob(): JobResponse {
        return { message: 'create a new job' };
    }
}
