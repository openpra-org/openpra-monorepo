import { Injectable, Logger } from '@nestjs/common';
import { NodeQuantRequest } from '../../common/types/quantify-request';

interface SequenceExtractionResult {
  sequenceRequests: NodeQuantRequest[];
  sequenceJobIds: string[];
}

@Injectable()
export class SequenceExtractorService {
  private readonly logger = new Logger(SequenceExtractorService.name);

  public extractSequenceRequests(
    originalRequest: NodeQuantRequest,
    parentJobId: string,
  ): SequenceExtractionResult {
    if (!originalRequest.model?.eventTrees?.length) {
      throw new Error('No event trees found in the model');
    }

    const sequenceRequests: NodeQuantRequest[] = [];
    const sequenceJobIds: string[] = [];

    for (const eventTree of originalRequest.model.eventTrees) {
      if (!eventTree.sequences?.length) {
        this.logger.warn(`Event tree ${eventTree.name} has no sequences`);
        continue;
      }

      for (const sequence of eventTree.sequences) {
        const sequenceJobId = `${parentJobId}-${sequence.name}`;
        sequenceJobIds.push(sequenceJobId);

        const sequenceRequest = this.createSequenceRequest(
          originalRequest,
          eventTree.name,
          String(sequence.name),
          sequenceJobId,
        );

        sequenceRequests.push(sequenceRequest);
      }
    }

    this.logger.debug(
      `Extracted ${sequenceRequests.length} sequence requests from parent job ${parentJobId}`,
    );

    return {
      sequenceRequests,
      sequenceJobIds,
    };
  }

  private createSequenceRequest(
    originalRequest: NodeQuantRequest,
    eventTreeName: string,
    sequenceName: string,
    sequenceJobId: string,
  ): NodeQuantRequest {
    const originalModel = originalRequest.model!;
    const eventTree = originalModel.eventTrees!.find(
      (et) => et.name === eventTreeName,
    )!;
    const sequence = eventTree.sequences!.find(
      (seq) => seq.name === sequenceName,
    )!;

    const singleSequenceEventTree = {
      ...eventTree,
      sequences: [sequence],
    };

    const sequenceModel = {
      ...originalModel,
      eventTrees: [singleSequenceEventTree],
    };

    const sequenceRequest: NodeQuantRequest = {
      _id: sequenceJobId,
      settings: originalRequest.settings,
      model: sequenceModel,
    };

    return sequenceRequest;
  }
}
