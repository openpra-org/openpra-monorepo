/**
 * Controller for handling SCRAM quantification requests.
 *
 * Provides endpoints for creating and queueing quantification jobs specific to SCRAM.
 * Utilizes the `ProducerService` to manage the creation and queueing of these jobs,
 * ensuring that any request for SCRAM quantification is processed accordingly.
 */

// Importing NestJS common module, TypedRoute and TypedBody decorators from @nestia/core for route and type handling,
// shared types for request validation, and the ProducerService.
import { Controller, InternalServerErrorException } from "@nestjs/common";
import { TypedRoute, TypedBody } from "@nestia/core";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { ProducerService } from "../services/producer.service";

@Controller()
export class ScramController {
  /**
   * Constructs the ScramController with the necessary service.
   * @param producerService - The service to handle creation and queueing of quantification jobs.
   */
  constructor(private readonly producerService: ProducerService) {}

  /**
   * Endpoint to create and queue a quantification job for SCRAM.
   *
   * @param quantRequest - The quantification request object containing necessary model data.
   * @returns A promise that resolves to void.
   * @throws {@link InternalServerErrorException} When there is a problem queueing the quantification job.
   */
  @TypedRoute.Post("/scram-quantification")
  public async createAndQueueQuant(@TypedBody() quantRequest: QuantifyRequest): Promise<void> {
    try {
      return this.producerService.createAndQueueQuant(quantRequest);
    } catch {
      throw new InternalServerErrorException("Server encountered a problem while queueing SCRAM quantification job.");
    }
  }
}
