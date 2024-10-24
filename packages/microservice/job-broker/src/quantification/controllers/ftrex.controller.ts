/**
 * Controller for handling FTREX quantification requests.
 *
 * Provides endpoints for creating and queueing quantification jobs specific to FTREX.
 * Utilizes the `ProducerService` to manage the creation and queueing of these jobs.
 */

// Importing NestJS common module, TypedRoute and TypedBody decorators from @nestia/core for route and type
// handling, shared types for request validation, and the ProducerService.
import { Controller, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { TypedRoute, TypedBody } from "@nestia/core";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { ProducerService } from "../services/producer.service";
import { QuantifiedReport } from "../schemas/quantified-report.schema";
import { StorageService } from "../services/storage.service";

@Controller()
export class FtrexController {
  /**
   * Constructs the FtrexController with the necessary service.
   * @param producerService - The service to handle creation and queueing of quantification jobs.
   * @param storageService - The service to retrieve quantified reports
   */
  constructor(
    private readonly producerService: ProducerService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Endpoint to create and queue a quantification job for the FTREX solver.
   *
   * @param quantRequest - The quantification request object containing necessary model data.
   * @returns A promise that resolves to void.
   * @throws {@link InternalServerErrorException} When there is a problem queueing the quantification job.
   */
  @TypedRoute.Post("/ftrex")
  public createAndQueueQuant(@TypedBody() quantRequest: QuantifyRequest): void {
    try {
      this.producerService.createAndQueueQuant(quantRequest);
    } catch {
      throw new InternalServerErrorException("Server encountered a problem while queueing FTREX quantification job.");
    }
  }

  /**
   * Controller method to handle GET requests for quantified reports at the "/ftrex" endpoint.
   *
   * @returns A promise that resolves to an array of QuantifiedReport objects.
   * @throws {@link NotFoundException} Throws an exception if the server is unable to find the requested list of quantified reports.
   */
  @TypedRoute.Get("/ftrex")
  public async getQuantifiedReports(): Promise<QuantifiedReport[]> {
    try {
      return this.storageService.getQuantifiedReports();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of quantified reports.");
    }
  }
}
