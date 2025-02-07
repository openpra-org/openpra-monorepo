import { Controller, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { TypedRoute, TypedParam, TypedBody } from "@nestia/core";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ProducerService } from "../services/producer.service";
import { QuantificationJobReport } from "../../middleware/schemas/quantification-job.schema";
import { StorageService } from "../services/storage.service";

@Controller()
export class FtrexController {
  constructor(
    private readonly producerService: ProducerService,
    private readonly storageService: StorageService,
    @InjectModel(QuantificationJobReport.name) private readonly quantificationJobModel: Model<QuantificationJobReport>,
  ) {}

  /**
   * Endpoint to create and queue a quantification job for the FTREX solver.
   *
   * @param quantRequest - The quantification request object containing necessary model data.
   * @returns A promise that resolves to void.
   * @throws {@link InternalServerErrorException} When there is a problem queueing the quantification job.
   */
  @TypedRoute.Post("/ftrex")
  public async createAndQueueQuant(@TypedBody() quantRequest: QuantifyRequest): Promise<void> {
    try {
      const startTime = performance.now();
      this.producerService.createAndQueueQuant(quantRequest);
      const endTime = performance.now();

      await this.quantificationJobModel.findByIdAndUpdate(quantRequest._id, {
        $set: { "execution_time.http_request_processing": endTime - startTime },
      });
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
  @TypedRoute.Get("/ftrex/:model_name")
  public async getQuantifiedReports(@TypedParam("model_name") modelName: string): Promise<number> {
    try {
      return this.storageService.getQuantifiedReports(modelName);
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of quantified reports.");
    }
  }
}
