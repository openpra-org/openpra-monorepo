import { Controller, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { TypedRoute, TypedBody } from "@nestia/core";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { ProducerService } from "../services/producer.service";
import { QuantifiedReport } from "../schemas/quantified-report.schema";
import { StorageService } from "../services/storage.service";

@Controller()
export class ScramController {
  private scramLatency = 0;
  private scramMemoryUsage = 0;
  private scramCpuUsage = 0;

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
   * @throws {@link InternalServerErrorException} When there is a problem queueing the quantification job.
   */
  @TypedRoute.Post("/scram")
  public createAndQueueQuant(@TypedBody() quantRequest: QuantifyRequest): void {
    const startTime = performance.now();
    const startCpuUsage = process.cpuUsage();
    const startMemoryUsage = process.memoryUsage().heapUsed;

    try {
      this.producerService.createAndQueueQuant(quantRequest);
    } catch {
      throw new InternalServerErrorException("Server encountered a problem while queueing SCRAM quantification job.");
    } finally {
      const endTime = performance.now();
      const endCpuUsage = process.cpuUsage();
      const endMemoryUsage = process.memoryUsage().heapUsed;

      const latency = endTime - startTime;
      const cpuUsage = (endCpuUsage.user + endCpuUsage.system - startCpuUsage.user - startCpuUsage.system) / 1000; // in milliseconds
      const memoryUsage = (endMemoryUsage - startMemoryUsage) / (1024 * 1024); // in MB

      this.setScramLatency(latency);
      this.setScramCpuUsage(cpuUsage);
      this.setScramMemoryUsage(memoryUsage);
    }
  }

  /**
   * Controller method to handle GET requests for quantified reports at the "/scram" endpoint.
   *
   * @returns A promise that resolves to an array of QuantifiedReport objects.
   * @throws {@link NotFoundException} Throws an exception if the server is unable to find the requested list of quantified reports.
   */
  @TypedRoute.Get("/scram")
  public async getQuantifiedReports(): Promise<QuantifiedReport[]> {
    try {
      return this.storageService.getQuantifiedReports();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of quantified reports.");
    }
  }

  public getScramLatency(): number {
    return this.scramLatency;
  }

  private setScramLatency(latency: number): void {
    this.scramLatency = latency;
  }

  public getScramCpuUsage(): number {
    return this.scramCpuUsage;
  }

  private setScramCpuUsage(cpuUsage: number): void {
    this.scramCpuUsage = cpuUsage;
  }

  public getScramMemoryUsage(): number {
    return this.scramMemoryUsage;
  }

  private setScramMemoryUsage(memoryUsage: number): void {
    this.scramMemoryUsage = memoryUsage;
  }
}
