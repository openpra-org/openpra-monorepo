import { Body, Controller, Get, InternalServerErrorException, NotFoundException, Post } from "@nestjs/common";
import type { QuantifyRequest } from "mef-types/openpra-mef/util/quantify-request";
import { ProducerService } from "../services/producer.service";
import { QuantificationJobReport } from "../../middleware/schemas/quantification-job.schema";
import { StorageService } from "../services/storage.service";

/**
 * HTTP controller for FTREX quantification jobs.
 *
 * Accepts quantification requests for the FTREX solver and exposes a listing
 * of quantified job reports.
 */
@Controller()
export class FtrexController {
  /**
   * Construct the controller with producer and storage services.
   * @param producerService - Service for publishing quantification jobs to RabbitMQ
   * @param storageService - Service for reading quantified job reports from MongoDB
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
   * @throws `InternalServerErrorException` When there is a problem queueing the quantification job.
   */
  @Post("/ftrex")
  public createAndQueueQuant(@Body() quantRequest: QuantifyRequest): void {
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
   * @throws `NotFoundException` Throws an exception if the server is unable to find the requested list of quantified reports.
   */
  @Get("/ftrex")
  public async getQuantifiedReports(): Promise<QuantificationJobReport[]> {
    try {
      return this.storageService.getQuantifiedReports();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of quantified reports.");
    }
  }
}
