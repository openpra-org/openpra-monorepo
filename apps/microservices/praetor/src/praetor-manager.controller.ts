import { Controller, Query, InternalServerErrorException, NotFoundException, } from '@nestjs/common';
import { TypedRoute } from '@nestia/core';
import { PraetorManagerService } from './praetor-manager.service';
import { JobMetadata } from './shared/minio.service';
export interface JobResponse {
    message: string;
}
@Controller()
export class PraetorManagerController {
    constructor(private readonly praetorManagerService: PraetorManagerService) { }
    @TypedRoute.Get('/job-types')
    public getJobTypes(): JobResponse {
        try {
            return this.praetorManagerService.getJobTypes();
        }
        catch {
            throw new NotFoundException('Server was unable to find the requested list of job types.');
        }
    }
    @TypedRoute.Get('/jobs')
    public async getJobs(
    @Query('status')
    status: string): Promise<{
        jobs: JobMetadata[];
    }> {
        try {
            return await this.praetorManagerService.getJobs(status);
        }
        catch {
            throw new NotFoundException('Server was unable to find the requested list of pending jobs.');
        }
    }
    @TypedRoute.Get('/pending-jobs')
    public async getPendingJobs(): Promise<{
        jobs: JobMetadata[];
    }> {
        try {
            return await this.praetorManagerService.getPendingJobs();
        }
        catch {
            throw new NotFoundException('Server was unable to find the requested list of pending jobs.');
        }
    }
    @TypedRoute.Get('/running-jobs')
    public async getRunningJobs(): Promise<{
        jobs: JobMetadata[];
    }> {
        try {
            return await this.praetorManagerService.getRunningJobs();
        }
        catch {
            throw new NotFoundException('Server was unable to find the requested list of running jobs.');
        }
    }
    @TypedRoute.Get('/completed-jobs')
    public async getCompletedJobs(): Promise<{
        jobs: JobMetadata[];
    }> {
        try {
            return await this.praetorManagerService.getCompletedJobs();
        }
        catch {
            throw new NotFoundException('Server was unable to find the requested list of completed jobs.');
        }
    }
    @TypedRoute.Post('/create-job')
    public createJob(): JobResponse {
        try {
            return this.praetorManagerService.createJob();
        }
        catch {
            throw new InternalServerErrorException('Server encountered a problem while creating a job.');
        }
    }
}
