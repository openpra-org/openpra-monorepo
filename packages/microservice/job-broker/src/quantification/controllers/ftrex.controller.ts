import { Controller } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ProducerService } from "../services/producer.service";
import { StorageService } from "../services/storage.service";

@Controller()
export class FtrexController {
  producerService: ProducerService;
  storageService: StorageService;

  constructor(private readonly configService: ConfigService) {
    this.producerService = new ProducerService(this.configService);
    this.storageService = new StorageService(this.configService);
  }
}
