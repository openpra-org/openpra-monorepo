import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RaptorManagerModule } from '../src/raptor-manager.module';
import { ProducerService } from '../src/quantification/services/producer.service';
import { StorageService } from '../src/quantification/services/storage.service';
import { MinioService } from '../src/shared/minio.service';
import { readFileSync } from 'fs';
import { join } from 'path';
import { json, urlencoded } from 'express';

// Mock nestia decorators to use standard NestJS decorators
vi.mock('@nestia/core', async () => {
  const common = await import('@nestjs/common');
  return {
    TypedRoute: {
      Get: common.Get,
      Post: common.Post,
    },
    TypedBody: common.Body,
    TypedQuery: common.Query,
    TypedParam: common.Param,
  };
});

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let producerService: ProducerService;

  const mockProducerService = {
    createAndQueueQuant: vi.fn(),
    createAndQueueSequenceBatch: vi.fn(),
    createAndQueueAdaptiveSequenceBatch: vi.fn(),
  };

  const mockStorageService = {
    // Add methods if needed by the controller during the request
  };

  const mockMinioService = {
    bucketExists: vi.fn().mockResolvedValue(true),
    makeBucket: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [RaptorManagerModule],
    })
      .overrideProvider(ProducerService)
      .useValue(mockProducerService)
      .overrideProvider(StorageService)
      .useValue(mockStorageService)
      .overrideProvider(MinioService)
      .useValue(mockMinioService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ extended: true, limit: '50mb' }));
    await app.init();

    producerService = moduleFixture.get<ProducerService>(ProducerService);
  });

  afterEach(async () => {
    await app.close();
  });

  const loadFixture = (path: string) => {
    return JSON.parse(
      readFileSync(
        join(__dirname, '../../../../fixtures/models/MHTGR', path),
        'utf-8',
      ),
    );
  };

  it('/scram (POST) - distributedSequences=no', async () => {
    const payload = loadFixture('JSON/chinese.json');
    const mockJobId = 'mock-job-id';
    mockProducerService.createAndQueueQuant.mockResolvedValue(mockJobId);

    const response = await request(app.getHttpServer())
      .post('/q/quantify/scram')
      .send(payload)
      .expect(201);

    expect(response.body).toEqual({ jobId: mockJobId });
    expect(mockProducerService.createAndQueueQuant).toHaveBeenCalled();
  });

  it('/scram (POST) - distributedSequences=yes', async () => {
    const payload = loadFixture('JSON/ATRS.json');
    const mockSequenceJobIds = ['job-1-seq1', 'job-1-seq2'];
    mockProducerService.createAndQueueSequenceBatch.mockResolvedValue(
      mockSequenceJobIds,
    );

    const response = await request(app.getHttpServer())
      .post('/q/quantify/scram?distributedSequences=yes')
      .send(payload)
      .expect(201);

    expect(response.body).toEqual({
      parentJobId: 'job-1',
      sequenceJobIds: mockSequenceJobIds,
    });
    expect(mockProducerService.createAndQueueSequenceBatch).toHaveBeenCalled();
  });

  it('/scram/adaptive (POST)', async () => {
    const payload = loadFixture('Adaptive/ATRS.json');
    const mockJobId = 'mock-adaptive-job-id';
    mockProducerService.createAndQueueQuant.mockResolvedValue(mockJobId);

    const response = await request(app.getHttpServer())
      .post('/q/quantify/scram/adaptive')
      .send(payload)
      .expect(201);

    expect(response.body).toEqual({ jobId: mockJobId });
    expect(mockProducerService.createAndQueueQuant).toHaveBeenCalled();
  });
});
