import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { Channel, ChannelModel, ConsumeMessage } from "amqplib";
import typia from "typia";
import { QuantifyModel } from "scram-node";
import { NodeQuantRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { RpcException } from "@nestjs/microservices";
import { QueueService, QueueConfig, QueueConfigFactory, RabbitMQChannelModelService, MinioService } from "../../shared";

@Injectable()
export class ConsumerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ConsumerService.name);
  private readonly quantQueueConfig: QueueConfig;
  private readonly distributedSequencesQueueConfig: QueueConfig;
  private channelModel: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(
    private readonly queueService: QueueService,
    private readonly rabbitmqService: RabbitMQChannelModelService,
    private readonly queueConfigFactory: QueueConfigFactory,
    private readonly minioService: MinioService,
  ) {
    this.quantQueueConfig = this.queueConfigFactory.createQuantJobQueueConfig();
    this.distributedSequencesQueueConfig = this.queueConfigFactory.createDistributedSequencesJobQueueConfig();
  }

  async onApplicationBootstrap(): Promise<void> {
    this.logger.debug("Connecting to the broker");
    this.channelModel = await this.rabbitmqService.getChannelModel(ConsumerService.name);
    this.channel = await this.rabbitmqService.getChannel(this.channelModel, ConsumerService.name);
    await this.queueService.setupQueue(this.quantQueueConfig, this.channel);
    await this.queueService.setupQueue(this.distributedSequencesQueueConfig, this.channel);
    this.logger.debug("Initialized and consuming from both queues");
    await this.consumeQuantJobs();
    await this.consumeDistributedSequenceJobs();
  }

  private async consumeQuantJobs(): Promise<void> {
    try {
      await this.channel?.checkQueue(this.quantQueueConfig.name);
    } catch (err) {
      throw new RpcException(`Queue: ${this.quantQueueConfig.name} does not exist.`);
    }

    await this.channel?.consume(
      this.quantQueueConfig.name,
      async (msg: ConsumeMessage | null) => {
        if (msg === null) {
          throw new RpcException(
            `${ConsumerService.name} consumed a null message from ${this.quantQueueConfig.name} queue.`,
          );
        }

        const modelsData = ((): NodeQuantRequest => {
          try {
            this.logger.debug("Gets the message body from the Quantification queue");
            return typia.json.assertParse<NodeQuantRequest>(msg.content.toString());
          } catch (err) {
            this.channel?.nack(msg, false, false);
            throw new RpcException(
              `${ConsumerService.name} consumed an invalid message from ${this.quantQueueConfig.name} queue.`,
            );
          }
        })();

        try {
          await this.handleRegularJob(modelsData);
        } catch (err: any) {
          this.channel?.nack(msg, false, false);
          await this.minioService.updateJobMetadata(String(modelsData._id), {
            status: "failed",
            error: err.message,
          });
          this.logger.error(`Failed to quantify regular job: ${String(modelsData._id)}`);
          return;
        }

        this.channel?.ack(msg);
        this.logger.debug(`Acknowledged regular job: ${String(modelsData._id)}`);
      },
      { noAck: false },
    );
  }

  private async consumeDistributedSequenceJobs(): Promise<void> {
    try {
      await this.channel?.checkQueue(this.distributedSequencesQueueConfig.name);
    } catch (err) {
      throw new RpcException(`Queue: ${this.distributedSequencesQueueConfig.name} does not exist.`);
    }

    await this.channel?.consume(
      this.distributedSequencesQueueConfig.name,
      async (msg: ConsumeMessage | null) => {
        if (msg === null) {
          throw new RpcException(
            `${ConsumerService.name} consumed a null message from ${this.distributedSequencesQueueConfig.name} queue.`,
          );
        }

        const modelsData = ((): NodeQuantRequest => {
          try {
            this.logger.debug("Gets the message body from the Distributed Sequences queue");
            return typia.json.assertParse<NodeQuantRequest>(msg.content.toString());
          } catch (err) {
            this.channel?.nack(msg, false, false);
            throw new RpcException(
              `${ConsumerService.name} consumed an invalid message from ${this.distributedSequencesQueueConfig.name} queue.`,
            );
          }
        })();

        try {
          await this.handleSequenceJob(modelsData);
        } catch (err: any) {
          this.channel?.nack(msg, false, false);
          
          // Mark parent job as failed if any sequence fails
          const parentJobId = this.extractParentJobId(String(modelsData._id));
          if (parentJobId) {
            await this.minioService.updateJobMetadata(parentJobId, {
              status: "failed",
              error: `Sequence job ${modelsData._id} failed: ${err.message}`,
            });
          }
          
          this.logger.error(`Failed to quantify sequence job: ${String(modelsData._id)}`);
          return;
        }

        this.channel?.ack(msg);
        this.logger.debug(`Acknowledged sequence job: ${String(modelsData._id)}`);
      },
      { noAck: false },
    );
  }

  private async handleRegularJob(nodeQuantRequest: NodeQuantRequest): Promise<void> {
    const jobId = String(nodeQuantRequest._id);
    
    this.logger.debug(`Running regular job: ${jobId}`);
    await this.minioService.updateJobMetadata(jobId, { status: "running" });

    const result = await this.performQuantification(nodeQuantRequest);
    
    const outputDataString = JSON.stringify(result);
    const outputId = await this.minioService.storeOutputData(outputDataString, jobId);
    
    await this.minioService.updateJobMetadata(jobId, {
      status: "completed",
      outputId: outputId,
    });
    
    this.logger.debug(`Completed regular job: ${jobId}`);
  }

  private async handleSequenceJob(nodeQuantRequest: NodeQuantRequest): Promise<void> {
    const sequenceJobId = String(nodeQuantRequest._id);
    const parentJobId = this.extractParentJobId(sequenceJobId);
    
    if (!parentJobId) {
      throw new Error(`Invalid sequence job ID format: ${sequenceJobId}`);
    }

    this.logger.debug(`Processing sequence job ${sequenceJobId} for parent ${parentJobId}`);

    // Store sequence job input and create proper metadata
    const inputId = await this.minioService.storeInputData(nodeQuantRequest);
    await this.minioService.createJobMetadata(sequenceJobId, inputId);
    
    // Update sequence job status to running
    await this.minioService.updateJobMetadata(sequenceJobId, { status: "running" });

    // Perform quantification on sequence
    const result = await this.performQuantification(nodeQuantRequest);

    // Store sequence result in its own metadata
    const outputId = await this.minioService.storeOutputData(JSON.stringify(result), sequenceJobId);
    await this.minioService.updateJobMetadata(sequenceJobId, {
      status: "completed",
      outputId: outputId,
    });

    // Mark this sequence as completed in parent
    await this.markSequenceCompleted(parentJobId, sequenceJobId);

    // Check if all sequences are complete
    const allCompleted = await this.checkAllSequencesCompleted(parentJobId);
    
    if (allCompleted) {
      this.logger.debug(`All sequences completed for parent ${parentJobId}, aggregating results`);
      await this.aggregateParentJob(parentJobId);
    }
  }

  private extractParentJobId(sequenceJobId: string): string | null {
    const parts = sequenceJobId.split('-');
    // UUID has 5 parts (4 dashes), sequence job has 6 parts (5 dashes)
    if (parts.length === 6) {
      return parts.slice(0, 5).join('-'); // Take first 5 parts (parent UUID)
    }
    return null;
  }

  private async markSequenceCompleted(parentJobId: string, sequenceJobId: string): Promise<void> {
    const parentMetadata = await this.minioService.getJobMetadata(parentJobId);
    
    if (!parentMetadata.completedSequences) {
      parentMetadata.completedSequences = [];
    }
    
    parentMetadata.completedSequences.push(sequenceJobId);
    await this.minioService.updateJobMetadata(parentJobId, parentMetadata);
  }

  private async checkAllSequencesCompleted(parentJobId: string): Promise<boolean> {
    const parentMetadata = await this.minioService.getJobMetadata(parentJobId);
    
    if (!parentMetadata.childJobs || !parentMetadata.completedSequences) {
      return false;
    }

    return parentMetadata.completedSequences.length === parentMetadata.childJobs.length;
  }

  private async aggregateParentJob(parentJobId: string): Promise<void> {
    try {
      const parentMetadata = await this.minioService.getJobMetadata(parentJobId);
      
      // Get all individual sequence results
      const allSequenceResults = [];
      if (parentMetadata.childJobs) {
        for (const sequenceJobId of parentMetadata.childJobs) {
          const sequenceMetadata = await this.minioService.getJobMetadata(sequenceJobId);
          const sequenceOutput = await this.minioService.getOutputData(String(sequenceMetadata.outputId));
          allSequenceResults.push(JSON.parse(sequenceOutput));
        }
      }
      
      // Aggregate results
      const aggregatedResult = this.aggregateSequenceResults(allSequenceResults);

      // Store aggregated results
      const outputId = await this.minioService.storeOutputData(JSON.stringify(aggregatedResult), parentJobId);
      
      // Update parent job as completed
      await this.minioService.updateJobMetadata(parentJobId, {
        status: "completed",
        outputId,
        completedSequences: undefined // Clean up
      });

      this.logger.debug(`Parent job ${parentJobId} completed with aggregated results`);
    } catch (error: any) {
      this.logger.error(`Failed to aggregate results for parent ${parentJobId}: ${error}`);
      await this.minioService.updateJobMetadata(parentJobId, { 
        status: "failed", 
        error: `Aggregation failed: ${error.message}` 
      });
    }
  }

  private aggregateSequenceResults(sequenceResults: any[]): any {
    // Take model features from first result (identical across all sequences)
    const aggregatedResult = {
      modelFeatures: sequenceResults[0].modelFeatures,
      results: {
        initiatingEvents: [] as any[],
        sumOfProducts: [] as any[],
      }
    };

    // Aggregate sequences and sum of products
    const allSequences: any[] = [];
    const allSumOfProducts: any[] = [];

    for (const result of sequenceResults) {
      if (result.results?.initiatingEvents?.length > 0) {
        const initiatingEvent = result.results.initiatingEvents[0];
        if (initiatingEvent.sequences) {
          allSequences.push(...initiatingEvent.sequences);
        }
      }
      
      if (result.results?.sumOfProducts) {
        allSumOfProducts.push(...result.results.sumOfProducts);
      }
    }

    // Reconstruct initiating events with combined sequences
    if (sequenceResults[0].results?.initiatingEvents?.length > 0) {
      const firstInitiatingEvent = sequenceResults[0].results.initiatingEvents[0];
      aggregatedResult.results.initiatingEvents = [{
        ...firstInitiatingEvent,
        sequences: allSequences
      }];
    }

    // Add combined sum of products
    aggregatedResult.results.sumOfProducts = allSumOfProducts;

    return aggregatedResult;
  }

  public async performQuantification(nodeQuantRequest: NodeQuantRequest): Promise<any> {
    const { _id, ...quantRequest } = nodeQuantRequest;

    try {
      this.logger.debug(`${String(_id)} is running with scram-node`);
      
      const report = await QuantifyModel(quantRequest.settings, quantRequest.model);
      
      this.logger.debug(`${String(_id)} has been quantified using scram-node`);
      
      return report;
    } catch (error) {
      this.logger.error(`Quantification failed for job ${String(_id)}:`, error);
      throw error;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.channel?.deleteQueue(this.quantQueueConfig.name);
      await this.channel?.deleteQueue(this.distributedSequencesQueueConfig.name);
      await this.channel?.close();
      await this.channelModel?.close();
    } catch (err) {
      throw new RpcException(`${ConsumerService.name} failed to stop RabbitMQ services.`);
    }
  }
}