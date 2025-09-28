import { Injectable, Logger } from '@nestjs/common';
import { NodeQuantRequest } from 'shared-types/src/openpra-mef/util/quantify-request';

interface SequenceExtractionResult {
  sequenceRequests: NodeQuantRequest[];
  sequenceJobIds: string[];
}

@Injectable()
export class SequenceExtractorService {
  private readonly logger = new Logger(SequenceExtractorService.name);

  /**
   * Extracts individual sequence requests from a complete model
   * @param originalRequest The complete NodeQuantRequest with all sequences
   * @param parentJobId The parent job ID to create child job IDs
   * @returns Array of minimal NodeQuantRequest objects, one per sequence
   */
  public extractSequenceRequests(
    originalRequest: NodeQuantRequest,
    parentJobId: string
  ): SequenceExtractionResult {
    if (!originalRequest.model?.eventTrees?.length) {
      throw new Error('No event trees found in the model');
    }

    const sequenceRequests: NodeQuantRequest[] = [];
    const sequenceJobIds: string[] = [];

    // Process each event tree
    for (const eventTree of originalRequest.model.eventTrees) {
      if (!eventTree.sequences?.length) {
        this.logger.warn(`Event tree ${eventTree.name} has no sequences`);
        continue;
      }

      // Process each sequence in the event tree
      for (const sequence of eventTree.sequences) {
        const sequenceJobId = `${parentJobId}-${sequence.name}`;
        sequenceJobIds.push(sequenceJobId);

        // Extract minimal model for this sequence
        const minimalRequest = this.createMinimalSequenceRequest(
          originalRequest,
          eventTree.name,
          sequence.name,
          sequenceJobId
        );

        sequenceRequests.push(minimalRequest);
      }
    }

    this.logger.debug(
      `Extracted ${sequenceRequests.length} sequence requests from parent job ${parentJobId}`
    );

    return {
      sequenceRequests,
      sequenceJobIds
    };
  }

  /**
   * Creates a minimal NodeQuantRequest for a specific sequence
   */
  private createMinimalSequenceRequest(
    originalRequest: NodeQuantRequest,
    eventTreeName: string,
    sequenceName: string,
    sequenceJobId: string
  ): NodeQuantRequest {
    const originalModel = originalRequest.model!;
    const eventTree = originalModel.eventTrees!.find(et => et.name === eventTreeName)!;
    const sequence = eventTree.sequences!.find(seq => seq.name === sequenceName)!;

    // Identify required fault trees (exclude bypass states)
    const requiredFaultTrees = new Set<string>();
    for (const functionalState of sequence.functionalStates) {
      if (functionalState.state === 'failure' || functionalState.state === 'success') {
        requiredFaultTrees.add(functionalState.name);
      }
      // Skip 'bypass' states - they don't need fault tree data
    }

    // Filter fault trees to only include required ones
    const filteredFaultTrees = originalModel.faultTrees?.filter(ft => 
      requiredFaultTrees.has(ft.name)
    ) || [];

    // Collect all basic events that are referenced by required fault trees
    const requiredBasicEvents = new Set<string>();
    for (const faultTree of filteredFaultTrees) {
      this.collectBasicEventsFromFormula(faultTree.top, requiredBasicEvents);
    }

    // Filter basic events from fault trees
    const filteredBasicEvents: any[] = [];
    for (const faultTree of filteredFaultTrees) {
      if (faultTree.basicEvents) {
        const relevantBasicEvents = faultTree.basicEvents.filter(be => 
          requiredBasicEvents.has(be.name)
        );
        filteredBasicEvents.push(...relevantBasicEvents);
      }
    }

    // Create minimal event tree with only this sequence
    const minimalEventTree = {
      ...eventTree,
      sequences: [sequence] // Only include this specific sequence
    };

    // Create minimal model
    const minimalModel = {
      ...originalModel,
      faultTrees: filteredFaultTrees,
      eventTrees: [minimalEventTree]
    };

    // Create minimal request
    const minimalRequest: NodeQuantRequest = {
      _id: sequenceJobId,
      settings: originalRequest.settings,
      model: minimalModel
    };

    this.logger.debug(
      `Created minimal request for sequence ${sequenceName}: ` +
      `${filteredFaultTrees.length} fault trees, ${filteredBasicEvents.length} basic events`
    );

    return minimalRequest;
  }

  /**
   * Recursively collects basic event names from a fault tree formula
   */
  private collectBasicEventsFromFormula(formula: any, basicEvents: Set<string>): void {
    if (!formula) return;

    if (formula.event) {
      // This is a basic event reference
      basicEvents.add(formula.event);
    } else if (formula.args && Array.isArray(formula.args)) {
      // This is an operator with arguments, recurse into each argument
      for (const arg of formula.args) {
        this.collectBasicEventsFromFormula(arg, basicEvents);
      }
    }
  }

  /**
   * Gets all sequence names from a model for job tracking purposes
   */
  public getAllSequenceNames(model: NodeQuantRequest['model']): string[] {
    if (!model?.eventTrees) return [];

    const sequenceNames: string[] = [];
    for (const eventTree of model.eventTrees) {
      if (eventTree.sequences) {
        sequenceNames.push(...eventTree.sequences.map(seq => seq.name));
      }
    }

    return sequenceNames;
  }
}