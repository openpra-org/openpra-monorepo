import { Controller } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
// import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { ProducerService } from "../services/producer.service";
import { StorageService } from "../services/storage.service";

@Controller()
export class ScramController {
  producerService: ProducerService;
  storageService: StorageService;

  constructor(private readonly configService: ConfigService) {
    this.producerService = new ProducerService(this.configService);
    this.storageService = new StorageService(this.configService);
  }

  // @Post()
  // async createQuantifyJobQueue(@Body() request: QuantifyRequest) {
  //   return this.producerService.createQuantifyJobQueue(request);
  // }
  //
  // @Get()
  // async getQuantifiedJobs(): Promise<unknown> {
  //   return this.storageService.getQuantifiedJobs();
  // }
}
