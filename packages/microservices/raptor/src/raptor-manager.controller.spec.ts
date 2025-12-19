import { Test, TestingModule } from '@nestjs/testing';
import { RaptorManagerController } from './raptor-manager.controller';
import { RaptorManagerService } from './raptor-manager.service';
import { NotFoundException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

vi.mock('fs');
vi.mock('path');

describe('RaptorManagerController', () => {
  let controller: RaptorManagerController;

  const mockService = {
    getJobTypes: vi.fn(),
    getProcessingJobs: vi.fn(),
    getRunningJobs: vi.fn(),
    getCompletedJobs: vi.fn(),
    getPartialJobs: vi.fn(),
    getFailedJobs: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RaptorManagerController],
      providers: [
        {
          provide: RaptorManagerService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<RaptorManagerController>(RaptorManagerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getJobTypes', () => {
    it('should return job types', () => {
      const result = { services: [{ name: 'Test', endpoint: '/test' }] };
      mockService.getJobTypes.mockReturnValue(result);
      expect(controller.getJobTypes()).toBe(result);
    });

    it('should throw NotFoundException on error', () => {
      mockService.getJobTypes.mockImplementation(() => {
        throw new Error();
      });
      expect(() => controller.getJobTypes()).toThrow(NotFoundException);
    });
  });

  describe('getProcessingJobs', () => {
    it('should return processing jobs', async () => {
      const result = { jobs: [] };
      mockService.getProcessingJobs.mockResolvedValue(result);
      expect(await controller.getProcessingJobs()).toBe(result);
    });

    it('should throw NotFoundException on error', async () => {
      mockService.getProcessingJobs.mockRejectedValue(new Error());
      await expect(controller.getProcessingJobs()).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getRunningJobs', () => {
    it('should return running jobs', async () => {
      const result = { jobs: [] };
      mockService.getRunningJobs.mockResolvedValue(result);
      expect(await controller.getRunningJobs()).toBe(result);
    });

    it('should throw NotFoundException on error', async () => {
      mockService.getRunningJobs.mockRejectedValue(new Error());
      await expect(controller.getRunningJobs()).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCompletedJobs', () => {
    it('should return completed jobs', async () => {
      const result = { jobs: [] };
      mockService.getCompletedJobs.mockResolvedValue(result);
      expect(await controller.getCompletedJobs()).toBe(result);
    });

    it('should throw NotFoundException on error', async () => {
      mockService.getCompletedJobs.mockRejectedValue(new Error());
      await expect(controller.getCompletedJobs()).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPartialJobs', () => {
    it('should return partial jobs', async () => {
      const result = { jobs: [] };
      mockService.getPartialJobs.mockResolvedValue(result);
      expect(await controller.getPartialJobs()).toBe(result);
    });

    it('should throw NotFoundException on error', async () => {
      mockService.getPartialJobs.mockRejectedValue(new Error());
      await expect(controller.getPartialJobs()).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getFailedJobs', () => {
    it('should return failed jobs', async () => {
      const result = { jobs: [] };
      mockService.getFailedJobs.mockResolvedValue(result);
      expect(await controller.getFailedJobs()).toBe(result);
    });

    it('should throw NotFoundException on error', async () => {
      mockService.getFailedJobs.mockRejectedValue(new Error());
      await expect(controller.getFailedJobs()).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getExample', () => {
    const mockExampleData = {
      modelFeatures: { name: 'Test Model' },
      results: {},
    };

    beforeEach(() => {
      vi.mocked(join).mockImplementation((...args: string[]) => args.join('/'));
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockExampleData));
    });

    it('should return example 1 (fault tree, non-distributed, BDD)', () => {
      const result = controller.getExample('1');
      expect(result).toEqual(mockExampleData);
      expect(readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('JSON/chinese.json'),
        'utf-8',
      );
    });

    it('should return example 2 (event tree, distributed sequences)', () => {
      const result = controller.getExample('2');
      expect(result).toEqual(mockExampleData);
      expect(readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('JSON/demo_gas_leak.json'),
        'utf-8',
      );
    });

    it('should return example 3 (fault tree, adaptive)', () => {
      const result = controller.getExample('3');
      expect(result).toEqual(mockExampleData);
      expect(readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('JSON/chinese_adaptive.json'),
        'utf-8',
      );
    });

    it('should return example 4 (event tree, adaptive)', () => {
      const result = controller.getExample('4');
      expect(result).toEqual(mockExampleData);
      expect(readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('Adaptive/demo_gas_leak.json'),
        'utf-8',
      );
    });

    it('should throw NotFoundException for invalid example ID', () => {
      expect(() => controller.getExample('5')).toThrow(NotFoundException);
      expect(() => controller.getExample('5')).toThrow(
        'Example ID must be 1, 2, 3, or 4. Received: 5',
      );
    });

    it('should throw NotFoundException for non-numeric example ID', () => {
      expect(() => controller.getExample('invalid')).toThrow(NotFoundException);
      expect(() => controller.getExample('invalid')).toThrow(
        'Example ID must be 1, 2, 3, or 4. Received: invalid',
      );
    });

    it('should throw NotFoundException when file read fails', () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => controller.getExample('1')).toThrow(NotFoundException);
      expect(() => controller.getExample('1')).toThrow(
        'Unable to load example 1: File not found',
      );
    });

    it('should throw NotFoundException when JSON parse fails', () => {
      vi.mocked(readFileSync).mockReturnValue('invalid json');

      expect(() => controller.getExample('1')).toThrow(NotFoundException);
    });

    it('should re-throw NotFoundException when it is already a NotFoundException', () => {
      const notFoundError = new NotFoundException('Custom not found');
      vi.mocked(readFileSync).mockImplementation(() => {
        throw notFoundError;
      });

      expect(() => controller.getExample('1')).toThrow(notFoundError);
    });
  });
});
