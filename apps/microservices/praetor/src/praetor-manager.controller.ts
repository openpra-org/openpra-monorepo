import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PraetorManagerService } from './praetor-manager.service';
import type { NodeQuantRequest } from './common/types/quantify-request';
import { JobMetadata } from './shared/minio.service';
export interface JobTypesResponse {
    services: Array<{
        name: string;
        endpoint: string;
    }>;
}
@ApiTags('Job Management')
@Controller()
export class PraetorManagerController {
    constructor(private readonly praetorManagerService: PraetorManagerService) { }
    @Get('/job-types')
    public getJobTypes(): JobTypesResponse {
        try {
            return this.praetorManagerService.getJobTypes();
        }
        catch {
            throw new NotFoundException('Server was unable to find the requested list of job types.');
        }
    }
    @Get('/jobs')
    public async getJobs(@Query('status') status: string): Promise<{ jobs: JobMetadata[] }> {
        try {
            return await this.praetorManagerService.getJobs(status);
        }
        catch {
            throw new NotFoundException('Server was unable to find the requested list of jobs.');
        }
    }
    @Get('/pending-jobs')
    public async getPendingJobs(): Promise<{ jobs: JobMetadata[] }> {
        try {
            return await this.praetorManagerService.getPendingJobs();
        }
        catch {
            throw new NotFoundException('Server was unable to find the requested list of pending jobs.');
        }
    }
    @Get('/running-jobs')
    public async getRunningJobs(): Promise<{ jobs: JobMetadata[] }> {
        try {
            return await this.praetorManagerService.getRunningJobs();
        }
        catch {
            throw new NotFoundException('Server was unable to find the requested list of running jobs.');
        }
    }
    @Get('/completed-jobs')
    public async getCompletedJobs(): Promise<{ jobs: JobMetadata[] }> {
        try {
            return await this.praetorManagerService.getCompletedJobs();
        }
        catch {
            throw new NotFoundException('Server was unable to find the requested list of completed jobs.');
        }
    }
    @Get('/failed-jobs')
    public async getFailedJobs(): Promise<{ jobs: JobMetadata[] }> {
        try {
            return await this.praetorManagerService.getFailedJobs();
        }
        catch {
            throw new NotFoundException('Server was unable to find the requested list of failed jobs.');
        }
    }
    @Get('/examples/:exampleId')
    public getExample(@Param('exampleId') exampleId: string): NodeQuantRequest {
        try {
            const fixturesPath = join(process.cwd(), 'fixtures', 'models', 'MHTGR');
            let filePath: string;
            switch (exampleId) {
                case '1':
                    filePath = join(fixturesPath, 'JSON', 'chinese.json');
                    break;
                case '2':
                    filePath = join(fixturesPath, 'JSON', 'demo_gas_leak.json');
                    break;
                default:
                    throw new NotFoundException(`Example ID must be 1 or 2. Received: ${exampleId}`);
            }
            return JSON.parse(readFileSync(filePath, 'utf-8')) as NodeQuantRequest;
        }
        catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            const message = error instanceof Error ? error.message : String(error);
            throw new NotFoundException(`Unable to load example ${exampleId}: ${message}`);
        }
    }
}
