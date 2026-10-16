import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { MinioService } from '../../shared/minio.service';
describe('StorageService', () => {
    let service: StorageService;
    const mockMinioService = {
        getInputData: vi.fn(),
        getOutputData: vi.fn(),
    };
    beforeEach(async () => {
        vi.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StorageService,
                { provide: MinioService, useValue: mockMinioService },
            ],
        }).compile();
        service = module.get<StorageService>(StorageService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('getInputData', () => {
        it('should return input data', async () => {
            const data = 'some-data';
            mockMinioService.getInputData.mockResolvedValue(data);
            expect(await service.getInputData('input-1')).toEqual(data);
        });
    });
    describe('getOutput', () => {
        it('should parse a JSON report', async () => {
            const report = { results: { initiatingEvents: [], sumOfProducts: [] } };
            mockMinioService.getOutputData.mockResolvedValue(JSON.stringify(report));
            expect(await service.getOutput('job-1')).toEqual(report);
            expect(mockMinioService.getOutputData).toHaveBeenCalledWith('job-1');
        });
        it('should return a report that is not JSON as text', async () => {
            mockMinioService.getOutputData.mockResolvedValue('plain report');
            expect(await service.getOutput('job-1')).toBe('plain report');
        });
        it('should return undefined when the report cannot be read', async () => {
            mockMinioService.getOutputData.mockRejectedValue(new Error('missing'));
            expect(await service.getOutput('job-1')).toBeUndefined();
        });
    });
});
