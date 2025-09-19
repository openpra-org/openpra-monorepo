import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import { EnvVarKeys } from './config/env_vars.config';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private minioClient: Minio.Client;
  private readonly inputBucket: string;
  private readonly outputBucket: string;

  constructor(private readonly configSvc: ConfigService) {
    this.inputBucket = this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_MINIO_INPUT_BUCKET);
    this.outputBucket = this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_MINIO_OUTPUT_BUCKET);
    
    this.minioClient = new Minio.Client({
      endPoint: this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_MINIO_ENDPOINT),
      port: Number(this.configSvc.getOrThrow<number>(EnvVarKeys.ENV_MINIO_PORT)),
      useSSL: Boolean(this.configSvc.getOrThrow<boolean>(EnvVarKeys.ENV_MINIO_USE_SSL)),
      accessKey: this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_MINIO_ACCESS_KEY),
      secretKey: this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_MINIO_SECRET_KEY),
    });
  }

  async onModuleInit() {
    await this.initializeBuckets();
  }

  private async initializeBuckets(): Promise<void> {
    try {
      const buckets = [this.inputBucket, this.outputBucket];
      
      for (const bucket of buckets) {
        const exists = await this.minioClient.bucketExists(bucket);
        if (!exists) {
          await this.minioClient.makeBucket(bucket);
          this.logger.log(`Created bucket: ${bucket}`);
        } else {
          this.logger.log(`Bucket already exists: ${bucket}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to initialize buckets: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stores decompressed input data in MinIO and returns a unique identifier
   * @param inputData - The decompressed input data as string
   * @returns Promise<string> - Unique identifier for the stored input
   */
  async storeInputData(inputData: string): Promise<string> {
    const inputId = uuidv4();
    const objectName = `input-${inputId}-${Date.now()}.json`;
    
    try {
      await this.minioClient.putObject(
        this.inputBucket,
        objectName,
        Buffer.from(inputData, 'utf8'),
        Buffer.byteLength(inputData, 'utf8'),
        {
          'Content-Type': 'application/json',
          'X-Input-ID': inputId,
        }
      );
      
      this.logger.log(`Stored input data with ID: ${inputId}`);
      return inputId;
    } catch (error) {
      this.logger.error(`Failed to store input data: ${error.message}`);
      throw new Error(`Failed to store input data: ${error.message}`);
    }
  }

  /**
   * Retrieves input data from MinIO using the input identifier
   * @param inputId - The unique identifier for the input data
   * @returns Promise<string> - The retrieved input data as string
   */
  async getInputData(inputId: string): Promise<string> {
    try {
      // List objects to find the one with matching input ID
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
    } catch (error) {
      this.logger.error(`Failed to retrieve input data for ID ${inputId}: ${error.message}`);
      throw new Error(`Failed to retrieve input data: ${error.message}`);
    }
  }

  /**
   * Stores output data in MinIO and returns a unique identifier
   * @param outputData - The output data as string
   * @param inputId - The input ID for correlation
   * @returns Promise<string> - Unique identifier for the stored output
   */
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
      
      this.logger.log(`Stored output data with ID: ${outputId} for input ID: ${inputId}`);
      return outputId;
    } catch (error) {
      this.logger.error(`Failed to store output data: ${error.message}`);
      throw new Error(`Failed to store output data: ${error.message}`);
    }
  }

  /**
   * Retrieves output data from MinIO using the output identifier
   * @param outputId - The unique identifier for the output data
   * @returns Promise<string> - The retrieved output data as string
   */
  async getOutputData(outputId: string): Promise<string> {
    try {
      // List objects to find the one with matching output ID
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
    } catch (error) {
      this.logger.error(`Failed to retrieve output data for ID ${outputId}: ${error.message}`);
      throw new Error(`Failed to retrieve output data: ${error.message}`);
    }
  }

  /**
   * Deletes input data from MinIO
   * @param inputId - The unique identifier for the input data
   */
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
    } catch (error) {
      this.logger.error(`Failed to delete input data for ID ${inputId}: ${error.message}`);
      throw new Error(`Failed to delete input data: ${error.message}`);
    }
  }

  /**
   * Deletes output data from MinIO
   * @param outputId - The unique identifier for the output data
   */
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
    } catch (error) {
      this.logger.error(`Failed to delete output data for ID ${outputId}: ${error.message}`);
      throw new Error(`Failed to delete output data: ${error.message}`);
    }
  }

  /**
   * Cleans up old files from both buckets based on age
   * @param maxAgeInDays - Maximum age in days for files to keep
   */
  async cleanupOldFiles(maxAgeInDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);
    
    try {
      await this.cleanupBucket(this.inputBucket, cutoffDate);
      await this.cleanupBucket(this.outputBucket, cutoffDate);
      this.logger.log(`Cleanup completed for files older than ${maxAgeInDays} days`);
    } catch (error) {
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

  /**
   * Gets the health status of MinIO connection
   * @returns Promise<boolean> - True if MinIO is accessible
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.minioClient.bucketExists(this.inputBucket);
      return true;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return false;
    }
  }
}