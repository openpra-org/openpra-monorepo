import { Injectable, Logger } from '@nestjs/common';
import { MinioService, JobMetadata } from '../../shared/minio.service';

export interface ChildJobOutput {
  jobId: string;
  output?: any;
}

export interface JobStatusIds {
  inputId?: string;
  aggregatedOutputJobId: string;
  childJobIds?: string[];
}

export interface JobOutputResponse {
  jobId: string;
  output?: any;
  childOutputs?: ChildJobOutput[];
  aggregatedOutput?: any;
  failedJobs?: Array<{ jobId: string; error?: string }>;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly minioService: MinioService) {}

  public async getQuantifiedReports(): Promise<JobMetadata[]> {
    return this.minioService.getAllJobMetadata();
  }

  public async getJobMetadata(jobId: string): Promise<JobMetadata> {
    return this.minioService.getJobMetadata(jobId);
  }

  public async getJobStatus(jobId: string): Promise<JobStatusIds> {
    const metadata = await this.minioService.getJobMetadata(jobId);

    const parentJobId = metadata.jobId ?? jobId;
    const childJobIds = metadata.childJobs ?? [];

    return {
      inputId: metadata.inputId,
      aggregatedOutputJobId: parentJobId,
      childJobIds: childJobIds.length > 0 ? childJobIds : undefined,
    };
  }

  public async getAggregatedJobOutput(
    jobId: string,
  ): Promise<JobOutputResponse> {
    const metadata = await this.minioService.getJobMetadata(jobId);
    const childOutputsResult = await this.collectChildOutputs(metadata);

    const parentOutput = await this.safeLoadOutput(metadata.outputId);
    const aggregatedOutput =
      childOutputsResult.sequenceResults.length > 0
        ? this.aggregateSequenceResults(childOutputsResult.sequenceResults)
        : undefined;

    return {
      jobId: metadata.jobId ?? jobId,
      output: parentOutput,
      childOutputs:
        childOutputsResult.childOutputs.length > 0
          ? childOutputsResult.childOutputs
          : undefined,
      aggregatedOutput,
      failedJobs:
        childOutputsResult.failedJobs.length > 0
          ? childOutputsResult.failedJobs
          : undefined,
    };
  }

  public async getInputData(inputId: string): Promise<string> {
    return this.minioService.getInputData(inputId);
  }

  public async getOutputData(outputId: string): Promise<string> {
    return this.minioService.getOutputData(outputId);
  }

  public async getJobStats(jobId: string): Promise<{
    sentAt?: number;
    receivedAt?: number;
    stats?: JobMetadata['stats'];
    childStats?: Array<{
      jobId: string;
      sentAt?: number;
      receivedAt?: number;
      stats?: JobMetadata['stats'];
    }>;
  }> {
    const metadata = await this.minioService.getJobMetadata(jobId);

    const result: {
      sentAt?: number;
      receivedAt?: number;
      stats?: JobMetadata['stats'];
      childStats?: Array<{
        jobId: string;
        sentAt?: number;
        receivedAt?: number;
        stats?: JobMetadata['stats'];
      }>;
    } = {
      sentAt: metadata.sentAt,
      receivedAt: metadata.receivedAt,
      stats: metadata.stats,
    };

    // If there are child jobs, collect their stats too
    if (metadata.childJobs && metadata.childJobs.length > 0) {
      const childStats: Array<{
        jobId: string;
        sentAt?: number;
        receivedAt?: number;
        stats?: JobMetadata['stats'];
      }> = [];

      for (const childJobId of metadata.childJobs) {
        try {
          const childMetadata =
            await this.minioService.getJobMetadata(childJobId);
          childStats.push({
            jobId: childJobId,
            sentAt: childMetadata.sentAt,
            receivedAt: childMetadata.receivedAt,
            stats: childMetadata.stats,
          });
        } catch (error: any) {
          this.logger.warn(
            `Could not fetch stats for child job ${childJobId}: ${
              error?.message || String(error)
            }`,
          );
        }
      }

      if (childStats.length > 0) {
        result.childStats = childStats;
      }
    }

    return result;
  }

  private aggregateSequenceResults(sequenceResults: any[]): any {
    if (!sequenceResults || sequenceResults.length === 0) {
      return {
        modelFeatures: {},
        results: { initiatingEvents: [], sumOfProducts: [] },
      };
    }

    const aggregatedResult = {
      modelFeatures: sequenceResults[0]?.modelFeatures ?? {},
      results: {
        initiatingEvents: [] as any[],
        sumOfProducts: [] as any[],
      },
    };

    const ieMap = new Map<
      string,
      { name: string; description?: string; sequences: any[] }
    >();

    for (const res of sequenceResults) {
      const ies = res?.results?.initiatingEvents ?? [];
      for (const ie of ies) {
        const key: string = ie.name;
        if (!ieMap.has(key)) {
          ieMap.set(key, {
            name: ie.name,
            description: ie.description,
            sequences: [],
          });
        }
        const entry = ieMap.get(key)!;
        const seqs = ie?.sequences ?? [];
        for (const seq of seqs) {
          const seqName = seq?.name ?? '';
          if (
            !entry.sequences.some((existing: any) => existing?.name === seqName)
          ) {
            entry.sequences.push(seq);
          }
        }
      }
    }

    for (const entry of ieMap.values()) {
      entry.sequences.sort((a: any, b: any) => {
        const an = String(a?.name ?? '');
        const bn = String(b?.name ?? '');
        const anum = parseInt(an.replace(/\D+/g, ''), 10);
        const bnum = parseInt(bn.replace(/\D+/g, ''), 10);
        if (!Number.isNaN(anum) && !Number.isNaN(bnum)) {
          return anum - bnum;
        }
        return an.localeCompare(bn);
      });
    }

    aggregatedResult.results.initiatingEvents = Array.from(ieMap.values());

    for (const res of sequenceResults) {
      const sop = res?.results?.sumOfProducts ?? [];
      if (sop.length > 0) {
        aggregatedResult.results.sumOfProducts = sop;
        break;
      }
    }

    return aggregatedResult;
  }

  private async collectChildOutputs(metadata: JobMetadata): Promise<{
    childOutputs: ChildJobOutput[];
    failedJobs: Array<{ jobId: string; error?: string }>;
    sequenceResults: any[];
  }> {
    const childOutputs: ChildJobOutput[] = [];
    const failedJobs: Array<{ jobId: string; error?: string }> = [];
    const sequenceResults: any[] = [];

    if (!metadata.childJobs || metadata.childJobs.length === 0) {
      return { childOutputs, failedJobs, sequenceResults };
    }

    for (const childJobId of metadata.childJobs) {
      try {
        const childMetadata =
          await this.minioService.getJobMetadata(childJobId);

        if (childMetadata.status === 'completed' && childMetadata.outputId) {
          const output = await this.safeLoadOutput(childMetadata.outputId);
          if (output === undefined) {
            failedJobs.push({
              jobId: childJobId,
              error: 'Output not available',
            });
            continue;
          }

          childOutputs.push({ jobId: childJobId, output });

          if (output && typeof output === 'object') {
            sequenceResults.push(output);
          }
        } else if (childMetadata.status === 'failed') {
          failedJobs.push({ jobId: childJobId, error: childMetadata.error });
        } else {
          failedJobs.push({
            jobId: childJobId,
            error: `Job status ${
              childMetadata.status ?? 'unknown'
            } does not have output available`,
          });
        }
      } catch (error: any) {
        const message = error?.message || String(error);
        this.logger.error(
          `Failed to load metadata or output for child job ${childJobId}: ${message}`,
        );
        failedJobs.push({ jobId: childJobId, error: message });
      }
    }

    return { childOutputs, failedJobs, sequenceResults };
  }

  private async safeLoadOutput(outputId?: string): Promise<any | undefined> {
    if (!outputId) {
      return undefined;
    }

    try {
      const rawOutput = await this.minioService.getOutputData(outputId);
      try {
        return JSON.parse(rawOutput);
      } catch {
        return rawOutput;
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to load output for ID ${outputId}: ${
          error?.message || String(error)
        }`,
      );
      return undefined;
    }
  }
}
