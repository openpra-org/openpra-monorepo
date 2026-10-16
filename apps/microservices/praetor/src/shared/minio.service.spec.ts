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
    describe('putText', () => {
        it('should store text in the bucket of its kind', async () => {
            await service.putText('jobs', 'praxis-job.json', '{"a":1}');
            expect(mockMinioClient.putObject).toHaveBeenCalledWith('jobs-bucket', 'praxis-job.json', Buffer.from('{"a":1}', 'utf8'), 7, { 'Content-Type': 'application/json' });
        });
    });
    describe('getText', () => {
        it('should read the stored text from the bucket of its kind', async () => {
            mockMinioClient.getObject.mockResolvedValue({
                [Symbol.asyncIterator]: async function* () {
                    yield Buffer.from('{"a":', 'utf8');
                    yield Buffer.from('1}', 'utf8');
                },
            });
            expect(await service.getText('output', 'result.json')).toBe('{"a":1}');
            expect(mockMinioClient.getObject).toHaveBeenCalledWith('output-bucket', 'result.json');
        });
        it('should return undefined for a missing object', async () => {
            mockMinioClient.getObject.mockRejectedValue(Object.assign(new Error('missing'), { code: 'NoSuchKey' }));
            expect(await service.getText('input', 'missing.json')).toBeUndefined();
        });
        it('should rethrow any other storage error', async () => {
            mockMinioClient.getObject.mockRejectedValue(Object.assign(new Error('denied'), { code: 'AccessDenied' }));
            await expect(service.getText('input', 'secret.json')).rejects.toThrow('denied');
        });
    });
});
