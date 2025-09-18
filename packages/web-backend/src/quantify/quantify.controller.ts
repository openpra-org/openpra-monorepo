import { Controller, Post, Body, Req, Res, Headers } from "@nestjs/common";
import { Request, Response } from "express";
import * as brotli from "brotli";
import { QuantifyReport } from "shared-types/src/openpra-mef/util/quantify-report";
import { NodeQuantRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { Report } from "shared-types/src/openpra-mef/util/report"
import { QuantifyService } from "./quantify.service";

@Controller()
export class QuantifyController {
  constructor(private readonly quantifyService: QuantifyService) {}

  @Post("/scram-node")
  async quantifyModel(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('content-type') contentType: string
  ): Promise<void> {
    let requestBody: NodeQuantRequest;

    // Check if the request is compressed
    if (contentType === 'application/octet-stream') {
      // Decompress the request body
      const compressedData = req.body as Buffer;
      const decompressedData = brotli.decompress(compressedData);
      const jsonString = Buffer.from(decompressedData).toString('utf8');
      requestBody = JSON.parse(jsonString);
    } else {
      // Handle regular JSON request
      requestBody = req.body as NodeQuantRequest;
    }

    // Process the request
    const report = await this.quantifyService.quantifyModel(requestBody);

    // Compress the response
    const responseJson = JSON.stringify(report);
    const responseBuffer = Buffer.from(responseJson, 'utf8');
    const compressedResponse = brotli.compress(responseBuffer);
    
    console.log(`Original response size: ${responseBuffer.length} bytes`);
    console.log(`Compressed response size: ${compressedResponse.length} bytes`);

    // Set response headers - DON'T set Content-Encoding to prevent auto-decompression
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Compression', 'brotli'); // Custom header to indicate compression
    res.setHeader('Content-Length', compressedResponse.length);

    // Send compressed response
    res.end(Buffer.from(compressedResponse));
  }

  @Post("/with-scram-binary/")
  async withScramBinary(@Body() req): Promise<QuantifyReport> {
    return this.quantifyService.usingScramBinary(req);
  }
}