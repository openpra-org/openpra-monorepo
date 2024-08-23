/**
 * Controller for handling FTREX quantification requests.
 *
 * Provides endpoints for creating and queueing quantification jobs specific to FTREX.
 * Utilizes the `ProducerService` to manage the creation and queueing of these jobs.
 */

// Importing NestJS common module, TypedRoute and TypedBody decorators from @nestia/core for route and type
// handling, shared types for request validation, and the ProducerService.
import { Controller, InternalServerErrorException } from "@nestjs/common";
import { TypedRoute, TypedBody } from "@nestia/core";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
} from "@nestjs/swagger";
import { ProducerService } from "../services/producer.service";

@Controller()
export class FtrexController {
  /**
   * Constructs the FtrexController with the necessary service.
   * @param producerService - The service to handle creation and queueing of quantification jobs.
   */
  constructor(private readonly producerService: ProducerService) {}

  /**
   * Endpoint to create and queue a quantification job for the FTREX solver.
   *
   * @param quantRequest - The quantification request object containing necessary model data.
   * @returns A promise that resolves to void.
   * @throws {@link InternalServerErrorException} When there is a problem queueing the quantification job.
   */
  @TypedRoute.Post("/ftrex-quantification")
  @ApiOperation({ summary: "Create and queue ftrex quantification jobs" })
  @ApiCreatedResponse({ description: "FTREX quantification request has been successfully queued" })
  @ApiBadRequestResponse({ description: "The request body is invalid" })
  @ApiInternalServerErrorResponse({ description: "Server was unable to queue the job" })
  public async createAndQueueQuant(@TypedBody() quantRequest: QuantifyRequest): Promise<void> {
    try {
      return this.producerService.createAndQueueQuant(quantRequest);
    } catch {
      throw new InternalServerErrorException("Server encountered a problem while queueing FTREX quantification job.");
    }
  }
}
