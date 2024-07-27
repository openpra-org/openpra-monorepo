import { Controller } from "@nestjs/common";
import { TypedRoute, TypedBody } from "@nestia/core";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { ProducerService } from "../services/producer.service";

@Controller()
export class ScramController {
  constructor(private readonly producerService: ProducerService) {}

  @TypedRoute.Post("/scram-quantification")
  public async createAndQueueQuant(@TypedBody() quantRequest: QuantifyRequest): Promise<boolean> {
    return this.producerService.createAndQueueQuant(quantRequest);
  }
}
