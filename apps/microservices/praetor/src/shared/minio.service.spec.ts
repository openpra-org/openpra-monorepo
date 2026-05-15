import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MinioService } from './minio.service';
import { EnvVarKeys } from '../../config/env_vars.config';
const mockMinioClient = {
    bucketExists: vi.fn(),
    makeBucket: vi.fn(),
    listObjects: vi.fn(),
    getObject: vi.fn(),
    putObject: vi.fn(),
};
vi.mock('minio', () => {
    return {
        Client: class {
            constructor() {
                return mockMinioClient;
            }
        },
    };
});
describe('MinioService', () => {
    let service: MinioService;
    let minioClient: any;
    const mockConfigService = {
        getOrThrow: vi.fn((key: string) => {
            switch (key) {
                case EnvVarKeys.ENV_MINIO_INPUT_BUCKET:
                    return 'input-bucket';
                case EnvVarKeys.ENV_MINIO_OUTPUT_BUCKET:
                    return 'output-bucket';
                case EnvVarKeys.ENV_MINIO_JOBS_BUCKET:
                    return 'jobs-bucket';
                case EnvVarKeys.ENV_MINIO_ENDPOINT:
                    return 'localhost';
                case EnvVarKeys.ENV_MINIO_PORT:
                    return 9000;
                case EnvVarKeys.ENV_MINIO_ACCESS_KEY:
                    return 'minio';
                case EnvVarKeys.ENV_MINIO_SECRET_KEY:
                    return 'minio123';
                default:
                    return null;
            }
        }),
    };
    beforeEach(async () => {
        vi.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MinioService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();
        service = module.get<MinioService>(MinioService);
        minioClient = mockMinioClient;
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('onModuleInit', () => {
        it('should initialize buckets if they do not exist', async () => {
            mockMinioClient.bucketExists.mockResolvedValue(false);
            await service.onModuleInit();
            expect(mockMinioClient.bucketExists).toHaveBeenCalledTimes(3);
            expect(mockMinioClient.makeBucket).toHaveBeenCalledTimes(3);
            expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('input-bucket');
            expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('output-bucket');
            expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('jobs-bucket');
        });
        it('should not create buckets if they already exist', async () => {
            mockMinioClient.bucketExists.mockResolvedValue(true);
            await service.onModuleInit();
            expect(mockMinioClient.bucketExists).toHaveBeenCalledTimes(3);
            expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
        });
    });
    describe('getCompletedSequenceCount', () => {
        it('should return count of completed sequences', async () => {
            const mockStream = {
                [Symbol.asyncIterator]: async function* () {
                    yield { name: 'obj1' };
                    yield { name: 'obj2' };
                },
            };
            mockMinioClient.listObjects.mockReturnValue(mockStream);
            const count = await service.getCompletedSequenceCount('parent-job-id');
            expect(count).toBe(2);
            expect(mockMinioClient.listObjects).toHaveBeenCalledWith('jobs-bucket', 'job-parent-job-id/completed/', true);
        });
        it('should return 0 if stream is empty', async () => {
            const mockStream = {
                [Symbol.asyncIterator]: async function* () { },
            };
            mockMinioClient.listObjects.mockReturnValue(mockStream);
            const count = await service.getCompletedSequenceCount('parent-job-id');
            expect(count).toBe(0);
        });
    });
});
