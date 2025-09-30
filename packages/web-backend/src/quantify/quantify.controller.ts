import { Controller, Post, Body, Req, Res, Headers } from "@nestjs/common";
import { Request, Response } from "express";
import * as brotli from "brotli";
import { QuantifyReport } from "shared-types/src/openpra-mef/util/quantify-report";
import { NodeQuantRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { QuantifyService } from "./quantify.service";
import { MinioService } from "./minio.service";

interface MinioQuantifyResponse {
  inputId: string;
  outputId: string;
  timestamp: string;
  status: 'success' | 'error';
  error?: string;
}

@Controller()
export class QuantifyController {
  constructor(
    private readonly quantifyService: QuantifyService,
    private readonly minioService: MinioService
  ) {}

  @Post("/scram-node")
  async quantifyModel(@Req() req: Request, @Res() res: Response, @Headers('content-type') contentType: string): Promise<void> {
    let requestBody: NodeQuantRequest;
    let inputId: string;
    let outputId: string;

    try {
      // Decompress and parse the request
      if (contentType === 'application/octet-stream') {
        const compressedData = req.body as Buffer;
        const decompressedData = brotli.decompress(compressedData);
        const jsonString = Buffer.from(decompressedData).toString('utf8');
        requestBody = JSON.parse(jsonString);
      } else {
        requestBody = req.body as NodeQuantRequest;
      }

      // Store decompressed input data in MinIO
      const inputDataString = JSON.stringify(requestBody);
      inputId = await this.minioService.storeInputData(inputDataString);

      // Perform quantification
      const report = await this.quantifyService.quantifyModel(requestBody);

      // Store output data in MinIO
      const outputDataString = JSON.stringify(report);
      outputId = await this.minioService.storeOutputData(outputDataString, inputId);

      // Create lightweight response with MinIO references
      const minioResponse: MinioQuantifyResponse = {
        inputId,
        outputId,
        timestamp: new Date().toISOString(),
        status: 'success'
      };

      console.log(`Input ID: ${inputId}, Output ID: ${outputId}`);

      // Send lightweight response without compression
      res.setHeader('Content-Type', 'application/json');
      res.json(minioResponse);

    } catch (error) {
      console.error('Quantify model error:', error);

      // Create error response
      const errorResponse: MinioQuantifyResponse = {
        inputId: inputId || '',
        outputId: '',
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message || 'Unknown error occurred'
      };

      res.status(500);
      res.setHeader('Content-Type', 'application/json');
      res.json(errorResponse);
    }
  }

  @Post("/get-input-data/:inputId")
  async getInputData(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const inputId = req.params.inputId;
      const inputData = await this.minioService.getInputData(inputId);

      // Compress and send the input data
      const responseBuffer = Buffer.from(inputData, 'utf8');
      const compressedResponse = brotli.compress(responseBuffer);

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', compressedResponse.length);

      res.end(Buffer.from(compressedResponse));
    } catch (error) {
      console.error('Get input data error:', error);
      res.status(404).json({ error: error.message });
    }
  }

  @Post("/get-output-data/:outputId")
  async getOutputData(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const outputId = req.params.outputId;
      const outputData = await this.minioService.getOutputData(outputId);

      // Compress and send the output data
      const responseBuffer = Buffer.from(outputData, 'utf8');
      const compressedResponse = brotli.compress(responseBuffer);

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', compressedResponse.length);

      res.end(Buffer.from(compressedResponse));
    } catch (error) {
      console.error('Get output data error:', error);
      res.status(404).json({ error: error.message });
    }
  }

  @Post("/cleanup-data")
  async cleanupData(@Body() body: { inputId?: string; outputId?: string; maxAgeInDays?: number }): Promise<{ message: string }> {
    try {
      if (body.inputId) {
        await this.minioService.deleteInputData(body.inputId);
      }
      
      if (body.outputId) {
        await this.minioService.deleteOutputData(body.outputId);
      }

      if (body.maxAgeInDays) {
        await this.minioService.cleanupOldFiles(body.maxAgeInDays);
      }

      return { message: 'Cleanup completed successfully' };
    } catch (error) {
      console.error('Cleanup error:', error);
      throw error;
    }
  }

  @Post("/health-check")
  async healthCheck(): Promise<{ status: string; minio: boolean; timestamp: string }> {
    try {
      const minioHealth = await this.minioService.isHealthy();
      
      return {
        status: minioHealth ? 'healthy' : 'degraded',
        minio: minioHealth,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Health check error:', error);
      return {
        status: 'unhealthy',
        minio: false,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Post("/with-scram-binary/")
  async withScramBinary(@Body() req): Promise<QuantifyReport> {
    return this.quantifyService.usingScramBinary(req);
  }
}