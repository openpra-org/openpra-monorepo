import { Controller, Post, Body, Req, Res, Headers } from "@nestjs/common";
import { Request, Response } from "express";
import * as brotli from "brotli";
import { QuantifyReport } from "shared-types/src/openpra-mef/util/quantify-report";
import { NodeQuantRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { QuantifyService } from "./quantify.service";

@Controller()
export class QuantifyController {
  constructor(private readonly quantifyService: QuantifyService) {}

  @Post("/scram-node")
  async quantifyModel(@Req() req: Request, @Res() res: Response, @Headers('content-type') contentType: string): Promise<void> {
    let requestBody: NodeQuantRequest;
    if (contentType === 'application/octet-stream') {
      const compressedData = req.body as Buffer;
      const decompressedData = brotli.decompress(compressedData);
      const jsonData = Buffer.from(decompressedData).toString('utf8');
      requestBody = JSON.parse(jsonData);
    } else {
      requestBody = req.body as NodeQuantRequest;
    }

    const report = await this.quantifyService.quantifyModel(requestBody);
    const responseJson = JSON.stringify(report);
    const responseBuffer = Buffer.from(responseJson, 'utf8');
    const compressedResponse = brotli.compress(responseBuffer);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Encoding', 'br');
    res.setHeader('Content-Length', compressedResponse.length);
    res.send(Buffer.from(compressedResponse));
  }

  @Post("/with-scram-binary/")
  async withScramBinary(@Body() req): Promise<QuantifyReport> {
    return this.quantifyService.usingScramBinary(req);
  }
}