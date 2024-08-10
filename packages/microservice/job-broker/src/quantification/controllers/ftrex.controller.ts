import { Controller, InternalServerErrorException } from "@nestjs/common";
import { TypedRoute, TypedBody } from "@nestia/core";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { ProducerService } from "../services/producer.service";

@Controller()
export class FtrexController {
  constructor(private readonly producerService: ProducerService) {}

  @TypedRoute.Post("/ftrex-quantification")
  public async createAndQueueQuant(@TypedBody() quantRequest: QuantifyRequest): Promise<void> {
    try {
      return this.producerService.createAndQueueQuant(quantRequest);
    } catch {
      throw new InternalServerErrorException("Server encountered a problem while queueing FTREX quantification job.");
    }
  }
}
