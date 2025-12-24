import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RaptorManagerService } from './raptor-manager.service';
import { JobMetadata } from './shared/minio.service';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface JobTypesResponse {
  services: Array<{ name: string; endpoint: string }>;
}

export interface JobResponse {
  message: string;
}

@ApiTags('Job Management')
@Controller()
export class RaptorManagerController {
  /**
   * Constructs the RaptorManagerController with the necessary service.
   * @param raptorManagerService - The service to handle job broker operations.
   */
  constructor(private readonly raptorManagerService: RaptorManagerService) {}

  /**
   * @summary Retrieves a list of available job types and their endpoints
   */
  @Get('/job-types')
  public getJobTypes(): JobTypesResponse {
    try {
      return this.raptorManagerService.getJobTypes();
    } catch {
      throw new NotFoundException(
        'Server was unable to find the requested list of job types.',
      );
    }
  }

  /**
   * @summary Retrieves all jobs with running status
   */
  @Get('/running-jobs')
  public async getRunningJobs(): Promise<{ jobs: JobMetadata[] }> {
    try {
      return await this.raptorManagerService.getRunningJobs();
    } catch {
      throw new NotFoundException(
        'Server was unable to find the requested list of running jobs.',
      );
    }
  }

  /**
   * @summary Retrieves all jobs with completed status
   */
  @Get('/completed-jobs')
  public async getCompletedJobs(): Promise<{ jobs: JobMetadata[] }> {
    try {
      return await this.raptorManagerService.getCompletedJobs();
    } catch {
      throw new NotFoundException(
        'Server was unable to find the requested list of completed jobs.',
      );
    }
  }

  /**
   * @summary Retrieves all jobs with processing status
   */
  @Get('/processing-jobs')
  public async getProcessingJobs(): Promise<{ jobs: JobMetadata[] }> {
    try {
      return await this.raptorManagerService.getProcessingJobs();
    } catch {
      throw new NotFoundException(
        'Server was unable to find the requested list of processing jobs.',
      );
    }
  }

  /**
   * @summary Retrieves all jobs with partial status
   */
  @Get('/partial-jobs')
  public async getPartialJobs(): Promise<{ jobs: JobMetadata[] }> {
    try {
      return await this.raptorManagerService.getPartialJobs();
    } catch {
      throw new NotFoundException(
        'Server was unable to find the requested list of partial jobs.',
      );
    }
  }

  /**
   * @summary Retrieves all jobs with failed status
   */
  @Get('/failed-jobs')
  public async getFailedJobs(): Promise<{ jobs: JobMetadata[] }> {
    try {
      return await this.raptorManagerService.getFailedJobs();
    } catch {
      throw new NotFoundException(
        'Server was unable to find the requested list of failed jobs.',
      );
    }
  }

  /**
   * @summary 1: Fault tree (non-distributed, BDD), 2: Event tree (distributed sequences), 3: Fault tree (adaptive quantification), 4: Event tree (adaptive quantification)
   */
  @Get('/examples/:exampleId')
  public getExample(@Param('exampleId') exampleId: string): any {
    try {
      const fixturesPath = join(process.cwd(), 'fixtures', 'models', 'MHTGR');
      let filePath: string;

      switch (exampleId) {
        case '1':
          // Non-distributed fault tree with BDD
          filePath = join(fixturesPath, 'JSON', 'chinese.json');
          break;
        case '2':
          // Distributed event tree sequences
          filePath = join(fixturesPath, 'JSON', 'demo_gas_leak.json');
          break;
        case '3':
          // Adaptive fault tree
          filePath = join(fixturesPath, 'JSON', 'chinese_adaptive.json');
          break;
        case '4':
          // Adaptive event tree
          filePath = join(fixturesPath, 'Adaptive', 'demo_gas_leak.json');
          break;
        default:
          throw new NotFoundException(
            `Example ID must be 1, 2, 3, or 4. Received: ${exampleId}`,
          );
      }

      const fileContent = readFileSync(filePath, 'utf-8');
      const example = JSON.parse(fileContent);

      return example;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(
        `Unable to load example ${exampleId}: ${error.message}`,
      );
    }
  }
}
