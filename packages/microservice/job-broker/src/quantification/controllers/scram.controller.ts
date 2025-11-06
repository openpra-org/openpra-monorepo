import { Body, Controller, Get, InternalServerErrorException, NotFoundException, Post } from "@nestjs/common";
import type { QuantifyRequest } from "shared-types";
import { ProducerService } from "../services/producer.service";
import { QuantificationJobReport } from "../../middleware/schemas/quantification-job.schema";
import { StorageService } from "../services/storage.service";

/**
 * HTTP controller for SCRAM quantification jobs.
 *
 * Accepts quantification requests for the SCRAM solver and exposes a listing
 * of quantified job reports.
 */
@Controller()
export class ScramController {
  /**
   * Constructs the ScramController with the necessary service.
   * @param producerService - The service to handle creation and queueing of quantification jobs.
   * @param storageService - The service to retrieve quantified reports
   */
  constructor(
    private readonly producerService: ProducerService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Endpoint to create and queue a quantification job for SCRAM.
   *
   * @param quantRequest - The quantification request object containing necessary model data.
   * @returns A promise that resolves to void.
   * @throws `InternalServerErrorException` When there is a problem queueing the quantification job.
   */
  @Post("/scram")
  public createAndQueueQuant(@Body() quantRequest: QuantifyRequest): void {
    try {
      this.producerService.createAndQueueQuant(quantRequest);
    } catch {
      throw new InternalServerErrorException("Server encountered a problem while queueing SCRAM quantification job.");
    }
  }

  /**
   * Controller method to handle GET requests for quantified reports at the "/scram" endpoint.
   *
   * @returns A promise that resolves to an array of QuantifiedReport objects.
   * @throws `NotFoundException` Throws an exception if the server is unable to find the requested list of quantified reports.
   */
  @Get("/scram")
  public async getQuantifiedReports(): Promise<QuantificationJobReport[]> {
    try {
      return this.storageService.getQuantifiedReports();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of quantified reports.");
    }
  }
}
