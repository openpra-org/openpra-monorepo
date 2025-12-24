import { Test, TestingModule } from '@nestjs/testing';
import { SequenceExtractorService } from './sequence-extractor';
import { NodeQuantRequest } from '../../common/types/quantify-request';

describe('SequenceExtractorService', () => {
  let service: SequenceExtractorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequenceExtractorService],
    }).compile();

    service = module.get<SequenceExtractorService>(SequenceExtractorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw error if no event trees found', () => {
    const request: NodeQuantRequest = {
      _id: 'test-id',
      model: {
        eventTrees: [],
      },
    };

    expect(() => service.extractSequenceRequests(request, 'parent-id')).toThrow(
      'No event trees found in the model',
    );
  });

  it('should extract sequence requests correctly', () => {
    const request: NodeQuantRequest = {
      _id: 'test-id',
      settings: {
        missionTime: 24,
      },
      model: {
        eventTrees: [
          {
            name: 'ET1',
            sequences: [
              { name: 'SEQ1', state: 'success' },
              { name: 'SEQ2', state: 'failure' },
            ],
          },
        ],
      },
    };

    const result = service.extractSequenceRequests(request, 'parent-id');

    expect(result.sequenceJobIds).toHaveLength(2);
    expect(result.sequenceJobIds).toContain('parent-id-SEQ1');
    expect(result.sequenceJobIds).toContain('parent-id-SEQ2');

    expect(result.sequenceRequests).toHaveLength(2);

    const seq1Request = result.sequenceRequests.find(
      (r) => r._id === 'parent-id-SEQ1',
    );
    expect(seq1Request).toBeDefined();
    expect(seq1Request?.model?.eventTrees).toHaveLength(1);
    expect(seq1Request?.model?.eventTrees?.[0].sequences).toHaveLength(1);
    expect(seq1Request?.model?.eventTrees?.[0].sequences?.[0].name).toBe(
      'SEQ1',
    );
    expect(seq1Request?.settings).toEqual(request.settings);
  });

  it('should skip event trees with no sequences', () => {
    const request: NodeQuantRequest = {
      _id: 'test-id',
      model: {
        eventTrees: [
          {
            name: 'ET1',
            sequences: [],
          },
          {
            name: 'ET2',
            sequences: [{ name: 'SEQ1', state: 'success' }],
          },
        ],
      },
    };

    const result = service.extractSequenceRequests(request, 'parent-id');

    expect(result.sequenceJobIds).toHaveLength(1);
    expect(result.sequenceJobIds).toContain('parent-id-SEQ1');
  });
});
