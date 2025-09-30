import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import { EnvVarKeys } from '../../config/env_vars.config';

export interface JobMetadata {
  jobId?: string;
  inputId?: string;
  outputId?: string;
  childJobs?: string[];
  completedSequences?: string[];
  status?: 'processing' | 'pending' | 'running' | 'completed' | 'failed';
  timestamp?: string;
  error?: string;
}

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private minioClient: Minio.Client;
  private readonly inputBucket: string;
  private readonly outputBucket: string;
  private readonly jobsBucket: string;
  private readonly endpoint: string;
  private readonly port: number;

  constructor(private readonly configSvc: ConfigService) {
    this.inputBucket = this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_MINIO_INPUT_BUCKET);
    this.outputBucket = this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_MINIO_OUTPUT_BUCKET);
    this.jobsBucket = this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_MINIO_JOBS_BUCKET);
    this.endpoint = this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_MINIO_ENDPOINT);
    this.port = Number(this.configSvc.getOrThrow<number>(EnvVarKeys.ENV_MINIO_PORT));
    
    this.minioClient = new Minio.Client({
      endPoint: this.endpoint,
      port: this.port,
      useSSL: false,
      accessKey: this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_MINIO_ACCESS_KEY),
      secretKey: this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_MINIO_SECRET_KEY),
    });
  }

  async onModuleInit() {
    await this.initializeBuckets();
  }

  private async initializeBuckets(): Promise<void> {
    try {
      const buckets = [this.inputBucket, this.outputBucket, this.jobsBucket];
      
      for (const bucket of buckets) {
        const exists = await this.minioClient.bucketExists(bucket);
        if (!exists) {
          try {
            await this.minioClient.makeBucket(bucket);
            this.logger.log(`Created bucket: ${bucket}`);
          } catch (err: any) {
            // Handle race: another worker may have created the bucket between
            // our existence check and makeBucket call.
            const alreadyExists = await this.minioClient
              .bucketExists(bucket)
              .catch(() => false);
            if (
              alreadyExists ||
              err?.code === 'BucketAlreadyOwnedByYou' ||
              err?.code === 'BucketAlreadyExists' ||
              err?.statusCode === 409 ||
              /already (own|exist)s?/i.test(String(err?.message || ''))
            ) {
              this.logger.debug(`Bucket ${bucket} already present (race handled).`);
            } else {
              throw err;
            }
          }
        } else {
          this.logger.log(`Bucket already exists: ${bucket}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to initialize buckets: ${error.message}`);
      throw error;
    }
  }

  async storeInputData(inputData: any): Promise<string> {
    const inputId = uuidv4();
    const objectName = `input-${inputId}-${Date.now()}.json`;
    
    try {
      const inputDataString = typeof inputData === 'string' ? inputData : JSON.stringify(inputData);
      const inputDataBuffer = Buffer.from(inputDataString, 'utf8');
      await this.minioClient.putObject(
        this.inputBucket,
        objectName,
        inputDataBuffer,
        inputDataBuffer.length,
        {
          'Content-Type': 'application/json',
          'X-Input-ID': inputId,
        }
      );
      
      this.logger.log(`Stored input data with ID: ${inputId}`);
      return inputId;
    } catch (error: any) {
      this.logger.error(`Failed to store input data: ${error.message}`);
      throw new Error(`Failed to store input data: ${error.message}`);
    }
  }

  async getInputData(inputId: string): Promise<string> {
    try {
      const objectsList = [];
      const stream = this.minioClient.listObjects(this.inputBucket, `input-${inputId}-`, true);
      
      for await (const obj of stream) {
        objectsList.push(obj);
      }
      
      if (objectsList.length === 0) {
        throw new Error(`No input data found for ID: ${inputId}`);
      }
      
      const objectName = objectsList[0].name;
      const dataStream = await this.minioClient.getObject(this.inputBucket, objectName);

      const chunks: Uint8Array[] = [];
      for await (const chunk of dataStream) {
        chunks.push(chunk);
      }
      
      const data = Buffer.concat(chunks).toString('utf8');
      this.logger.log(`Retrieved input data for ID: ${inputId}`);
      return data;
    } catch (error: any) {
      this.logger.error(`Failed to retrieve input data for ID ${inputId}: ${error.message}`);
      throw new Error(`Failed to retrieve input data: ${error.message}`);
    }
  }

  async storeOutputData(outputData: string, inputId: string): Promise<string> {
    const outputId = uuidv4();
    const objectName = `output-${outputId}-${Date.now()}.json`;
    
    try {
      await this.minioClient.putObject(
        this.outputBucket,
        objectName,
        Buffer.from(outputData, 'utf8'),
        Buffer.byteLength(outputData, 'utf8'),
        {
          'Content-Type': 'application/json',
          'X-Output-ID': outputId,
          'X-Input-ID': inputId,
        }
      );
      
      this.logger.log(`Stored output data with ID: ${outputId}`);
      return outputId;
    } catch (error: any) {
      this.logger.error(`Failed to store output data: ${error.message}`);
      throw new Error(`Failed to store output data: ${error.message}`);
    }
  }

  async getOutputData(outputId: string): Promise<string> {
    try {
      const objectsList = [];
      const stream = this.minioClient.listObjects(this.outputBucket, `output-${outputId}-`, true);
      
      for await (const obj of stream) {
        objectsList.push(obj);
      }
      
      if (objectsList.length === 0) {
        throw new Error(`No output data found for ID: ${outputId}`);
      }
      
      const objectName = objectsList[0].name;
      const dataStream = await this.minioClient.getObject(this.outputBucket, objectName);

      const chunks: Uint8Array[] = [];
      for await (const chunk of dataStream) {
        chunks.push(chunk);
      }
      
      const data = Buffer.concat(chunks).toString('utf8');
      this.logger.log(`Retrieved output data for ID: ${outputId}`);
      return data;
    } catch (error: any) {
      this.logger.error(`Failed to retrieve output data for ID ${outputId}: ${error.message}`);
      throw new Error(`Failed to retrieve output data: ${error.message}`);
    }
  }

  async deleteInputData(inputId: string): Promise<void> {
    try {
      const objectsList = [];
      const stream = this.minioClient.listObjects(this.inputBucket, `input-${inputId}-`, true);
      
      for await (const obj of stream) {
        objectsList.push(obj);
      }
      
      for (const obj of objectsList) {
        await this.minioClient.removeObject(this.inputBucket, obj.name);
      }
      
      this.logger.log(`Deleted input data for ID: ${inputId}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete input data for ID ${inputId}: ${error.message}`);
      throw new Error(`Failed to delete input data: ${error.message}`);
    }
  }

  async deleteOutputData(outputId: string): Promise<void> {
    try {
      const objectsList = [];
      const stream = this.minioClient.listObjects(this.outputBucket, `output-${outputId}-`, true);
      
      for await (const obj of stream) {
        objectsList.push(obj);
      }
      
      for (const obj of objectsList) {
        await this.minioClient.removeObject(this.outputBucket, obj.name);
      }
      
      this.logger.log(`Deleted output data for ID: ${outputId}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete output data for ID ${outputId}: ${error.message}`);
      throw new Error(`Failed to delete output data: ${error.message}`);
    }
  }

  async createJobMetadata(jobId: string, inputId: string): Promise<void> {
    const metadata: JobMetadata = {
      jobId,
      inputId,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };

    const objectName = `job-${jobId}.json`;
    
    try {
      await this.minioClient.putObject(
        this.jobsBucket,
        objectName,
        Buffer.from(JSON.stringify(metadata), 'utf8'),
        undefined,
        {
          'Content-Type': 'application/json',
          'X-Job-ID': jobId,
        }
      );
      
      this.logger.log(`Created job metadata for ID: ${jobId}`);
    } catch (error: any) {
      this.logger.error(`Failed to create job metadata: ${error.message}`);
      throw new Error(`Failed to create job metadata: ${error.message}`);
    }
  }

  async updateJobMetadata(jobId: string, updates: Partial<JobMetadata>): Promise<void> {
    try {
      const current = await this.getJobMetadata(jobId);
      const updated = { ...current, ...updates };
      
      const objectName = `job-${jobId}.json`;
      
      await this.minioClient.putObject(
        this.jobsBucket,
        objectName,
        Buffer.from(JSON.stringify(updated), 'utf8'),
        undefined,
        {
          'Content-Type': 'application/json',
          'X-Job-ID': jobId,
        }
      );
      
      this.logger.log(`Updated job metadata for ID: ${jobId}`);
    } catch (error: any) {
      this.logger.error(`Failed to update job metadata: ${error.message}`);
      throw new Error(`Failed to update job metadata: ${error.message}`);
    }
  }

  /**
   * Mark a child sequence as completed in a race-safe way by writing a
   * standalone marker object. This avoids read-modify-write races on the
   * parent metadata object when many sequences complete concurrently.
   */
  async markSequenceCompleted(parentJobId: string, sequenceJobId: string): Promise<void> {
    const markerKey = `job-${parentJobId}/completed/${sequenceJobId}.marker`;
    try {
      await this.minioClient.putObject(
        this.jobsBucket,
        markerKey,
        Buffer.from('1', 'utf8'),
        undefined,
        {
          'Content-Type': 'text/plain',
          'X-Parent-Job-ID': parentJobId,
          'X-Sequence-Job-ID': sequenceJobId,
        }
      );
      this.logger.debug(`Marked sequence ${sequenceJobId} completed for parent ${parentJobId}`);
    } catch (error: any) {
      this.logger.error(`Failed to mark sequence completion for parent ${parentJobId}: ${error.message}`);
      throw new Error(`Failed to mark sequence completion: ${error.message}`);
    }
  }

  /**
   * Count completed sequence markers for a parent job.
   */
  async getCompletedSequenceCount(parentJobId: string): Promise<number> {
    const prefix = `job-${parentJobId}/completed/`;
    try {
      let count = 0;
      const stream = this.minioClient.listObjects(this.jobsBucket, prefix, true);
      for await (const _ of stream) {
        count += 1;
      }
      return count;
    } catch (error: any) {
      this.logger.error(`Failed to count completed sequences for parent ${parentJobId}: ${error.message}`);
      throw new Error(`Failed to count completed sequences: ${error.message}`);
    }
  }

  /**
   * Optionally list the completed sequence job IDs.
   */
  async listCompletedSequences(parentJobId: string): Promise<string[]> {
    const prefix = `job-${parentJobId}/completed/`;
    try {
      const result: string[] = [];
      const stream = this.minioClient.listObjects(this.jobsBucket, prefix, true);
      for await (const obj of stream) {
        // Extract sequence ID from key suffix
        const name = obj.name; // e.g., job-<parent>/completed/<sequenceId>.marker
        const lastPart = name.substring(name.lastIndexOf('/') + 1);
        const seqId = lastPart.replace(/\.marker$/, '');
        if (seqId) result.push(seqId);
      }
      return result;
    } catch (error: any) {
      this.logger.error(`Failed to list completed sequences for parent ${parentJobId}: ${error.message}`);
      throw new Error(`Failed to list completed sequences: ${error.message}`);
    }
  }

  async getJobMetadata(jobId: string): Promise<JobMetadata> {
    try {
      const objectName = `job-${jobId}.json`;
      const dataStream = await this.minioClient.getObject(this.jobsBucket, objectName);

      const chunks: Uint8Array[] = [];
      for await (const chunk of dataStream) {
        chunks.push(chunk);
      }
      
      const data = Buffer.concat(chunks).toString('utf8');
      return JSON.parse(data) as JobMetadata;
    } catch (error: any) {
      this.logger.error(`Failed to retrieve job metadata for ID ${jobId}: ${error.message}`);
      throw new Error(`Failed to retrieve job metadata: ${error.message}`);
    }
  }

  async getAllJobMetadata(): Promise<JobMetadata[]> {
    try {
      const jobs: JobMetadata[] = [];
      const stream = this.minioClient.listObjects(this.jobsBucket, 'job-', true);
      
      for await (const obj of stream) {
        try {
          const dataStream = await this.minioClient.getObject(this.jobsBucket, obj.name);
          const chunks: Uint8Array[] = [];
          for await (const chunk of dataStream) {
            chunks.push(chunk);
          }
          const data = Buffer.concat(chunks).toString('utf8');
          jobs.push(JSON.parse(data) as JobMetadata);
        } catch (error: any) {
          this.logger.warn(`Failed to parse job metadata from ${obj.name}: ${error.message}`);
        }
      }
      
      return jobs;
    } catch (error: any) {
      this.logger.error(`Failed to retrieve all job metadata: ${error.message}`);
      throw new Error(`Failed to retrieve all job metadata: ${error.message}`);
    }
  }

  async cleanupOldFiles(maxAgeInDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);
    
    try {
      await this.cleanupBucket(this.inputBucket, cutoffDate);
      await this.cleanupBucket(this.outputBucket, cutoffDate);
      await this.cleanupBucket(this.jobsBucket, cutoffDate);
      this.logger.log(`Cleanup completed for files older than ${maxAgeInDays} days`);
    } catch (error: any) {
      this.logger.error(`Cleanup failed: ${error.message}`);
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  private async cleanupBucket(bucket: string, cutoffDate: Date): Promise<void> {
    const objectsToDelete: string[] = [];
    const stream = this.minioClient.listObjects(bucket, '', true);
    
    for await (const obj of stream) {
      if (obj.lastModified && obj.lastModified < cutoffDate) {
        objectsToDelete.push(obj.name);
      }
    }
    
    for (const objectName of objectsToDelete) {
      await this.minioClient.removeObject(bucket, objectName);
    }
    
    this.logger.log(`Cleaned up ${objectsToDelete.length} objects from bucket: ${bucket}`);
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.minioClient.bucketExists(this.inputBucket);
      return true;
    } catch (error: any) {
      this.logger.error(`Health check failed: ${error.message}`);
      return false;
    }
  }
}